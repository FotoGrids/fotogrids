<?php
/**
 * Media Library attachments an export refers to, and their matches on the importing site.
 *
 * @package FotoGrids\Tools\ImportExport
 * @since   1.3.0
 */

namespace FotoGrids\Tools\ImportExport;

use FotoGrids\Post_Types;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Builds the export's `media` table and resolves its attachment IDs on import.
 *
 * Each table entry identifies one exported attachment by its file: the stored
 * path, the original file's name and size, and a fingerprint of its content. On
 * import an attachment ID from the file resolves to the attachment on this site
 * that holds the same file, or to 0 when there is none.
 *
 * @since 1.3.0
 */
class Attachment_Map {

	/**
	 * Bytes read from each end of a file for its fingerprint.
	 *
	 * @var int
	 */
	const FINGERPRINT_BYTES = 65536;

	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read-only postmeta lookup by file name; no core API searches attachments by stored path.

	/**
	 * Exported entries keyed by source attachment ID, or null for a file without a media table.
	 *
	 * @var array<int, array<string, mixed>>|null
	 */
	private $entries;

	/**
	 * Whether the file was exported from this site.
	 *
	 * @var bool
	 */
	private $same_site;

	/**
	 * Resolved IDs, keyed by source attachment ID.
	 *
	 * @var array<int, int>
	 */
	private $resolved = array();

	/**
	 * This site's attachments by file name, built on first use.
	 *
	 * @var array<string, int[]>|null
	 */
	private $by_name;

	/**
	 * Builds the resolver for one import.
	 *
	 * @since 1.3.0
	 * @param mixed  $media    The file's `media` table, or null when the file has none.
	 * @param string $site_url The exporting site's URL from the file's meta block.
	 */
	public function __construct( $media, string $site_url ) {
		$this->same_site = '' !== $site_url && 0 === strcasecmp( untrailingslashit( $site_url ), untrailingslashit( get_site_url() ) );

		if ( null === $media ) {
			$this->entries = null;
			return;
		}

		$this->entries = array();
		foreach ( is_array( $media ) ? $media : array() as $entry ) {
			$entry = is_array( $entry ) ? $entry : array();
			$id    = (int) ( $entry['id'] ?? 0 );
			if ( $id <= 0 ) {
				continue;
			}
			$this->entries[ $id ] = array(
				'file'        => self::text( $entry['file'] ?? '' ),
				'name'        => wp_basename( self::text( $entry['name'] ?? '' ) ),
				'size'        => (int) ( $entry['size'] ?? 0 ),
				'fingerprint' => strtolower( self::text( $entry['fingerprint'] ?? '' ) ),
			);
		}
	}

	/**
	 * Builds the `media` table for an export: one entry per attachment the data refers to.
	 *
	 * @since 1.3.0
	 * @param array<string, mixed> $data Collected export data.
	 * @return array<int, array<string, mixed>>
	 */
	public static function export( array $data ): array {
		$media = array();

		foreach ( self::referenced_ids( $data ) as $id ) {
			if ( 'attachment' !== get_post_type( $id ) ) {
				continue;
			}
			$path    = self::original_path( $id );
			$on_disk = '' !== $path && is_file( $path ) && is_readable( $path );

			$media[] = array(
				'id'          => $id,
				'file'        => (string) get_post_meta( $id, '_wp_attached_file', true ),
				'name'        => '' !== $path ? wp_basename( $path ) : '',
				'size'        => $on_disk ? (int) filesize( $path ) : 0,
				'fingerprint' => $on_disk ? self::fingerprint( $path ) : '',
			);
		}

		return $media;
	}

	/**
	 * The attachment on this site that holds the exported attachment's file.
	 *
	 * @since 1.3.0
	 * @param int $source_id Attachment ID on the exporting site.
	 * @return int Attachment ID on this site, or 0 when none matches.
	 */
	public function resolve( int $source_id ): int {
		if ( $source_id <= 0 ) {
			return 0;
		}
		if ( ! isset( $this->resolved[ $source_id ] ) ) {
			$this->resolved[ $source_id ] = $this->find( $source_id );
		}

		return $this->resolved[ $source_id ];
	}

	/**
	 * Whether the file was exported from this site, so an ID it holds already
	 * belongs to this site.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public function is_same_site(): bool {
		return $this->same_site;
	}

	/**
	 * Whether the file's media table lists the given ID.
	 *
	 * @since 1.3.0
	 * @param int $source_id ID on the exporting site.
	 * @return bool
	 */
	public function lists( int $source_id ): bool {
		return null !== $this->entries && isset( $this->entries[ $source_id ] );
	}

	/**
	 * Resolves one source attachment ID.
	 *
	 * @param int $source_id Attachment ID on the exporting site.
	 * @return int
	 */
	private function find( int $source_id ): int {
		if ( null === $this->entries ) {
			return $this->same_site && 'attachment' === get_post_type( $source_id ) ? $source_id : 0;
		}

		$entry = $this->entries[ $source_id ] ?? null;
		if ( null === $entry ) {
			return 0;
		}

		if ( $this->same_site && 'attachment' === get_post_type( $source_id ) && (string) get_post_meta( $source_id, '_wp_attached_file', true ) === $entry['file'] ) {
			return $source_id;
		}

		if ( '' === $entry['fingerprint'] || '' === $entry['name'] ) {
			return 0;
		}

		foreach ( $this->candidates( $source_id, $entry['name'] ) as $candidate ) {
			$path = self::original_path( $candidate );
			if ( '' === $path || ! is_file( $path ) || ! is_readable( $path ) ) {
				continue;
			}
			if ( (int) filesize( $path ) === $entry['size'] && hash_equals( $entry['fingerprint'], self::fingerprint( $path ) ) ) {
				return $candidate;
			}
		}

		return 0;
	}

	/**
	 * Attachments on this site whose original file carries the exported file name,
	 * or that name with the numeric suffix WordPress adds to a duplicate upload.
	 *
	 * @param int    $source_id Attachment ID on the exporting site, checked first.
	 * @param string $name      Exported original file name.
	 * @return int[]
	 */
	private function candidates( int $source_id, string $name ): array {
		$extension = pathinfo( $name, PATHINFO_EXTENSION );
		$stem      = '' === $extension ? $name : substr( $name, 0, -( strlen( $extension ) + 1 ) );
		$pattern   = '/^' . preg_quote( $stem, '/' ) . '(-\d+)?' . ( '' === $extension ? '' : '\.' . preg_quote( $extension, '/' ) ) . '$/i';

		$names = $this->names();
		$key   = strtolower( $stem );
		$ids   = array_merge( $names[ $key ] ?? array(), $names[ $key . '-' ] ?? array() );

		usort(
			$ids,
			static function ( int $a, int $b ) use ( $source_id ): int {
				return ( $b === $source_id ) <=> ( $a === $source_id ) ?: $a <=> $b;
			}
		);

		return array_values(
			array_filter(
				$ids,
				static function ( int $id ) use ( $pattern ): bool {
					$path = self::original_path( $id );

					return '' !== $path && 1 === preg_match( $pattern, wp_basename( $path ) );
				}
			)
		);
	}

	/**
	 * This site's attachments grouped by the name of their stored file.
	 *
	 * Each attachment is listed under its file's lowercase stem, without the
	 * `-scaled` or `-rotated` WordPress adds to a resized original. A stem that
	 * ends in a number suffix such as `-2` is also listed under the stem before
	 * it followed by `-`, so a duplicate upload is found from the original name.
	 * One query serves the whole import.
	 *
	 * @return array<string, int[]>
	 */
	private function names(): array {
		global $wpdb;

		if ( null !== $this->by_name ) {
			return $this->by_name;
		}

		$this->by_name = array();
		$rows          = (array) $wpdb->get_results(
			$wpdb->prepare(
				'SELECT pm.post_id, pm.meta_value FROM %i pm INNER JOIN %i p ON p.ID = pm.post_id WHERE pm.meta_key = %s AND p.post_type = %s',
				$wpdb->postmeta,
				$wpdb->posts,
				'_wp_attached_file',
				'attachment'
			),
			ARRAY_N
		);

		foreach ( $rows as $row ) {
			$stem = strtolower( (string) pathinfo( (string) $row[1], PATHINFO_FILENAME ) );
			$stem = (string) preg_replace( '/-(scaled|rotated)$/', '', $stem );
			$id   = (int) $row[0];

			$this->by_name[ $stem ][] = $id;
			if ( preg_match( '/^(.+)-\d+$/', $stem, $match ) ) {
				$this->by_name[ $match[1] . '-' ][] = $id;
			}
		}

		return $this->by_name;
	}

	/**
	 * Attachment IDs the export data refers to: gallery item lists, featured images,
	 * item rows, item metadata, item statistics and embed posters.
	 *
	 * @param array<string, mixed> $data Collected export data.
	 * @return int[]
	 */
	private static function referenced_ids( array $data ): array {
		$ids = array();

		foreach ( array( 'galleries', 'albums' ) as $key ) {
			foreach ( (array) ( $data[ $key ] ?? array() ) as $post ) {
				$meta  = (array) ( $post['meta'] ?? array() );
				$ids   = array_merge( $ids, self::list_ids( $meta['fotogrids_gallery_items'] ?? array() ) );
				$ids[] = (int) ( $meta[ Post_Types::FEATURED_IMAGE_META_KEY ] ?? 0 );
			}
		}

		foreach ( array( 'items', 'item_metadata' ) as $key ) {
			foreach ( (array) ( $data[ $key ] ?? array() ) as $row ) {
				$ids[] = (int) ( $row['attachment_id'] ?? 0 );
			}
		}

		foreach ( (array) ( $data['statistics'] ?? array() ) as $row ) {
			if ( 'item' === ( $row['object_type'] ?? '' ) ) {
				$ids[] = (int) ( $row['object_id'] ?? 0 );
			}
		}

		foreach ( (array) ( $data['embeds'] ?? array() ) as $embed ) {
			$ids[] = (int) ( $embed['poster_id'] ?? 0 );
		}

		$ids = array_unique( array_filter( $ids ) );
		sort( $ids );

		return $ids;
	}

	/**
	 * Decodes a `fotogrids_gallery_items` value into IDs.
	 *
	 * @since 1.3.0
	 * @param mixed $value Stored list: a JSON string or an array.
	 * @return int[]
	 */
	public static function list_ids( $value ): array {
		if ( is_string( $value ) ) {
			$value = json_decode( $value, true );
		}

		return is_array( $value ) ? array_map( 'intval', array_filter( $value, 'is_scalar' ) ) : array();
	}

	/**
	 * Path of the attachment's original file: the upload before WordPress scaled it.
	 *
	 * @param int $id Attachment ID.
	 * @return string Empty when the attachment has no file.
	 */
	private static function original_path( int $id ): string {
		$path = wp_get_original_image_path( $id );
		if ( ! $path ) {
			$path = get_attached_file( $id );
		}

		return is_string( $path ) ? $path : '';
	}

	/**
	 * SHA-1 of a file's size and its first and last FINGERPRINT_BYTES bytes.
	 *
	 * @param string $path Readable file path.
	 * @return string Empty when the file cannot be read.
	 */
	private static function fingerprint( string $path ): string {
		$size   = (int) filesize( $path );
		$handle = fopen( $path, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- Reads two ranges of a local upload; WP_Filesystem has no ranged read.
		if ( false === $handle ) {
			return '';
		}
		$head = (string) fread( $handle, self::FINGERPRINT_BYTES ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread -- See fopen above.
		$tail = '';
		if ( $size > self::FINGERPRINT_BYTES ) {
			fseek( $handle, max( self::FINGERPRINT_BYTES, $size - self::FINGERPRINT_BYTES ) );
			$tail = (string) fread( $handle, self::FINGERPRINT_BYTES ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread -- See fopen above.
		}
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- See fopen above.

		return sha1( $size . ':' . $head . $tail );
	}

	/**
	 * A scalar file value as a string; an empty XML element parses to an array.
	 *
	 * @param mixed $value Value from the file.
	 * @return string
	 */
	private static function text( $value ): string {
		return is_scalar( $value ) ? (string) $value : '';
	}
}
