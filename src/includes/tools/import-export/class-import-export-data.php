<?php
namespace FotoGrids\Tools\ImportExport;

use FotoGrids\Hooks\Actions_Gallery;

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

	/*
	 * ---------------------------------------------------------------------
	 * PHPCS: WPDB direct-query sniffs disabled for this class.
	 * ---------------------------------------------------------------------
	 * Import_Export_Data is the admin-only, user-triggered REST tool for
	 * exporting/importing the custom fotogrids_* tables. The WPDB sniffs
	 * below are suppressed class-wide:
	 *
	 *  - DirectDatabaseQuery.DirectQuery: these are custom tables with no
	 *    WP_Query / core API equivalent. Several flagged statements are also
	 *    transaction control (START TRANSACTION / COMMIT / ROLLBACK), which
	 *    are not queries at all.
	 *
	 *  - DirectDatabaseQuery.NoCaching: this tool runs on explicit admin
	 *    action (export/import), not on any render or request hot path, so
	 *    object caching is a non-goal here - not deferred debt.
	 *
	 *  - PreparedSQL.InterpolatedNotPrepared /
	 *    Security.DirectDB.UnescapedDBParameter: every interpolated table
	 *    name is built as `$wpdb->prefix . 'fotogrids_*'` (a trusted,
	 *    hardcoded literal - WP placeholders cannot bind table identifiers).
	 *    All user-supplied *values* are passed through $wpdb->prepare().
	 * ---------------------------------------------------------------------
	 */
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery
	// phpcs:disable WordPress.DB.DirectDatabaseQuery.NoCaching
	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	// phpcs:disable WordPress.Security.DirectDB.UnescapedDBParameter
	// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter

	const LOG_OPTION = 'fotogrids_import_export_log';
	const LOG_MAX    = 50;

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
				$type_counts[] = count( $data[ $key ] ) . ' ' . $key;
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
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
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
					'post_type'      => 'fotogrids_gallery',
					'post_status'    => 'publish',
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
					'post_type'      => 'fotogrids_album',
					'post_status'    => 'publish',
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
				"SELECT gallery_id, album_id, position FROM {$table} ORDER BY album_id, position",
				ARRAY_A
			) ?: array();
		}

		if ( in_array( 'items', $include_types, true ) ) {
			$table         = $wpdb->prefix . 'fotogrids_item_meta';
			$data['items'] = $wpdb->get_results(
				"SELECT * FROM {$table} ORDER BY gallery_id, position",
				ARRAY_A
			) ?: array();

			$meta_table            = $wpdb->prefix . 'fotogrids_item_metadata';
			$data['item_metadata'] = $wpdb->get_results(
				"SELECT * FROM {$meta_table}",
				ARRAY_A
			) ?: array();
		}

		if ( in_array( 'tags', $include_types, true ) ) {
			$table        = $wpdb->prefix . 'fotogrids_tags';
			$data['tags'] = $wpdb->get_results(
				"SELECT * FROM {$table} ORDER BY type, name",
				ARRAY_A
			) ?: array();
		}

		if ( in_array( 'settings', $include_types, true ) ) {
			$data['settings'] = array(
				'media'                      => get_option( 'fotogrids_media_settings', array() ),
				'gallery_defaults'           => get_option( 'fotogrids_gallery_defaults', array() ),
				'autosave'                   => get_option( 'fotogrids_autosave', false ),
				'share_statistics'           => get_option( 'fotogrids_share_statistics', false ),
				'preserve_data_on_uninstall' => get_option( 'fotogrids_preserve_data_on_uninstall', true ),
			);
		}

		if ( in_array( 'statistics', $include_types, true ) ) {
			$table              = $wpdb->prefix . 'fotogrids_statistics';
			$data['statistics'] = $wpdb->get_results(
				"SELECT object_type, object_id, views, shares, last_viewed FROM {$table}",
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
		foreach ( array( 'galleries', 'albums', 'items', 'tags', 'item_metadata', 'templates', 'statistics' ) as $key ) {
			if ( isset( $data[ $key ] ) && is_array( $data[ $key ] ) ) {
				$contents[ $key ] = count( $data[ $key ] );
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

		$wpdb->query( 'START TRANSACTION' );

		try {
			if ( in_array( 'tags', $include, true ) && ! empty( $data['tags'] ) ) {
				[ $imp, $skip ]   = self::import_tags( $data['tags'] );
				$imported['tags'] = $imp;
				$skipped['tags']  = $skip;
			}

			$gallery_id_map = array(); // old_id => new_id
			if ( in_array( 'galleries', $include, true ) && ! empty( $data['galleries'] ) ) {
				[ $imp, $skip, $map ]  = self::import_collections(
					$data['galleries'],
					'fotogrids_gallery',
					$options['galleries']
				);
				$imported['galleries'] = $imp;
				$skipped['galleries']  = $skip;
				$gallery_id_map        = $map;
			}

			$album_id_map = array();
			if ( in_array( 'albums', $include, true ) && ! empty( $data['albums'] ) ) {
				[ $imp, $skip, $map ] = self::import_collections(
					$data['albums'],
					'fotogrids_album',
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
			if ( in_array( 'items', $include, true ) && ! empty( $data['items'] ) ) {
				[ $imp, $skip ]    = self::import_items( $data['items'], $gallery_id_map );
				$imported['items'] = $imp;
				$skipped['items']  = $skip;
			}

			// Item metadata is imported after both items and tags exist.
			if ( in_array( 'items', $include, true ) && ! empty( $data['item_metadata'] ) ) {
				self::import_item_metadata( $data['item_metadata'] );
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
	 * Import tags. Returns [imported_count, skipped_count].
	 * Skips tags that already exist (same name + type). Usage counts not imported.
	 */
	private static function import_tags( array $tags ): array {
		global $wpdb;
		$table    = $wpdb->prefix . 'fotogrids_tags';
		$imported = 0;
		$skipped  = 0;

		foreach ( $tags as $tag ) {
			$name = sanitize_text_field( $tag['name'] ?? '' );
			$type = sanitize_text_field( $tag['type'] ?? 'tag' );
			$slug = sanitize_title( $tag['slug'] ?? $name );

			if ( empty( $name ) ) {
				++$skipped;
				continue;
			}

			$exists = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE name = %s AND type = %s LIMIT 1",
					$name,
					$type
				)
			);

			if ( $exists ) {
				++$skipped;
				continue;
			}

			$wpdb->insert(
				$table,
				array(
					'type'        => $type,
					'name'        => $name,
					'slug'        => $slug,
					'meta'        => $tag['meta'] ?? null,
					'usage_count' => 0,
				)
			);
			++$imported;
		}

		return array( $imported, $skipped );
	}

	/**
	 * Import galleries or albums.
	 *
	 * $conflict_mode: 'skip' | 'overwrite' | 'duplicate'
	 *
	 * Returns [imported_count, skipped_count, old_id_to_new_id_map].
	 */
	private static function import_collections( array $posts, string $post_type, string $conflict_mode ): array {
		$imported = 0;
		$skipped  = 0;
		$id_map   = array();

		foreach ( $posts as $post_data ) {
			$old_id = (int) ( $post_data['id'] ?? 0 );
			$slug   = sanitize_title( $post_data['slug'] ?? '' );
			$title  = sanitize_text_field( $post_data['title'] ?? '' );
			$meta   = is_array( $post_data['meta'] ?? null ) ? $post_data['meta'] : array();

			$existing = get_page_by_path( $slug, OBJECT, $post_type );

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
					++$imported;
					continue;
				}
				// 'duplicate' - fall through to insert with a new slug.
				$slug = self::unique_slug( $slug, $post_type );
			}

			$new_id = wp_insert_post(
				array(
					'post_type'   => $post_type,
					'post_title'  => $title,
					'post_name'   => $slug,
					'post_status' => 'publish',
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

			if ( 'fotogrids_gallery' === $post_type ) {
				do_action( Actions_Gallery::IMPORTED, $new_id, $old_id );
			}

			$id_map[ $old_id ] = $new_id;
			++$imported;
		}

		return array( $imported, $skipped, $id_map );
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
					"SELECT id FROM {$table} WHERE gallery_id = %d AND album_id = %d LIMIT 1",
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
	 * Import gallery items.
	 * Items whose attachment_id doesn't exist on this site are skipped.
	 * Returns [imported_count, skipped_count].
	 */
	private static function import_items( array $items, array $gallery_id_map ): array {
		global $wpdb;
		$table    = $wpdb->prefix . 'fotogrids_item_meta';
		$imported = 0;
		$skipped  = 0;

		foreach ( $items as $item ) {
			$attachment_id = (int) ( $item['attachment_id'] ?? 0 );
			$old_gallery   = (int) ( $item['gallery_id'] ?? 0 );
			$gallery_id    = $gallery_id_map[ $old_gallery ] ?? $old_gallery;

			if ( ! $attachment_id || get_post_type( $attachment_id ) !== 'attachment' ) {
				++$skipped;
				continue;
			}

			// Skip if this exact attachment is already in this gallery.
			$exists = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE attachment_id = %d AND gallery_id = %d LIMIT 1",
					$attachment_id,
					$gallery_id
				)
			);
			if ( $exists ) {
				++$skipped;
				continue;
			}

			$wpdb->insert(
				$table,
				array(
					'attachment_id' => $attachment_id,
					'gallery_id'    => $gallery_id,
					'position'      => (int) ( $item['position'] ?? 0 ),
					'item_type'     => sanitize_text_field( $item['item_type'] ?? 'image' ),
					'caption'       => sanitize_text_field( $item['caption'] ?? '' ),
					'description'   => wp_kses_post( $item['description'] ?? '' ),
					'credit'        => sanitize_text_field( $item['credit'] ?? '' ),
					'location'      => sanitize_text_field( $item['location'] ?? '' ),
					'external_url'  => esc_url_raw( $item['external_url'] ?? '' ),
					'link_target'   => sanitize_text_field( $item['link_target'] ?? '' ),
					'exif_data'     => is_array( $item['exif_data'] ?? null )
						? wp_json_encode( $item['exif_data'] )
						: ( $item['exif_data'] ?? null ),
					'custom_data'   => is_array( $item['custom_data'] ?? null )
						? wp_json_encode( $item['custom_data'] )
						: ( $item['custom_data'] ?? null ),
				)
			);
			++$imported;
		}

		return array( $imported, $skipped );
	}

	/** Import item_metadata (tag/person/location join rows). */
	private static function import_item_metadata( array $rows ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'fotogrids_item_metadata';

		foreach ( $rows as $row ) {
			$attachment_id = (int) ( $row['attachment_id'] ?? 0 );
			$metadata_type = sanitize_text_field( $row['metadata_type'] ?? '' );
			$metadata_id   = (int) ( $row['metadata_id'] ?? 0 );

			if ( ! $attachment_id || ! $metadata_type || ! $metadata_id ) {
				continue;
			}

			$exists = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE attachment_id = %d AND metadata_type = %s AND metadata_id = %d LIMIT 1",
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
	}

	/** Import plugin settings. */
	private static function import_settings( array $settings ): void {
		$map = array(
			'media'                      => 'fotogrids_media_settings',
			'gallery_defaults'           => 'fotogrids_gallery_defaults',
			'autosave'                   => 'fotogrids_autosave',
			'share_statistics'           => 'fotogrids_share_statistics',
			'preserve_data_on_uninstall' => 'fotogrids_preserve_data_on_uninstall',
		);

		foreach ( $map as $export_key => $option_key ) {
			if ( array_key_exists( $export_key, $settings ) ) {
				update_option( $option_key, $settings[ $export_key ] );
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
					'last_viewed' => sanitize_text_field( $row['last_viewed'] ?? current_time( 'mysql' ) ),
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

	/** Generate a slug that doesn't collide with any existing post of the given type. */
	private static function unique_slug( string $base, string $post_type ): string {
		$slug    = $base;
		$counter = 1;
		while ( get_page_by_path( $slug, OBJECT, $post_type ) ) {
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

	// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery
	// phpcs:enable WordPress.DB.DirectDatabaseQuery.NoCaching
	// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	// phpcs:enable WordPress.Security.DirectDB.UnescapedDBParameter
	// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter
}
