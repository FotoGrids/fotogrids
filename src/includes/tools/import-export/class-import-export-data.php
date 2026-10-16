<?php
namespace FotoGrids\Tools\ImportExport;

use FotoGrids\Galleries\Embed_Store;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Galleries\Item_Meta;
use FotoGrids\Galleries\Item_Meta_Consolidation;
use FotoGrids\Hooks\Actions_Gallery;
use FotoGrids\Post_Types;
use FotoGrids\REST\Items\Embed_Data;
use FotoGrids\Settings\Collection_Defaults_Store;
use FotoGrids\Settings\Plugin_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Import / Export Data
 *
 * REST handlers for the Import / Export tool. Covers:
 *
 *   GET  /fotogrids/v1/admin/tools/import-export/export
 *   POST /fotogrids/v1/admin/tools/import-export/import  (phase: analyse | execute)
 *   GET  /fotogrids/v1/admin/tools/import-export/log
 *
 * @since 1.0.0
 */
class Import_Export_Data {

	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Custom-table data layer; no core API or object cache applies.

	const LOG_OPTION = 'fotogrids_import_export_log';
	const LOG_MAX    = 50;

	/**
	 * Post statuses a gallery or album is exported with and may be imported as.
	 */
	const COLLECTION_STATUSES = array( 'publish', 'future', 'draft', 'pending', 'private' );

	/**
	 * GET /fotogrids/v1/admin/tools/import-export/export
	 *
	 * Query params:
	 *   include[] - one or more of: galleries, albums, items, tags,
	 *               settings, statistics, templates
	 *   format    - 'json' (default) or 'xml'
	 *
	 * Sends the file as a download (Content-Disposition: attachment).
	 */
	public static function export( \WP_REST_Request $request ): void {
		$include = (array) ( $request->get_param( 'include' ) ?? array(
			'galleries',
			'albums',
			'items',
			'tags',
			'settings',
			'statistics',
			'templates',
		) );
		$format  = sanitize_key( $request->get_param( 'format' ) ?? 'json' );
		if ( ! in_array( $format, array( 'json', 'xml' ), true ) ) {
			$format = 'json';
		}

		$data = self::collect_export_data( $include );

		$date     = current_time( 'Y-m-d' );
		$filename = "fotogrids-export-{$date}.{$format}";

		// Append to the log before sending headers.
		$type_counts = array();
		foreach ( array( 'galleries', 'albums', 'items', 'tags', 'templates' ) as $key ) {
			if ( isset( $data[ $key ] ) ) {
				$count         = count( $data[ $key ] ) + ( 'items' === $key ? count( $data['embeds'] ?? array() ) : 0 );
				$type_counts[] = $count . ' ' . $key;
			}
		}
		if ( isset( $data['settings'] ) ) {
			$type_counts[] = 'settings';
		}
		self::append_log(
			array(
				'type'    => 'export',
				'summary' => implode( ', ', $type_counts ) . ' · ' . strtoupper( $format ),
				'status'  => 'complete',
			)
		);

		if ( 'xml' === $format ) {
			$body         = self::serialise_xml( $data );
			$content_type = 'application/xml';
		} else {
			$body         = self::serialise_json( $data );
			$content_type = 'application/json';
		}

		nocache_headers();
		header( 'Content-Type: ' . $content_type . '; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		header( 'Content-Length: ' . strlen( $body ) );
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Serialised XML/JSON file download (Content-Disposition: attachment), not HTML; HTML-escaping would corrupt the export. XML entities are encoded in serialise_xml().
		exit;
	}

	/**
	 * POST /fotogrids/v1/admin/tools/import-export/import
	 *
	 * Body params:
	 *   phase    - 'analyse' or 'execute'
	 *   file     - raw file text (string)
	 *   format   - 'json' or 'xml' (auto-detected if omitted)
	 *
	 * Execute-only params:
	 *   include[]  - data types to import
	 *   galleries  - 'skip' | 'overwrite' | 'duplicate'
	 *   albums     - 'skip' | 'overwrite' | 'duplicate'
	 *
	 * @param  \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function import( \WP_REST_Request $request ) {
		$phase = sanitize_key( $request->get_param( 'phase' ) ?? 'analyse' );
		$raw   = $request->get_param( 'file' );

		if ( empty( $raw ) ) {
			return new \WP_Error(
				'missing_file',
				__( 'No file content provided.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$format = sanitize_key( $request->get_param( 'format' ) ?? '' );
		if ( ! in_array( $format, array( 'json', 'xml' ), true ) ) {
			$format = self::detect_format( $raw );
		}

		if ( 'xml' === $format ) {
			$data = self::parse_xml( $raw );
		} else {
			$data = self::parse_json( $raw );
		}

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		if ( 'analyse' === $phase ) {
			return self::analyse( $data );
		}

		if ( 'execute' === $phase ) {
			$options = array(
				'include'   => (array) ( $request->get_param( 'include' ) ?? array_keys( $data ) ),
				'galleries' => sanitize_key( $request->get_param( 'galleries' ) ?? 'skip' ),
				'albums'    => sanitize_key( $request->get_param( 'albums' ) ?? 'skip' ),
			);
			return self::execute( $data, $options );
		}

		return new \WP_Error(
			'invalid_phase',
			__( 'Phase must be "analyse" or "execute".', 'fotogrids' ),
			array( 'status' => 400 )
		);
	}

	/**
	 * GET /fotogrids/v1/admin/tools/import-export/log
	 *
	 * @param  \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public static function log( \WP_REST_Request $request ): \WP_REST_Response { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		$log = get_option( self::LOG_OPTION, array() );
		if ( ! is_array( $log ) ) {
			$log = array();
		}
		return new \WP_REST_Response( array( 'log' => $log ), 200 );
	}

	/**
	 * Collect all requested data types and return a normalised PHP array.
	 */
	private static function collect_export_data( array $include_types ): array {
		global $wpdb;

		$data = array(
			'meta' => array(
				'version'     => FOTOGRIDS_VERSION,
				'exported_at' => current_time( 'c' ),
				'site_url'    => get_site_url(),
			),
		);

		if ( in_array( 'galleries', $include_types, true ) ) {
			$posts = get_posts(
				array(
					'post_type'      => Post_Types::GALLERY,
					'post_status'    => self::COLLECTION_STATUSES,
					'posts_per_page' => -1,
					'orderby'        => 'date',
					'order'          => 'ASC',
				)
			);

			$data['galleries'] = array_map(
				function ( $post ) {
					return array(
						'id'     => $post->ID,
						'title'  => $post->post_title,
						'slug'   => $post->post_name,
						'status' => $post->post_status,
						'date'   => $post->post_date,
						'meta'   => self::get_fotogrids_post_meta( $post->ID ),
					);
				},
				$posts
			);
		}

		if ( in_array( 'albums', $include_types, true ) ) {
			$posts = get_posts(
				array(
					'post_type'      => Post_Types::ALBUM,
					'post_status'    => self::COLLECTION_STATUSES,
					'posts_per_page' => -1,
					'orderby'        => 'date',
					'order'          => 'ASC',
				)
			);

			$data['albums'] = array_map(
				function ( $post ) {
					return array(
						'id'     => $post->ID,
						'title'  => $post->post_title,
						'slug'   => $post->post_name,
						'status' => $post->post_status,
						'date'   => $post->post_date,
						'meta'   => self::get_fotogrids_post_meta( $post->ID ),
					);
				},
				$posts
			);
		}

		if ( in_array( 'albums', $include_types, true ) || in_array( 'galleries', $include_types, true ) ) {
			$table                  = $wpdb->prefix . 'fotogrids_gallery_albums';
			$data['gallery_albums'] = $wpdb->get_results(
				$wpdb->prepare( 'SELECT gallery_id, album_id, position FROM %i ORDER BY album_id, position', $table ),
				ARRAY_A
			) ?: array();
		}

		if ( in_array( 'items', $include_types, true ) ) {
			$table         = $wpdb->prefix . 'fotogrids_item_meta';
			$data['items'] = self::export_items(
				$wpdb->get_results(
					$wpdb->prepare( 'SELECT * FROM %i ORDER BY gallery_id, position', $table ),
					ARRAY_A
				) ?: array()
			);

			$data['embeds'] = self::export_embeds();

			$meta_table            = $wpdb->prefix . 'fotogrids_item_metadata';
			$data['item_metadata'] = $wpdb->get_results(
				$wpdb->prepare( 'SELECT * FROM %i', $meta_table ),
				ARRAY_A
			) ?: array();
		}

		if ( in_array( 'tags', $include_types, true ) ) {
			$table        = $wpdb->prefix . 'fotogrids_tags';
			$data['tags'] = $wpdb->get_results(
				$wpdb->prepare( 'SELECT * FROM %i ORDER BY type, name', $table ),
				ARRAY_A
			) ?: array();
		}

		if ( in_array( 'settings', $include_types, true ) ) {
			$data['settings'] = array(
				'media'                      => get_option( 'fotogrids_media_settings', array() ),
				'collection_defaults'        => Collection_Defaults_Store::all(),
				'autosave'                   => get_option( 'fotogrids_autosave', true ),
				'share_statistics'           => get_option( 'fotogrids_share_statistics', false ),
				'preserve_data_on_uninstall' => get_option( 'fotogrids_preserve_data_on_uninstall', true ),
			);
		}

		if ( in_array( 'statistics', $include_types, true ) ) {
			$table              = $wpdb->prefix . 'fotogrids_statistics';
			$data['statistics'] = $wpdb->get_results(
				$wpdb->prepare( 'SELECT object_type, object_id, views, shares, last_viewed FROM %i', $table ),
				ARRAY_A
			) ?: array();
		}

		// Templates are stored as user meta, so collect across all users.
		if ( in_array( 'templates', $include_types, true ) ) {
			$users         = get_users( array( 'fields' => array( 'ID' ) ) );
			$all_templates = array();
			foreach ( $users as $user ) {
				$raw = get_user_meta( $user->ID, 'fotogrids_user_templates', true );
				if ( $raw ) {
					$decoded = json_decode( $raw, true );
					if ( is_array( $decoded ) ) {
						foreach ( $decoded as $tpl ) {
							$tpl['_user_id'] = $user->ID;
							$all_templates[] = $tpl;
						}
					}
				}
			}
			$data['templates'] = $all_templates;
		}

		return $data;
	}

	/**
	 * Build the exported item entries: every item row, plus every attachment in a
	 * gallery the export includes that has no row, each carrying the attachment's own
	 * text and whether it is an image or a video.
	 *
	 * @since 1.2.0
	 * @param array<int, array<string, mixed>> $rows Item meta rows.
	 * @return array<int, array<string, mixed>>
	 */
	private static function export_items( array $rows ): array {
		$exported = array_flip( array_map( 'intval', array_column( $rows, 'attachment_id' ) ) );

		foreach ( Gallery_Repository::all_item_ids( self::COLLECTION_STATUSES ) as $item_id ) {
			if ( ! isset( $exported[ $item_id ] ) && 'attachment' === get_post_type( $item_id ) ) {
				$rows[]               = array(
					'attachment_id' => $item_id,
					'gallery_id'    => Item_Meta::GALLERY_ID,
				);
				$exported[ $item_id ] = true;
			}
		}

		foreach ( $rows as $index => $row ) {
			$attachment = get_post( (int) $row['attachment_id'] );
			if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
				continue;
			}
			$rows[ $index ]['title']       = $attachment->post_title;
			$rows[ $index ]['caption']     = $attachment->post_excerpt;
			$rows[ $index ]['description'] = $attachment->post_content;
			$rows[ $index ]['alt']         = (string) get_post_meta( $attachment->ID, '_wp_attachment_image_alt', true );
			$rows[ $index ]['media_type']  = wp_attachment_is( 'video', $attachment ) ? 'video' : 'image';
		}

		return $rows;
	}

	/**
	 * Build the exported video embed entries: every embed in a gallery the export
	 * includes. `poster_src` carries the URL of a Media Library poster.
	 *
	 * @since 1.3.0
	 * @return array<int, array<string, mixed>>
	 */
	private static function export_embeds(): array {
		$embeds = array();

		foreach ( Gallery_Repository::all_item_ids( self::COLLECTION_STATUSES ) as $item_id ) {
			$embed = Embed_Store::get( $item_id );
			if ( null === $embed ) {
				continue;
			}
			$embed['poster_src'] = $embed['poster_id'] > 0 ? (string) wp_get_attachment_url( $embed['poster_id'] ) : '';
			$embeds[]            = $embed;
		}

		return $embeds;
	}

	/**
	 * Get all fotogrids_* post meta for a post, returned as a flat key=>value map.
	 */
	private static function get_fotogrids_post_meta( int $post_id ): array {
		$all  = get_post_meta( $post_id );
		$meta = array();
		foreach ( $all as $key => $values ) {
			if ( strpos( $key, 'fotogrids_' ) === 0 ) {
				$meta[ $key ] = maybe_unserialize( $values[0] );
			}
		}
		return $meta;
	}

	private static function serialise_json( array $data ): string {
		return wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
	}

	private static function serialise_xml( array $data ): string {
		$dom               = new \DOMDocument( '1.0', 'UTF-8' );
		$dom->formatOutput = true; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOMDocument API property, not ours.

		$root = $dom->createElement( 'fotogrids-export' );
		$dom->appendChild( $root );

		self::array_to_dom( $dom, $root, $data );

		return $dom->saveXML();
	}

	/**
	 * Recursively convert a PHP array into DOM child nodes.
	 *
	 * Arrays of objects become a list of <item> elements. Scalars become
	 * text nodes. Associative arrays become child elements named after keys.
	 */
	private static function array_to_dom( \DOMDocument $dom, \DOMElement $parent_el, $value ): void {
		if ( is_array( $value ) ) {
			$is_list = array_keys( $value ) === range( 0, count( $value ) - 1 );
			foreach ( $value as $key => $child ) {
				$tag_name = $is_list ? 'item' : self::to_xml_tag( (string) $key );
				$element  = $dom->createElement( $tag_name );
				if ( $is_list ) {
					$element->setAttribute( 'index', (string) $key );
				}
				$parent_el->appendChild( $element );
				self::array_to_dom( $dom, $element, $child );
			}
		} elseif ( is_bool( $value ) ) {
			$parent_el->appendChild( $dom->createTextNode( $value ? 'true' : 'false' ) );
		} elseif ( is_null( $value ) ) {
			$parent_el->setAttribute( 'null', 'true' );
		} else {
			$parent_el->appendChild( $dom->createTextNode( (string) $value ) );
		}
	}

	/** Convert an arbitrary string to a valid XML element name. */
	private static function to_xml_tag( string $key ): string {
		$tag = preg_replace( '/[^a-zA-Z0-9_\-]/', '_', $key );
		// Tags can't start with a digit.
		if ( preg_match( '/^\d/', $tag ) ) {
			$tag = 'n_' . $tag;
		}
		return $tag ? $tag : 'field';
	}

	/** Detect whether raw text is JSON or XML. */
	private static function detect_format( string $raw ): string {
		$trimmed = ltrim( $raw );
		return ( '' !== $trimmed && '<' === $trimmed[0] ) ? 'xml' : 'json';
	}

	/**
	 * Parse JSON export file. Returns normalised data array or WP_Error.
	 */
	private static function parse_json( string $raw ) {
		$data = json_decode( $raw, true );
		if ( json_last_error() !== JSON_ERROR_NONE ) {
			return new \WP_Error(
				'invalid_json',
				__( 'The file could not be parsed. Please ensure it is a valid FotoGrids JSON export.', 'fotogrids' ),
				array( 'status' => 422 )
			);
		}
		return self::validate_parsed( $data );
	}

	/**
	 * Parse XML export file. Returns normalised data array or WP_Error.
	 * Converts back to the same internal structure as the JSON parser.
	 */
	private static function parse_xml( string $raw ) {
		libxml_use_internal_errors( true );
		$xml = simplexml_load_string( $raw );
		if ( false === $xml ) {
			return new \WP_Error(
				'invalid_xml',
				__( 'The file could not be parsed. Please ensure it is a valid FotoGrids XML export.', 'fotogrids' ),
				array( 'status' => 422 )
			);
		}
		// Convert SimpleXMLElement to a plain PHP array via JSON round-trip.
		$data = json_decode( wp_json_encode( $xml ), true );
		return self::validate_parsed( self::normalise_xml_data( $data ) );
	}

	/**
	 * Normalise the XML→JSON round-trip artefacts back to the same shape
	 * as a direct JSON export. Specifically: lists of <item> elements come
	 * back as {'item': [...]} or {'item': {...}} and need flattening.
	 */
	private static function normalise_xml_data( $data ) {
		if ( ! is_array( $data ) ) {
			return $data;
		}
		// If the array has a single key 'item', it's a list wrapper - unwrap it.
		if ( count( $data ) === 1 && isset( $data['item'] ) ) {
			$items = $data['item'];
			// simplexml collapses single children to a non-array.
			if ( ! isset( $items[0] ) ) {
				$items = array( $items );
			}
			return array_map( array( self::class, 'normalise_xml_data' ), array_values( $items ) );
		}
		return array_map( array( self::class, 'normalise_xml_data' ), $data );
	}

	/**
	 * Validate the top-level parsed structure. Returns WP_Error on failure.
	 */
	private static function validate_parsed( $data ) {
		if ( ! is_array( $data ) ) {
			return new \WP_Error(
				'invalid_format',
				__( 'Unrecognised export format.', 'fotogrids' ),
				array( 'status' => 422 )
			);
		}
		if ( empty( $data['meta'] ) || empty( $data['meta']['version'] ) ) {
			return new \WP_Error(
				'missing_meta',
				__( 'The file does not appear to be a FotoGrids export (missing meta block).', 'fotogrids' ),
				array( 'status' => 422 )
			);
		}
		return $data;
	}

	/**
	 * Analyse phase: count entities and return a summary. Nothing is written.
	 */
	private static function analyse( array $data ): \WP_REST_Response {
		$contents = array();
		foreach ( array( 'galleries', 'albums', 'tags', 'item_metadata', 'templates', 'statistics' ) as $key ) {
			if ( isset( $data[ $key ] ) && is_array( $data[ $key ] ) ) {
				$contents[ $key ] = count( $data[ $key ] );
			}
		}

		$items  = is_array( $data['items'] ?? null ) ? $data['items'] : array();
		$embeds = is_array( $data['embeds'] ?? null ) ? $data['embeds'] : array();
		if ( isset( $data['items'] ) || $embeds ) {
			$contents['items'] = count( $items ) + count( $embeds );

			if ( self::has_media_types( $items ) ) {
				$detail = array(
					'images' => 0,
					'videos' => count( $embeds ),
				);
				foreach ( $items as $item ) {
					++$detail[ self::media_kind( (array) $item ) ];
				}
				$contents['items_detail'] = $detail;
			}
		}
		if ( isset( $data['settings'] ) ) {
			$contents['settings'] = true;
		}

		return new \WP_REST_Response(
			array(
				'valid'    => true,
				'meta'     => $data['meta'],
				'contents' => $contents,
			),
			200
		);
	}

	/**
	 * Execute phase: write data to the database.
	 */
	private static function execute( array $data, array $options ): \WP_REST_Response {
		global $wpdb;

		$include  = $options['include'];
		$imported = array();
		$skipped  = array();
		$errors   = array();
		$known    = self::known_item_ids();

		$wpdb->query( 'START TRANSACTION' );

		try {
			$tag_id_map = array();
			if ( ! empty( $data['tags'] ) ) {
				$create_tags                 = in_array( 'tags', $include, true );
				[ $imp, $skip, $tag_id_map ] = self::import_tags( $data['tags'], $create_tags );
				if ( $create_tags ) {
					$imported['tags'] = $imp;
					$skipped['tags']  = $skip;
				}
			}

			$gallery_id_map    = array(); // old_id => new_id
			$written_galleries = array();
			if ( in_array( 'galleries', $include, true ) && ! empty( $data['galleries'] ) ) {
				[ $imp, $skip, $map, $written ] = self::import_collections(
					$data['galleries'],
					Post_Types::GALLERY,
					$options['galleries']
				);
				$imported['galleries']          = $imp;
				$skipped['galleries']           = $skip;
				$gallery_id_map                 = $map;
				$written_galleries              = $written;
			}

			$album_id_map = array();
			if ( in_array( 'albums', $include, true ) && ! empty( $data['albums'] ) ) {
				[ $imp, $skip, $map ] = self::import_collections(
					$data['albums'],
					Post_Types::ALBUM,
					$options['albums']
				);
				$imported['albums']   = $imp;
				$skipped['albums']    = $skip;
				$album_id_map         = $map;
			}

			if ( ! empty( $data['gallery_albums'] ) && ( $gallery_id_map || $album_id_map ) ) {
				self::import_gallery_albums( $data['gallery_albums'], $gallery_id_map, $album_id_map );
			}

			$item_attachment_map = array(); // old_attachment_id => new_attachment_id (1:1 on same site)

			$kinds = array(
				'imported' => array(
					'images' => 0,
					'videos' => 0,
				),
				'skipped'  => array(
					'images' => 0,
					'videos' => 0,
				),
			);

			if ( in_array( 'items', $include, true ) && ! empty( $data['items'] ) ) {
				[ $imp, $skip, $kinds ] = self::import_items( $data['items'], $gallery_id_map, $known );
				$imported['items']      = $imp;
				$skipped['items']       = $skip;
			}

			if ( in_array( 'items', $include, true ) && ! empty( $data['embeds'] ) && is_array( $data['embeds'] ) ) {
				[ $imp, $skip ]    = self::import_embeds( $data['embeds'], $written_galleries );
				$imported['items'] = ( $imported['items'] ?? 0 ) + $imp;
				$skipped['items']  = ( $skipped['items'] ?? 0 ) + $skip;

				$kinds['imported']['videos'] += $imp;
				$kinds['skipped']['videos']  += $skip;
			}

			if ( isset( $imported['items'] ) && self::has_media_types( is_array( $data['items'] ?? null ) ? $data['items'] : array() ) ) {
				$imported['items_detail'] = $kinds['imported'];
				$skipped['items_detail']  = $kinds['skipped'];
			}

			// Item metadata is imported after both items and tags exist.
			if ( in_array( 'items', $include, true ) && ! empty( $data['item_metadata'] ) ) {
				self::import_item_metadata( $data['item_metadata'], $tag_id_map );
			}

			if ( in_array( 'settings', $include, true ) && ! empty( $data['settings'] ) ) {
				self::import_settings( $data['settings'] );
				$imported['settings'] = true;
			}

			if ( in_array( 'statistics', $include, true ) && ! empty( $data['statistics'] ) ) {
				[ $imp ]                = self::import_statistics( $data['statistics'], $gallery_id_map, $album_id_map );
				$imported['statistics'] = $imp;
			}

			if ( in_array( 'templates', $include, true ) && ! empty( $data['templates'] ) ) {
				[ $imp ]               = self::import_templates( $data['templates'] );
				$imported['templates'] = $imp;
			}

			$wpdb->query( 'COMMIT' );

			\FotoGrids\Cache\Metadata_Cache::forget_all();
			\FotoGrids\Migrations\List_Setting_Repair::run();

			\FotoGrids\FotoGrids_Cache::flush_all();

		} catch ( \Exception $e ) {
			$wpdb->query( 'ROLLBACK' );
			return new \WP_REST_Response(
				array(
					'imported' => array(),
					'skipped'  => array(),
					'errors'   => array( $e->getMessage() ),
				),
				500
			);
		}

		$total_skipped = array_sum( array_filter( array_values( $skipped ), 'is_int' ) );
		$status        = $total_skipped > 0 ? 'partial' : 'complete';

		$summary_parts = array();
		foreach ( array( 'galleries', 'albums', 'items', 'tags', 'templates' ) as $key ) {
			if ( isset( $imported[ $key ] ) && $imported[ $key ] > 0 ) {
				$summary_parts[] = $imported[ $key ] . ' ' . $key;
			}
		}
		if ( isset( $imported['settings'] ) ) {
			$summary_parts[] = 'settings';
		}
		$summary = implode( ', ', $summary_parts );
		if ( $total_skipped > 0 ) {
			$summary .= ' · ' . $total_skipped . ' skipped';
		}

		self::append_log(
			array(
				'type'    => 'import',
				'summary' => $summary,
				'status'  => $status,
			)
		);

		return new \WP_REST_Response(
			array(
				'imported' => $imported,
				'skipped'  => $skipped,
				'errors'   => $errors,
			),
			200
		);
	}

	/**
	 * Import tags, matching existing ones by name and type.
	 *
	 * A tag already on the site is skipped. With `$create` false, tags are only
	 * matched and nothing is written.
	 *
	 * Returns [imported_count, skipped_count, id_map], where id_map is
	 * type => [ exported_id => site_id ].
	 */
	private static function import_tags( array $tags, bool $create ): array {
		global $wpdb;
		$table    = $wpdb->prefix . 'fotogrids_tags';
		$imported = 0;
		$skipped  = 0;
		$id_map   = array();

		foreach ( $tags as $tag ) {
			$old_id = (int) ( $tag['id'] ?? 0 );
			$name   = sanitize_text_field( $tag['name'] ?? '' );
			$type   = sanitize_text_field( $tag['type'] ?? 'tag' );
			$slug   = sanitize_title( $tag['slug'] ?? $name );

			if ( empty( $name ) ) {
				++$skipped;
				continue;
			}

			$exists = (int) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE name = %s AND type = %s LIMIT 1',
					$table,
					$name,
					$type
				)
			);

			if ( $exists ) {
				$id_map[ $type ][ $old_id ] = $exists;
				++$skipped;
				continue;
			}

			if ( ! $create ) {
				continue;
			}

			$inserted = $wpdb->insert(
				$table,
				array(
					'type'        => $type,
					'name'        => $name,
					'slug'        => $slug,
					'meta'        => \FotoGrids\Metadata_Manager::prepare_imported_meta( $type, $tag['meta'] ?? null ),
					'usage_count' => 0,
				)
			);

			if ( ! $inserted ) {
				++$skipped;
				continue;
			}

			$id_map[ $type ][ $old_id ] = (int) $wpdb->insert_id;
			++$imported;
		}

		return array( $imported, $skipped, $id_map );
	}

	/**
	 * Import galleries or albums.
	 *
	 * $conflict_mode: 'skip' | 'overwrite' | 'duplicate'
	 *
	 * Returns [imported_count, skipped_count, old_id_to_new_id_map, written_ids],
	 * where written_ids lists the posts the import created or overwrote.
	 */
	private static function import_collections( array $posts, string $post_type, string $conflict_mode ): array {
		$imported = 0;
		$skipped  = 0;
		$id_map   = array();
		$written  = array();

		foreach ( $posts as $post_data ) {
			$old_id = (int) ( $post_data['id'] ?? 0 );
			$slug   = is_string( $post_data['slug'] ?? null ) ? sanitize_title( $post_data['slug'] ) : '';
			$title  = sanitize_text_field( $post_data['title'] ?? '' );
			$status = sanitize_key( $post_data['status'] ?? '' );
			$date   = is_string( $post_data['date'] ?? null ) ? $post_data['date'] : '';
			$meta   = is_array( $post_data['meta'] ?? null ) ? $post_data['meta'] : array();

			if ( ! in_array( $status, self::COLLECTION_STATUSES, true ) ) {
				$status = 'publish';
			}
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $date ) ) {
				$date = '';
			}

			// Drafts and pending collections usually have no slug, so they are matched on title and date.
			$existing = '' !== $slug
				? get_page_by_path( $slug, OBJECT, array( $post_type ) )
				: self::find_by_title_and_date( $title, $date, $post_type );

			if ( $existing ) {
				if ( 'skip' === $conflict_mode ) {
					$id_map[ $old_id ] = $existing->ID;
					++$skipped;
					continue;
				}
				if ( 'overwrite' === $conflict_mode ) {
					// Update the existing post's meta only; keep its ID.
					foreach ( $meta as $key => $value ) {
						update_post_meta( $existing->ID, $key, $value );
					}
					$id_map[ $old_id ] = $existing->ID;
					$written[]         = $existing->ID;
					++$imported;
					continue;
				}
				// 'duplicate' - fall through to insert with a new slug.
				if ( '' !== $slug ) {
					$slug = self::unique_slug( $slug, $post_type );
				}
			}

			$new_id = wp_insert_post(
				array(
					'post_type'   => $post_type,
					'post_title'  => $title,
					'post_name'   => $slug,
					'post_status' => $status,
					'post_date'   => $date,
				),
				true
			);

			if ( is_wp_error( $new_id ) ) {
				++$skipped;
				continue;
			}

			foreach ( $meta as $key => $value ) {
				update_post_meta( $new_id, $key, $value );
			}

			if ( Post_Types::GALLERY === $post_type ) {
				do_action( Actions_Gallery::IMPORTED, $new_id, $old_id );
			}

			$id_map[ $old_id ] = $new_id;
			$written[]         = $new_id;
			++$imported;
		}

		return array( $imported, $skipped, $id_map, $written );
	}

	/** Import gallery-album relationship rows, remapping IDs. */
	private static function import_gallery_albums( array $rows, array $gallery_map, array $album_map ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'fotogrids_gallery_albums';

		foreach ( $rows as $row ) {
			$gallery_id = $gallery_map[ (int) $row['gallery_id'] ] ?? 0;
			$album_id   = $album_map[ (int) $row['album_id'] ] ?? 0;

			if ( ! $gallery_id || ! $album_id ) {
				continue;
			}

			$exists = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE gallery_id = %d AND album_id = %d LIMIT 1',
					$table,
					$gallery_id,
					$album_id
				)
			);

			if ( ! $exists ) {
				$wpdb->insert(
					$table,
					array(
						'gallery_id' => $gallery_id,
						'album_id'   => $album_id,
						'position'   => (int) ( $row['position'] ?? 0 ),
					)
				);
			}
		}
	}

	/**
	 * Attachment IDs this site already uses as items: those with an item row or
	 * in any gallery.
	 *
	 * @since 1.2.0
	 * @return array<int, true> Keyed by attachment ID.
	 */
	private static function known_item_ids(): array {
		global $wpdb;

		$with_row = $wpdb->get_col( $wpdb->prepare( 'SELECT DISTINCT attachment_id FROM %i', Item_Meta::table() ) );
		$in_lists = Gallery_Repository::all_item_ids( array_values( get_post_stati() ) );

		return array_fill_keys( array_map( 'intval', array_merge( (array) $with_row, $in_lists ) ), true );
	}

	/**
	 * Write an item's exported text onto its attachment. Empty values leave the
	 * attachment's own value in place.
	 *
	 * @since 1.2.0
	 * @param int                  $attachment_id Attachment ID.
	 * @param array<string, mixed> $item          Exported item entry.
	 * @return void
	 */
	private static function import_item_text( int $attachment_id, array $item ): void {
		$text = array();
		foreach ( array( 'title', 'caption', 'description', 'alt' ) as $key ) {
			$text[ $key ] = isset( $item[ $key ] ) && is_scalar( $item[ $key ] ) ? (string) $item[ $key ] : '';
		}

		$post = array_filter(
			array(
				'post_title'   => sanitize_text_field( $text['title'] ),
				'post_excerpt' => self::import_rich_text( $text['caption'], 'caption', $attachment_id ),
				'post_content' => self::import_rich_text( $text['description'], 'description', $attachment_id ),
			),
			'strlen'
		);
		if ( $post ) {
			$post['ID'] = $attachment_id;
			wp_update_post( wp_slash( $post ) );
		}

		$alt = sanitize_text_field( $text['alt'] );
		if ( '' !== $alt ) {
			update_post_meta( $attachment_id, '_wp_attachment_image_alt', wp_slash( $alt ) );
		}
	}

	/**
	 * Apply the caption and description save rules to an imported value.
	 *
	 * @since 1.3.0
	 * @param string $value         Imported value.
	 * @param string $field         'caption' or 'description'.
	 * @param int    $attachment_id Attachment ID.
	 * @return string
	 */
	private static function import_rich_text( string $value, string $field, int $attachment_id ): string {
		if ( '' === $value ) {
			return '';
		}
		return \FotoGrids\Formatted_Text\Formatted_Text::sanitize_for_save(
			$value,
			array(
				'field'   => $field,
				'item_id' => $attachment_id,
				'source'  => 'import',
			)
		);
	}

	/**
	 * Import item rows.
	 *
	 * An entry carrying item data creates the item's row. An item the site did not
	 * use before the import also receives the entry's title, caption, description
	 * and alt text.
	 *
	 * @param array<int, array<string, mixed>> $items          Exported item entries.
	 * @param array<int, int>                  $gallery_id_map Old gallery ID => new gallery ID.
	 * @param array<int, true>                 $known          Attachment IDs already used as items.
	 * @return array{0: int, 1: int, 2: array<string, array<string, int>>} Imported and skipped
	 *         counts, and both again split into images and videos.
	 */
	private static function import_items( array $items, array $gallery_id_map, array $known ): array {
		$imported = 0;
		$skipped  = 0;
		$lists    = array();
		$kinds    = array(
			'imported' => array(
				'images' => 0,
				'videos' => 0,
			),
			'skipped'  => array(
				'images' => 0,
				'videos' => 0,
			),
		);

		foreach ( $items as $item ) {
			// An empty or null element in an XML file parses to an array.
			$item          = array_map(
				static function ( $value ) {
					return is_array( $value ) ? null : $value;
				},
				(array) $item
			);
			$attachment_id = (int) ( $item['attachment_id'] ?? 0 );
			$kind          = self::media_kind( $item, $attachment_id );

			if ( ! $attachment_id || get_post_type( $attachment_id ) !== 'attachment' ) {
				++$skipped;
				++$kinds['skipped'][ $kind ];
				continue;
			}

			$old_gallery = (int) ( $item['gallery_id'] ?? 0 );
			if ( $old_gallery > 0 && isset( $gallery_id_map[ $old_gallery ] ) ) {
				$lists[ (int) $gallery_id_map[ $old_gallery ] ][] = array( (int) ( $item['position'] ?? 0 ), $attachment_id );
			}

			if ( null !== Item_Meta::get( $attachment_id ) ) {
				++$skipped;
				++$kinds['skipped'][ $kind ];
				continue;
			}

			$fields = array_intersect_key(
				array(
					'item_type'    => sanitize_text_field( $item['item_type'] ?? 'image' ),
					'credit'       => sanitize_text_field( $item['credit'] ?? '' ),
					'location'     => sanitize_text_field( $item['location'] ?? '' ),
					'external_url' => esc_url_raw( $item['external_url'] ?? '' ),
					'link_target'  => sanitize_text_field( $item['link_target'] ?? '' ),
					'exif_data'    => $item['exif_data'] ?? null,
					'custom_data'  => $item['custom_data'] ?? null,
				),
				$item
			);

			$saved = $fields ? Item_Meta::save( $attachment_id, $fields ) : ! isset( $known[ $attachment_id ] );

			if ( $saved ) {
				if ( ! isset( $known[ $attachment_id ] ) ) {
					self::import_item_text( $attachment_id, $item );
				}
				++$imported;
				++$kinds['imported'][ $kind ];
			} else {
				++$skipped;
				++$kinds['skipped'][ $kind ];
			}
		}

		foreach ( $lists as $gallery_id => $entries ) {
			usort(
				$entries,
				static function ( array $a, array $b ): int {
					return $a[0] - $b[0];
				}
			);
			Item_Meta_Consolidation::restore_list( $gallery_id, array_column( $entries, 1 ) );
		}

		return array( $imported, $skipped, $kinds );
	}

	/**
	 * Whether an exported item entry is an image or a video.
	 *
	 * Reads the entry's `media_type`, then the attachment on this site, then the
	 * entry's item type.
	 *
	 * @since 1.3.0
	 * @param array<string, mixed> $item          Exported item entry.
	 * @param int                  $attachment_id Attachment ID on this site, or 0.
	 * @return string `images` or `videos`.
	 */
	private static function media_kind( array $item, int $attachment_id = 0 ): string {
		$type = $item['media_type'] ?? '';
		if ( 'image' === $type || 'video' === $type ) {
			return $type . 's';
		}
		if ( $attachment_id > 0 && 'attachment' === get_post_type( $attachment_id ) ) {
			return wp_attachment_is( 'video', $attachment_id ) ? 'videos' : 'images';
		}

		return false !== strpos( (string) ( $item['item_type'] ?? '' ), 'video' ) ? 'videos' : 'images';
	}

	/**
	 * Whether a file's item entries say which are images and which are videos.
	 *
	 * @since 1.3.0
	 * @param array<int, mixed> $items Exported item entries.
	 * @return bool
	 */
	private static function has_media_types( array $items ): bool {
		if ( empty( $items ) ) {
			return true;
		}
		foreach ( $items as $item ) {
			if ( isset( ( (array) $item )['media_type'] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Recreate the exported video embeds in each gallery the import wrote, and
	 * point the gallery's item list at them.
	 *
	 * An embed already on this site that shows the same video and belongs to no
	 * other gallery keeps its ID and takes the file's data. Every other exported
	 * embed in the list is created as a new embed owned by that gallery, and no
	 * other list keeps the new embed's ID.
	 *
	 * @since 1.3.0
	 * @param array<int, mixed> $embeds      Exported embed entries.
	 * @param int[]             $gallery_ids Galleries the import created or overwrote.
	 * @return array{0: int, 1: int} Embeds created or updated, and exported embeds no
	 *                               written gallery lists.
	 */
	private static function import_embeds( array $embeds, array $gallery_ids ): array {
		$by_old_id = array();
		foreach ( $embeds as $embed ) {
			$embed = self::sanitize_embed( (array) $embed );
			if ( null !== $embed ) {
				$by_old_id[ $embed['id'] ] = $embed;
			}
		}

		$created = array();
		$updated = 0;
		$used    = array();
		$lists   = array();

		foreach ( array_unique( array_map( 'intval', $gallery_ids ) ) as $gallery_id ) {
			$item_ids = Gallery_Repository::get_item_ids( $gallery_id );
			$placed   = array();

			foreach ( $item_ids as $index => $item_id ) {
				if ( ! isset( $by_old_id[ $item_id ] ) ) {
					continue;
				}
				$used[ $item_id ] = true;
				if ( ! isset( $created[ $item_id ] ) && self::is_same_embed( $item_id, $gallery_id, $by_old_id[ $item_id ] ) ) {
					Embed_Store::update( $item_id, $by_old_id[ $item_id ] );
					++$updated;
					continue;
				}

				$new_id = Embed_Store::create( $by_old_id[ $item_id ] );
				if ( $new_id > 0 ) {
					$created[ $new_id ] = true;
				}
				$item_ids[ $index ] = $new_id;
				$placed[ $index ]   = true;
			}

			$lists[ $gallery_id ] = array( $item_ids, $placed );
		}

		// A list can still hold an ID from the exporting site that a new embed has just taken.
		foreach ( $lists as $gallery_id => $list ) {
			$kept = array();
			foreach ( $list[0] as $index => $item_id ) {
				if ( $item_id > 0 && ( isset( $list[1][ $index ] ) || ! isset( $created[ $item_id ] ) ) ) {
					$kept[] = $item_id;
				}
			}

			if ( Gallery_Repository::get_item_ids( $gallery_id ) !== $kept ) {
				Gallery_Repository::set_item_ids( $gallery_id, $kept );
			}
		}

		return array( count( $created ) + $updated, count( $by_old_id ) - count( $used ) );
	}

	/**
	 * Clean an exported embed entry into Embed_Store data.
	 *
	 * @since 1.3.0
	 * @param array<string, mixed> $embed Exported embed entry.
	 * @return array<string, mixed>|null Embed data with its exported `id`, or null when unusable.
	 */
	private static function sanitize_embed( array $embed ): ?array {
		$old_id    = (int) ( $embed['id'] ?? 0 );
		$item_type = sanitize_key( (string) ( $embed['item_type'] ?? '' ) );
		$url       = esc_url_raw( is_string( $embed['url'] ?? null ) ? $embed['url'] : '' );

		if ( $old_id <= 0 || '' === $url || ! in_array( $item_type, array( 'video_youtube', 'video_vimeo' ), true ) ) {
			return null;
		}

		$settings = is_array( $embed['settings'] ?? null ) ? $embed['settings'] : array();
		foreach ( $settings as $key => $value ) {
			if ( 'false' === $value ) {
				$settings[ $key ] = false;
			}
		}

		$poster_id  = (int) ( $embed['poster_id'] ?? 0 );
		$poster_url = is_string( $embed['poster_url'] ?? null ) ? $embed['poster_url'] : '';
		if ( $poster_id > 0 && 'attachment' !== get_post_type( $poster_id ) ) {
			$poster_id = 0;
			if ( '' === $poster_url && is_string( $embed['poster_src'] ?? null ) ) {
				$poster_url = $embed['poster_src'];
			}
		}

		return array(
			'id'            => $old_id,
			'item_type'     => $item_type,
			'video_id'      => sanitize_text_field( is_scalar( $embed['video_id'] ?? null ) ? (string) $embed['video_id'] : '' ),
			'url'           => $url,
			'caption'       => sanitize_text_field( is_scalar( $embed['caption'] ?? null ) ? (string) $embed['caption'] : '' ),
			'thumbnail_url' => esc_url_raw( is_string( $embed['thumbnail_url'] ?? null ) ? $embed['thumbnail_url'] : '' ),
			'settings'      => Embed_Data::sanitize_embed_settings( $settings, $item_type ),
			'poster_id'     => $poster_id,
			'poster_url'    => esc_url_raw( $poster_url ),
		);
	}

	/**
	 * Whether an embed on this site is the exported embed, already owned by the gallery.
	 *
	 * @since 1.3.0
	 * @param int                  $item_id    Item ID from the gallery's list.
	 * @param int                  $gallery_id Gallery post ID.
	 * @param array<string, mixed> $exported   Sanitized exported embed.
	 * @return bool
	 */
	private static function is_same_embed( int $item_id, int $gallery_id, array $exported ): bool {
		$existing = Embed_Store::get( $item_id );
		if ( null === $existing || $existing['item_type'] !== $exported['item_type'] || $existing['video_id'] !== $exported['video_id'] ) {
			return false;
		}

		return array() === array_diff( Gallery_Repository::find_galleries_for_item( $item_id ), array( $gallery_id ) );
	}

	/**
	 * Import item_metadata (tag/person/location join rows).
	 *
	 * Each row's metadata_id is translated through `$tag_id_map` from
	 * import_tags(). Rows whose tag or attachment is not on this site are
	 * skipped, and every linked tag's usage count is recomputed.
	 */
	private static function import_item_metadata( array $rows, array $tag_id_map ): void {
		global $wpdb;
		$table  = $wpdb->prefix . 'fotogrids_item_metadata';
		$linked = array();

		foreach ( $rows as $row ) {
			$attachment_id = (int) ( $row['attachment_id'] ?? 0 );
			$metadata_type = sanitize_text_field( $row['metadata_type'] ?? '' );
			$metadata_id   = (int) ( $tag_id_map[ $metadata_type ][ (int) ( $row['metadata_id'] ?? 0 ) ] ?? 0 );

			if ( ! $attachment_id || ! $metadata_type || ! $metadata_id || 'attachment' !== get_post_type( $attachment_id ) ) {
				continue;
			}

			$linked[ $metadata_type ][ $metadata_id ] = true;

			$exists = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM %i WHERE attachment_id = %d AND metadata_type = %s AND metadata_id = %d LIMIT 1',
					$table,
					$attachment_id,
					$metadata_type,
					$metadata_id
				)
			);

			if ( ! $exists ) {
				$wpdb->insert(
					$table,
					array(
						'attachment_id' => $attachment_id,
						'metadata_type' => $metadata_type,
						'metadata_id'   => $metadata_id,
					)
				);
			}
		}

		foreach ( $linked as $type => $ids ) {
			foreach ( array_keys( $ids ) as $id ) {
				\FotoGrids\Metadata_Manager::recompute_usage_count( $type, $id );
			}
		}
	}

	/**
	 * Import plugin settings through the sanitizers their settings screens use.
	 * The usage-data sharing choice is never imported.
	 */
	private static function import_settings( array $settings ): void {
		if ( isset( $settings['media'] ) && is_array( $settings['media'] ) ) {
			\FotoGrids\Image_Size_Manager::save_plugin_size_settings( $settings['media'] );
		}

		if ( isset( $settings['collection_defaults'] ) && is_array( $settings['collection_defaults'] ) ) {
			foreach ( Collection_Defaults_Store::TYPES as $type ) {
				if ( isset( $settings['collection_defaults'][ $type ] ) && is_array( $settings['collection_defaults'][ $type ] ) ) {
					Collection_Defaults_Store::replace(
						$type,
						Plugin_Settings_Store::sanitize_collection_defaults( $settings['collection_defaults'][ $type ], $type )
					);
				}
			}
		} elseif ( isset( $settings['gallery_defaults'] ) && is_array( $settings['gallery_defaults'] ) ) {
			// Files exported before 1.3.0 hold one map for both types.
			foreach ( Collection_Defaults_Store::TYPES as $type ) {
				Collection_Defaults_Store::replace(
					$type,
					Plugin_Settings_Store::sanitize_collection_defaults( $settings['gallery_defaults'], $type )
				);
			}
		}

		$flags = array(
			'autosave'                   => 'fotogrids_autosave',
			'preserve_data_on_uninstall' => 'fotogrids_preserve_data_on_uninstall',
		);

		foreach ( $flags as $export_key => $option_key ) {
			if ( array_key_exists( $export_key, $settings ) ) {
				Plugin_Settings_Store::save_bool( $option_key, Plugin_Settings_Store::truthy( $settings[ $export_key ] ) );
			}
		}
	}

	/**
	 * Import statistics. Remaps gallery/album IDs using the provided maps.
	 * Items are matched by attachment_id which is site-local, so item stats
	 * are imported as-is when the attachment exists.
	 * Returns [imported_count].
	 */
	private static function import_statistics( array $rows, array $gallery_map, array $album_map ): array {
		global $wpdb;
		$table    = $wpdb->prefix . 'fotogrids_statistics';
		$imported = 0;

		foreach ( $rows as $row ) {
			$object_type = sanitize_text_field( $row['object_type'] ?? '' );
			$object_id   = (int) ( $row['object_id'] ?? 0 );

			if ( 'gallery' === $object_type ) {
				$object_id = $gallery_map[ $object_id ] ?? 0;
			} elseif ( 'album' === $object_type ) {
				$object_id = $album_map[ $object_id ] ?? 0;
			}

			if ( ! $object_id || ! in_array( $object_type, array( 'gallery', 'album', 'item' ), true ) ) {
				continue;
			}

			$wpdb->replace(
				$table,
				array(
					'object_type' => $object_type,
					'object_id'   => $object_id,
					'views'       => (int) ( $row['views'] ?? 0 ),
					'shares'      => (int) ( $row['shares'] ?? 0 ),
					'last_viewed' => sanitize_text_field( $row['last_viewed'] ?? current_time( 'mysql', true ) ),
				)
			);
			++$imported;
		}

		return array( $imported );
	}

	/**
	 * Import templates into the current admin user's meta.
	 * Returns [imported_count].
	 */
	private static function import_templates( array $templates ): array {
		$user_id      = get_current_user_id();
		$raw          = get_user_meta( $user_id, 'fotogrids_user_templates', true );
		$existing     = $raw ? ( json_decode( $raw, true ) ?: array() ) : array();
		$existing_ids = array_column( $existing, 'id' );
		$imported     = 0;

		foreach ( $templates as $tpl ) {
			unset( $tpl['_user_id'] ); // Export-only field.
			$id = $tpl['id'] ?? null;
			if ( $id && in_array( $id, $existing_ids, true ) ) {
				continue;
			}
			$existing[] = $tpl;
			++$imported;
		}

		update_user_meta( $user_id, 'fotogrids_user_templates', wp_json_encode( $existing ) );
		return array( $imported );
	}

	/**
	 * Find a gallery or album with exactly this title and date.
	 *
	 * @param  string $title     Post title.
	 * @param  string $date      Post date, Y-m-d H:i:s in site time.
	 * @param  string $post_type Collection post type.
	 * @return \WP_Post|null
	 */
	private static function find_by_title_and_date( string $title, string $date, string $post_type ): ?\WP_Post {
		if ( '' === $date ) {
			return null;
		}

		$candidates = get_posts(
			array(
				'post_type'      => $post_type,
				'post_status'    => self::COLLECTION_STATUSES,
				'title'          => $title,
				'posts_per_page' => -1,
				'orderby'        => 'ID',
				'order'          => 'ASC',
			)
		);

		foreach ( $candidates as $candidate ) {
			if ( $candidate->post_date === $date ) {
				return $candidate;
			}
		}

		return null;
	}

	/** Generate a slug that doesn't collide with any existing post of the given type. */
	private static function unique_slug( string $base, string $post_type ): string {
		$slug    = $base;
		$counter = 1;
		while ( get_page_by_path( $slug, OBJECT, array( $post_type ) ) ) {
			$slug = $base . '-' . $counter;
			++$counter;
		}
		return $slug;
	}

	/**
	 * Append an entry to the operation log (newest first, capped at LOG_MAX).
	 */
	private static function append_log( array $entry ): void {
		$log = get_option( self::LOG_OPTION, array() );
		if ( ! is_array( $log ) ) {
			$log = array();
		}

		array_unshift(
			$log,
			array_merge(
				array(
					'id'   => wp_generate_uuid4(),
					'date' => current_time( 'c' ),
				),
				$entry
			)
		);

		if ( count( $log ) > self::LOG_MAX ) {
			$log = array_slice( $log, 0, self::LOG_MAX );
		}

		update_option( self::LOG_OPTION, $log, false );
	}

	// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
}
