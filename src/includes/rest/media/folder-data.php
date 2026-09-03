<?php
/**
 * Browsing and importing image files that already live in the uploads folder.
 *
 * @package FotoGrids\REST\Media
 * @since   1.1.0
 */

namespace FotoGrids\REST\Media;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Uploads Folder Data Handler
 *
 * Backs the "From Folder" import modal. Browsing is confined to the site's
 * uploads directory: every path arriving from the client is resolved with
 * realpath() and rejected unless it stays inside that directory.
 *
 * @since 1.1.0
 */
class Folder_Data {

	/**
	 * Maximum number of files returned by a single browse request.
	 *
	 * @var int
	 */
	const PER_PAGE_MAX = 500;

	/**
	 * Maximum number of files accepted by a single import request.
	 *
	 * @var int
	 */
	const IMPORT_MAX = 200;

	/**
	 * Uploads sub-folder used for ZIP extraction, hidden from the browser.
	 *
	 * @var string
	 */
	const TEMP_DIR_NAME = 'fotogrids-import';

	/**
	 * List the sub-folders and importable image files of one uploads folder.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function browse( $request ) {
		$base = self::uploads_base();
		if ( is_wp_error( $base ) ) {
			return $base;
		}

		$relative = self::sanitize_relative( (string) $request->get_param( 'path' ) );
		$absolute = self::resolve( $relative, $base );
		if ( is_wp_error( $absolute ) ) {
			return $absolute;
		}

		if ( ! is_dir( $absolute ) ) {
			return new \WP_Error(
				'fotogrids_folder_missing',
				__( 'That folder no longer exists.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$page     = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = min( self::PER_PAGE_MAX, max( 1, (int) $request->get_param( 'per_page' ) ) );

		$scan = self::scan_directory( $absolute );

		$attachments = self::attachments_in( $relative );
		$files       = array();

		foreach ( $scan['files'] as $name ) {
			$file_relative = '' === $relative ? $name : $relative . '/' . $name;

			if ( isset( $attachments['derivatives'][ $name ] ) ) {
				continue;
			}

			$attachment_id = isset( $attachments['originals'][ $name ] )
				? (int) $attachments['originals'][ $name ]
				: 0;

			$files[] = array(
				'name'          => $name,
				'path'          => $file_relative,
				'url'           => self::uploads_url( $file_relative ),
				'thumbnail'     => $attachment_id
					? wp_get_attachment_image_url( $attachment_id, 'thumbnail' )
					: self::uploads_url( $file_relative ),
				'size'          => self::file_size( $absolute . '/' . $name ),
				'attachment_id' => $attachment_id,
			);
		}

		$total  = count( $files );
		$offset = ( $page - 1 ) * $per_page;

		return rest_ensure_response(
			array(
				'path'        => $relative,
				'parent'      => self::parent_of( $relative ),
				'breadcrumbs' => self::breadcrumbs( $relative ),
				'folders'     => $scan['folders'],
				'files'       => array_slice( $files, $offset, $per_page ),
				'total'       => $total,
				'page'        => $page,
				'per_page'    => $per_page,
			)
		);
	}

	/**
	 * Add uploads-folder files to the Media Library.
	 *
	 * Files that are already attachments are returned as they are; the rest are
	 * registered in place, so nothing is copied, moved or deleted on disk.
	 *
	 * @since 1.1.0
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function import( $request ) {
		$base = self::uploads_base();
		if ( is_wp_error( $base ) ) {
			return $base;
		}

		$paths = (array) $request->get_param( 'files' );
		if ( empty( $paths ) ) {
			return new \WP_Error(
				'fotogrids_no_files',
				__( 'Select at least one image to add.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		if ( count( $paths ) > self::IMPORT_MAX ) {
			return new \WP_Error(
				'fotogrids_too_many_files',
				sprintf(
					/* translators: %d: maximum number of files accepted in one request. */
					__( 'Add up to %d images at a time.', 'fotogrids' ),
					self::IMPORT_MAX
				),
				array( 'status' => 400 )
			);
		}

		$items   = array();
		$skipped = array();

		foreach ( $paths as $path ) {
			$relative = self::sanitize_relative( (string) $path );
			$absolute = self::resolve( $relative, $base );

			if ( is_wp_error( $absolute ) || ! is_file( $absolute ) ) {
				$skipped[] = array(
					'path'   => $relative,
					'reason' => __( 'File not found.', 'fotogrids' ),
				);
				continue;
			}

			if ( ! self::is_allowed_image( $absolute ) ) {
				$skipped[] = array(
					'path'   => $relative,
					'reason' => __( 'Not a supported image file.', 'fotogrids' ),
				);
				continue;
			}

			$attachment_id = self::attachment_id_for( $relative );

			if ( ! $attachment_id ) {
				$attachment_id = self::register_file( $absolute, $relative );
			}

			if ( is_wp_error( $attachment_id ) ) {
				$skipped[] = array(
					'path'   => $relative,
					'reason' => $attachment_id->get_error_message(),
				);
				continue;
			}

			$items[] = Media_Items::to_item( $attachment_id );
		}

		return rest_ensure_response(
			array(
				'items'   => array_values( array_filter( $items ) ),
				'skipped' => $skipped,
			)
		);
	}

	/**
	 * Resolve the uploads directory to a canonical absolute path.
	 *
	 * @since 1.1.0
	 * @return string|\WP_Error
	 */
	private static function uploads_base() {
		$uploads = wp_get_upload_dir();

		if ( ! empty( $uploads['error'] ) || empty( $uploads['basedir'] ) ) {
			return new \WP_Error(
				'fotogrids_uploads_unavailable',
				__( 'The uploads folder is not readable.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		$base = realpath( $uploads['basedir'] );

		if ( false === $base ) {
			return new \WP_Error(
				'fotogrids_uploads_unavailable',
				__( 'The uploads folder is not readable.', 'fotogrids' ),
				array( 'status' => 500 )
			);
		}

		return wp_normalize_path( $base );
	}

	/**
	 * Build the public URL for a path relative to the uploads folder.
	 *
	 * @since 1.1.0
	 * @param string $relative Path relative to the uploads folder.
	 * @return string
	 */
	private static function uploads_url( $relative ) {
		$uploads = wp_get_upload_dir();
		$baseurl = isset( $uploads['baseurl'] ) ? $uploads['baseurl'] : '';

		return '' === $relative ? $baseurl : $baseurl . '/' . $relative;
	}

	/**
	 * Strip a client-supplied path down to a safe relative form.
	 *
	 * @since 1.1.0
	 * @param string $path Raw path from the request.
	 * @return string
	 */
	public static function sanitize_relative( $path ) {
		$path = wp_normalize_path( wp_unslash( $path ) );
		$path = str_replace( '\0', '', $path );
		$path = trim( $path, '/' );

		if ( '' === $path ) {
			return '';
		}

		$segments = array();

		foreach ( explode( '/', $path ) as $segment ) {
			if ( '' === $segment || '.' === $segment || '..' === $segment ) {
				continue;
			}
			$segments[] = $segment;
		}

		return implode( '/', $segments );
	}

	/**
	 * Resolve a relative path inside the uploads folder.
	 *
	 * @since 1.1.0
	 * @param string $relative Sanitized relative path.
	 * @param string $base     Canonical uploads directory.
	 * @return string|\WP_Error Canonical absolute path.
	 */
	private static function resolve( $relative, $base ) {
		if ( 0 === strpos( $relative, self::TEMP_DIR_NAME ) ) {
			return new \WP_Error(
				'fotogrids_path_forbidden',
				__( 'That location is not browsable.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		$target = '' === $relative ? $base : $base . '/' . $relative;
		$real   = realpath( $target );

		if ( false === $real ) {
			return new \WP_Error(
				'fotogrids_path_missing',
				__( 'That location no longer exists.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$real = wp_normalize_path( $real );

		if ( $real !== $base && 0 !== strpos( $real, trailingslashit( $base ) ) ) {
			return new \WP_Error(
				'fotogrids_path_forbidden',
				__( 'That location is outside the uploads folder.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		return $real;
	}

	/**
	 * Parent folder of a relative path, or null at the uploads root.
	 *
	 * @since 1.1.0
	 * @param string $relative Sanitized relative path.
	 * @return string|null
	 */
	private static function parent_of( $relative ) {
		if ( '' === $relative ) {
			return null;
		}

		$parent = dirname( $relative );

		return '.' === $parent ? '' : $parent;
	}

	/**
	 * Breadcrumb trail from the uploads root to the current folder.
	 *
	 * @since 1.1.0
	 * @param string $relative Sanitized relative path.
	 * @return array<int, array<string, string>>
	 */
	private static function breadcrumbs( $relative ) {
		$crumbs = array(
			array(
				'label' => __( 'Uploads', 'fotogrids' ),
				'path'  => '',
			),
		);

		if ( '' === $relative ) {
			return $crumbs;
		}

		$walked = array();

		foreach ( explode( '/', $relative ) as $segment ) {
			$walked[] = $segment;
			$crumbs[] = array(
				'label' => $segment,
				'path'  => implode( '/', $walked ),
			);
		}

		return $crumbs;
	}

	/**
	 * Read one directory's sub-folders and image files.
	 *
	 * Sub-folder counts are an estimate: files whose names carry WordPress'
	 * generated-size suffix are excluded without consulting attachment
	 * metadata, which would cost one query per folder.
	 *
	 * @since 1.1.0
	 * @param string $absolute Canonical directory path.
	 * @return array{folders: array, files: array<int, string>}
	 */
	private static function scan_directory( $absolute ) {
		$folders = array();
		$files   = array();

		$entries = is_readable( $absolute ) ? scandir( $absolute ) : false;

		if ( false === $entries ) {
			return array(
				'folders' => $folders,
				'files'   => $files,
			);
		}

		foreach ( $entries as $entry ) {
			if ( '.' === $entry || '..' === $entry || 0 === strpos( $entry, '.' ) ) {
				continue;
			}

			$path = $absolute . '/' . $entry;

			if ( is_dir( $path ) ) {
				if ( self::TEMP_DIR_NAME === $entry ) {
					continue;
				}

				$folders[] = array(
					'name'  => $entry,
					'count' => self::estimate_image_count( $path ),
				);
				continue;
			}

			if ( self::is_allowed_image( $path ) ) {
				$files[] = $entry;
			}
		}

		// Newest first: the uploads tree is year/month folders, so descending
		// order puts the most recent shoot at the top.
		usort(
			$folders,
			static function ( $a, $b ) {
				return strnatcasecmp( $b['name'], $a['name'] );
			}
		);

		natcasesort( $files );

		return array(
			'folders' => $folders,
			'files'   => array_values( $files ),
		);
	}

	/**
	 * Count the images directly inside a folder, ignoring generated sizes.
	 *
	 * @since 1.1.0
	 * @param string $absolute Canonical directory path.
	 * @return int
	 */
	private static function estimate_image_count( $absolute ) {
		$entries = is_readable( $absolute ) ? scandir( $absolute ) : false;

		if ( false === $entries ) {
			return 0;
		}

		$count = 0;

		foreach ( $entries as $entry ) {
			if ( '.' === $entry || '..' === $entry || 0 === strpos( $entry, '.' ) ) {
				continue;
			}

			if ( preg_match( '/-\d+x\d+\.[A-Za-z0-9]+$/', $entry ) ) {
				continue;
			}

			if ( is_file( $absolute . '/' . $entry ) && self::is_allowed_image( $absolute . '/' . $entry ) ) {
				++$count;
			}
		}

		return $count;
	}

	/**
	 * Cached result of allowed_image_types().
	 *
	 * @var array<string, string>|null
	 */
	private static $allowed_types = null;

	/**
	 * Image extensions the site accepts, keyed by extension.
	 *
	 * @since 1.1.0
	 * @return array<string, string>
	 */
	public static function allowed_image_types() {
		if ( null !== self::$allowed_types ) {
			return self::$allowed_types;
		}

		$allowed = array();

		foreach ( get_allowed_mime_types() as $extensions => $mime ) {
			if ( 0 !== strpos( $mime, 'image/' ) ) {
				continue;
			}

			foreach ( explode( '|', $extensions ) as $extension ) {
				$allowed[ $extension ] = $mime;
			}
		}

		self::$allowed_types = $allowed;

		return $allowed;
	}

	/**
	 * Whether a path points at an image type the site accepts.
	 *
	 * @since 1.1.0
	 * @param string $path Absolute file path.
	 * @return bool
	 */
	public static function is_allowed_image( $path ) {
		$extension = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );

		if ( '' === $extension ) {
			return false;
		}

		return isset( self::allowed_image_types()[ $extension ] );
	}

	/**
	 * Size of a file in bytes, or 0 when it is unreadable.
	 *
	 * @since 1.1.0
	 * @param string $path Absolute file path.
	 * @return int
	 */
	private static function file_size( $path ) {
		if ( ! is_file( $path ) ) {
			return 0;
		}

		$size = filesize( $path );

		return false === $size ? 0 : (int) $size;
	}

	/**
	 * Split the attachments of one uploads folder into originals and sizes.
	 *
	 * Generated sizes share the folder with the file they came from; listing
	 * them would bury the originals, so they are collected here and hidden.
	 *
	 * @since 1.1.0
	 * @param string $relative Folder path relative to the uploads folder.
	 * @return array{originals: array<string, int>, derivatives: array<string, bool>}
	 */
	private static function attachments_in( $relative ) {
		global $wpdb;

		$originals   = array();
		$derivatives = array();

		// Attachment file paths are not exposed by any core API, and the result
		// is scoped to the single folder being viewed.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		if ( '' === $relative ) {
			$rows = $wpdb->get_results(
				"SELECT post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value NOT LIKE '%/%'"
			);
		} else {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value LIKE %s",
					$wpdb->esc_like( $relative . '/' ) . '%'
				)
			);
		}
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		if ( empty( $rows ) ) {
			return array(
				'originals'   => $originals,
				'derivatives' => $derivatives,
			);
		}

		$ids = array();

		foreach ( $rows as $row ) {
			$file = wp_normalize_path( (string) $row->meta_value );

			if ( self::parent_of( $file ) !== ( '' === $relative ? '' : $relative ) ) {
				continue;
			}

			$originals[ wp_basename( $file ) ] = (int) $row->post_id;
			$ids[]                             = (int) $row->post_id;
		}

		if ( empty( $ids ) ) {
			return array(
				'originals'   => $originals,
				'derivatives' => $derivatives,
			);
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		// The IN list is built from a counted array of integers and the values
		// still go through prepare().
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$meta_rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attachment_metadata' AND post_id IN ( {$placeholders} )",
				$ids
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		foreach ( (array) $meta_rows as $serialized ) {
			$meta = maybe_unserialize( $serialized );

			if ( ! is_array( $meta ) ) {
				continue;
			}

			if ( ! empty( $meta['original_image'] ) ) {
				$derivatives[ (string) $meta['original_image'] ] = true;
			}

			if ( empty( $meta['sizes'] ) || ! is_array( $meta['sizes'] ) ) {
				continue;
			}

			foreach ( $meta['sizes'] as $size ) {
				if ( ! empty( $size['file'] ) ) {
					$derivatives[ (string) $size['file'] ] = true;
				}
			}
		}

		foreach ( array_keys( $originals ) as $name ) {
			unset( $derivatives[ $name ] );
		}

		return array(
			'originals'   => $originals,
			'derivatives' => $derivatives,
		);
	}

	/**
	 * Find the attachment already pointing at an uploads-relative file.
	 *
	 * @since 1.1.0
	 * @param string $relative Path relative to the uploads folder.
	 * @return int Attachment ID, or 0 when the file is not in the library.
	 */
	private static function attachment_id_for( $relative ) {
		global $wpdb;

		// Core offers no lookup from an uploads-relative path to an attachment ID.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value = %s LIMIT 1",
				$relative
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return $id ? (int) $id : 0;
	}

	/**
	 * Register an existing uploads file as a Media Library attachment.
	 *
	 * The file stays where it is; only the database rows and the generated
	 * sizes are new.
	 *
	 * @since 1.1.0
	 * @param string $absolute Canonical file path.
	 * @param string $relative Path relative to the uploads folder.
	 * @return int|\WP_Error Attachment ID.
	 */
	private static function register_file( $absolute, $relative ) {
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$filetype = wp_check_filetype( wp_basename( $absolute ), self::allowed_image_types() );

		if ( empty( $filetype['type'] ) ) {
			return new \WP_Error(
				'fotogrids_unsupported_type',
				__( 'Not a supported image file.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$attachment_id = wp_insert_attachment(
			array(
				'guid'           => self::uploads_url( $relative ),
				'post_mime_type' => $filetype['type'],
				'post_title'     => sanitize_text_field( pathinfo( $absolute, PATHINFO_FILENAME ) ),
				'post_content'   => '',
				'post_status'    => 'inherit',
			),
			$absolute,
			0,
			true
		);

		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

		wp_update_attachment_metadata(
			$attachment_id,
			wp_generate_attachment_metadata( $attachment_id, $absolute )
		);

		return (int) $attachment_id;
	}
}
