<?php
namespace FotoGrids\Tools\RegenerateThumbnails;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Regenerate Thumbnails Data
 *
 * REST handler methods for the Regenerate Thumbnails tool.
 *
 * @since 1.0.0
 */
class Regenerate_Thumbnails_Data {

	/**
	 * Maximum number of attachments returned per page from get_status().
	 *
	 * Keeps response size and admin-page render time bounded on big sites.
	 */
	const PAGE_SIZE = 50;

	/**
	 * GET /fotogrids/v1/admin/tools/regenerate-thumbnails/status
	 *
	 * Returns per-attachment derivative status for fotogrids_thumbnail,
	 * fotogrids_full, and any registered custom FotoGrids sizes.
	 *
	 * Query params:
	 *   - include_unused (bool): when 1, list every image attachment in the
	 *                            media library. Otherwise only items used in
	 *                            FotoGrids galleries.
	 *   - page           (int):  1-indexed page number. Default 1.
	 *   - per_page       (int):  page size. Default PAGE_SIZE, capped at 200.
	 *
	 * @param  \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public static function get_status( \WP_REST_Request $request ): \WP_REST_Response {
		$include_unused = (bool) $request->get_param( 'include_unused' );
		$page           = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );
		$per_page       = (int) ( $request->get_param( 'per_page' ) ?: self::PAGE_SIZE );
		$per_page       = max( 1, min( 200, $per_page ) );

		$plugin_sizes = [
			\FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL,
			\FotoGrids\Image_Size_Manager::SLUG_FULL,
			\FotoGrids\Image_Size_Manager::SLUG_FULL_MOBILE,
			\FotoGrids\Image_Size_Manager::SLUG_MASONRY,
			\FotoGrids\Image_Size_Manager::SLUG_JUSTIFIED,
		];
		$custom_sizes = array_keys( \FotoGrids\Image_Size_Manager::get_custom_sizes() );
		$other_sizes  = self::get_other_registered_sizes( $plugin_sizes, $custom_sizes );

		$all_slugs = array_merge( $plugin_sizes, $custom_sizes, $other_sizes );

		[ $attachment_ids, $total ] = self::collect_attachment_ids( $include_unused, $page, $per_page );

		// Look up which attachment IDs are used in galleries so we can mark
		// unused rows in the table when include_unused is on.
		$used_ids = $include_unused ? self::get_used_attachment_ids() : [];

		// Per-attachment set of layout IDs used by the galleries containing it.
		// Lets the client grey out layout-specific size rows (Masonry/Justified)
		// for attachments whose galleries don't use that layout.
		$layouts_by_attachment = self::get_layouts_by_attachment();

		$items = [];
		foreach ( $attachment_ids as $attachment_id ) {
			$attachment_id   = (int) $attachment_id;
			$attachment_post = get_post( $attachment_id );
			if ( ! $attachment_post ) {
				continue;
			}

			$size_statuses = [];
			foreach ( $all_slugs as $slug ) {
				$data                   = image_get_intermediate_size( $attachment_id, $slug );
				$size_statuses[ $slug ] = [
					'exists' => ( $data !== false && ! empty( $data['file'] ) ),
					'width'  => $data['width']  ?? null,
					'height' => $data['height'] ?? null,
				];
			}

			// Orphan-safe: an attachment in no FotoGrids gallery is treated as
			// "uses every layout" so its rows aren't greyed out misleadingly.
			$layouts_used = $layouts_by_attachment[ $attachment_id ]
				?? [ 'grid', 'masonry', 'justified' ];

			$items[] = [
				'attachment_id' => $attachment_id,
				'title'         => get_the_title( $attachment_id ),
				'filename'      => basename( get_attached_file( $attachment_id ) ?: '' ),
				'thumb_url'     => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ) ?: '',
				'sizes'         => $size_statuses,
				'in_gallery'    => $include_unused ? in_array( $attachment_id, $used_ids, true ) : true,
				'layouts_used'  => array_values( $layouts_used ),
			];
		}

		return rest_ensure_response( [
			'items'        => $items,
			'plugin_sizes' => $plugin_sizes,
			'custom_sizes' => $custom_sizes,
			'other_sizes'  => $other_sizes,
			'page'         => $page,
			'per_page'     => $per_page,
			'total'        => $total,
			'total_pages'  => (int) ceil( $total / $per_page ),
		] );
	}

	/**
	 * POST /fotogrids/v1/admin/tools/regenerate-thumbnails/regenerate
	 *
	 * Regenerates image derivatives for a single attachment, and returns the
	 * resulting per-size status along with an inferred reason for every size
	 * that did NOT get generated (e.g. "source smaller than target").
	 *
	 * @param  \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function regenerate_attachment( \WP_REST_Request $request ) {
		$attachment_id = (int) $request->get_param( 'attachment_id' );

		$attachment_post = get_post( $attachment_id );
		if ( ! $attachment_post || $attachment_post->post_type !== 'attachment' ) {
			return new \WP_Error(
				'invalid_attachment',
				__( 'Attachment not found.', 'fotogrids' ),
				[ 'status' => 404 ]
			);
		}

		$file = get_attached_file( $attachment_id );
		if ( ! $file || ! file_exists( $file ) ) {
			return new \WP_Error(
				'file_missing',
				__( 'Attachment file not found on disk.', 'fotogrids' ),
				[ 'status' => 422 ]
			);
		}

		// Capture original source dimensions BEFORE regenerating so we can
		// infer reasons for missing sizes (most common: source is too small).
		$source_dims = self::get_source_dimensions( $attachment_id, $file );

		$metadata = wp_generate_attachment_metadata( $attachment_id, $file );
		if ( is_wp_error( $metadata ) ) {
			return $metadata;
		}
		wp_update_attachment_metadata( $attachment_id, $metadata );

		// Build per-size status + reason map.
		$plugin_sizes      = [
			\FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL,
			\FotoGrids\Image_Size_Manager::SLUG_FULL,
			\FotoGrids\Image_Size_Manager::SLUG_FULL_MOBILE,
			\FotoGrids\Image_Size_Manager::SLUG_MASONRY,
			\FotoGrids\Image_Size_Manager::SLUG_JUSTIFIED,
		];
		$custom_sizes      = array_keys( \FotoGrids\Image_Size_Manager::get_custom_sizes() );
		$other_sizes       = self::get_other_registered_sizes( $plugin_sizes, $custom_sizes );
		$registered_sizes  = wp_get_registered_image_subsizes();
		$size_statuses     = [];

		foreach ( array_merge( $plugin_sizes, $custom_sizes, $other_sizes ) as $slug ) {
			$data   = image_get_intermediate_size( $attachment_id, $slug );
			$exists = ( $data !== false && ! empty( $data['file'] ) );

			$status = [
				'exists' => $exists,
				'width'  => $data['width']  ?? null,
				'height' => $data['height'] ?? null,
				'reason' => null,
			];

			if ( ! $exists ) {
				$status['reason'] = self::infer_missing_reason(
					$slug,
					$registered_sizes[ $slug ] ?? null,
					$source_dims
				);
			}

			$size_statuses[ $slug ] = $status;
		}

		return rest_ensure_response( [
			'attachment_id' => $attachment_id,
			'sizes'         => $size_statuses,
			'source'        => $source_dims, // { width, height }
		] );
	}

	/**
	 * Returns every registered intermediate image size except FotoGrids'
	 * own plugin and custom sizes (which already have dedicated columns).
	 *
	 * @param  string[] $plugin_sizes FotoGrids plugin size slugs.
	 * @param  string[] $custom_sizes FotoGrids custom size slugs.
	 * @return string[]
	 */
	private static function get_other_registered_sizes( array $plugin_sizes, array $custom_sizes ): array {
		$all_registered = get_intermediate_image_sizes();
		$exclude        = array_merge( $plugin_sizes, $custom_sizes );

		$others = array_values( array_diff( $all_registered, $exclude ) );
		sort( $others );

		return $others;
	}

	/**
	 * Resolves the source image dimensions for an attachment.
	 *
	 * Uses attachment metadata first (cheap), falls back to getimagesize() on
	 * the file (last resort, used if metadata is missing or malformed).
	 *
	 * @param  int    $attachment_id
	 * @param  string $file
	 * @return array{width:?int,height:?int}
	 */
	private static function get_source_dimensions( int $attachment_id, string $file ): array {
		$meta = wp_get_attachment_metadata( $attachment_id );
		if ( is_array( $meta ) && ! empty( $meta['width'] ) && ! empty( $meta['height'] ) ) {
			return [
				'width'  => (int) $meta['width'],
				'height' => (int) $meta['height'],
			];
		}

		$size = @getimagesize( $file );
		if ( is_array( $size ) && isset( $size[0], $size[1] ) ) {
			return [
				'width'  => (int) $size[0],
				'height' => (int) $size[1],
			];
		}

		return [ 'width' => null, 'height' => null ];
	}

	/**
	 * Infers why a registered image size did not get generated.
	 *
	 * Most common reason: WordPress refuses to upscale, so a source image
	 * smaller than the registered target dimensions (in either axis, for
	 * non-cropped sizes) is simply skipped.
	 *
	 * @param  string                                             $slug
	 * @param  array{width:int,height:int,crop:bool}|null         $size_def
	 * @param  array{width:?int,height:?int}                      $source
	 * @return string
	 */
	private static function infer_missing_reason( string $slug, ?array $size_def, array $source ): string {
		if ( ! $size_def ) {
			return __( 'Image size is no longer registered.', 'fotogrids' );
		}

		$src_w = $source['width'];
		$src_h = $source['height'];

		if ( ! $src_w || ! $src_h ) {
			return __( 'Source dimensions unknown - image may be corrupt or unreadable.', 'fotogrids' );
		}

		$target_w = (int) ( $size_def['width']  ?? 0 );
		$target_h = (int) ( $size_def['height'] ?? 0 );
		$crop     = ! empty( $size_def['crop'] );

		// For cropped sizes, both axes must be >= the target.
		// For non-cropped (scaled) sizes, at least one axis must exceed target
		// - WordPress will downscale the longer side.
		if ( $crop ) {
			if ( $src_w < $target_w || $src_h < $target_h ) {
				return sprintf(
					/* translators: 1: source dims, 2: target dims */
					__( 'Source (%1$s) is smaller than the cropped target (%2$s).', 'fotogrids' ),
					$src_w . '×' . $src_h,
					$target_w . '×' . $target_h
				);
			}
		} else {
			$fits = ( $target_w > 0 && $src_w > $target_w ) || ( $target_h > 0 && $src_h > $target_h );
			if ( ! $fits ) {
				return sprintf(
					/* translators: 1: source dims, 2: target dims */
					__( 'Source (%1$s) is not larger than the target (%2$s) on either axis.', 'fotogrids' ),
					$src_w . '×' . $src_h,
					$target_w . '×' . $target_h
				);
			}
		}

		return __( 'Image editor did not produce this size - likely a write or memory error.', 'fotogrids' );
	}

	/**
	 * Returns the unique attachment IDs used across all FotoGrids galleries.
	 *
	 * Gallery membership lives in the post meta key `fotogrids_gallery_items`
	 * (a JSON-encoded array of attachment IDs) - NOT in the `fotogrids_item_meta`
	 * table. That table only carries per-item metadata (credit, EXIF, etc.) and
	 * is only written to when an item actually has metadata to persist, so a
	 * plain image dropped into a gallery may have no row there. Querying
	 * `fotogrids_gallery_items` post meta is the canonical source of truth.
	 *
	 * @return int[]
	 */
	private static function get_used_attachment_ids(): array {
		global $wpdb;

		// One pull of every gallery's items list. The meta_value is a JSON
		// array of attachment IDs written by fotogrids_add_item_to_gallery().
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s",
				'fotogrids_gallery_items'
			)
		);

		$used = [];
		foreach ( $rows as $raw ) {
			$decoded = is_string( $raw ) ? json_decode( $raw, true ) : null;
			if ( ! is_array( $decoded ) ) {
				// Older rows may already be stored as a serialized array.
				$decoded = maybe_unserialize( $raw );
			}
			if ( ! is_array( $decoded ) ) {
				continue;
			}
			foreach ( $decoded as $id ) {
				$id = (int) $id;
				if ( $id > 0 ) {
					$used[ $id ] = true;
				}
			}
		}

		return array_keys( $used );
	}

	/**
	 * Returns a map of attachment_id => list of distinct layout IDs used by
	 * every FotoGrids gallery that contains that attachment.
	 *
	 * Used by the regen tool to grey out layout-specific size rows (Masonry,
	 * Justified) for attachments whose galleries don't actually use that layout
	 * - those derivatives are not needed in practice and showing them as
	 * "missing" would be misleading.
	 *
	 * Two batch queries:
	 *   1. All `fotogrids_gallery_items` rows (gallery_id, JSON of attachment IDs).
	 *   2. All `fotogrids_layout` rows (gallery_id, layout ID string).
	 *
	 * Galleries with no saved layout fall back to the default ('grid') so
	 * brand-new galleries don't incorrectly grey out Masonry/Justified rows
	 * for everyone.
	 *
	 * @return array<int, string[]>  attachment_id => [ 'grid', 'masonry', ... ]
	 */
	private static function get_layouts_by_attachment(): array {
		global $wpdb;

		// One row per gallery: gallery_id => layout_id. Default to 'grid' when
		// the post meta is absent.
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$layout_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s",
				'fotogrids_layout'
			),
			ARRAY_A
		);

		$layout_by_gallery = [];
		foreach ( $layout_rows as $row ) {
			$gallery_id = (int) $row['post_id'];
			$layout     = is_string( $row['meta_value'] ) && $row['meta_value'] !== ''
				? $row['meta_value']
				: 'grid';
			$layout_by_gallery[ $gallery_id ] = $layout;
		}

		// One row per gallery: gallery_id => JSON-encoded list of attachment IDs.
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$item_rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = %s",
				'fotogrids_gallery_items'
			),
			ARRAY_A
		);

		$layouts_by_attachment = [];
		foreach ( $item_rows as $row ) {
			$gallery_id = (int) $row['post_id'];
			$layout     = $layout_by_gallery[ $gallery_id ] ?? 'grid';

			$decoded = is_string( $row['meta_value'] ) ? json_decode( $row['meta_value'], true ) : null;
			if ( ! is_array( $decoded ) ) {
				$decoded = maybe_unserialize( $row['meta_value'] );
			}
			if ( ! is_array( $decoded ) ) {
				continue;
			}

			foreach ( $decoded as $attachment_id ) {
				$attachment_id = (int) $attachment_id;
				if ( $attachment_id <= 0 ) {
					continue;
				}
				$layouts_by_attachment[ $attachment_id ][ $layout ] = true;
			}
		}

		// Flatten the per-attachment associative set back to a list of layout IDs.
		return array_map( 'array_keys', $layouts_by_attachment );
	}

	/**
	 * Returns [ attachment_ids_for_page, total_count ] based on filter and
	 * pagination params.
	 *
	 * @param  bool $include_unused When true, source = all image attachments.
	 *                              When false, source = gallery items only.
	 * @param  int  $page           1-indexed.
	 * @param  int  $per_page
	 * @return array{0:int[],1:int}
	 */
	private static function collect_attachment_ids( bool $include_unused, int $page, int $per_page ): array {
		if ( $include_unused ) {
			// All image attachments in the media library, ordered most recent first.
			$query = new \WP_Query( [
				'post_type'              => 'attachment',
				'post_status'            => 'inherit',
				'post_mime_type'         => 'image',
				'fields'                 => 'ids',
				'orderby'                => 'date',
				'order'                  => 'DESC',
				'posts_per_page'         => $per_page,
				'paged'                  => $page,
				'no_found_rows'          => false,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
			] );

			return [
				array_map( 'intval', $query->posts ),
				(int) $query->found_posts,
			];
		}

		// Gallery items only.
		$used_ids = self::get_used_attachment_ids();
		$total    = count( $used_ids );

		// Newest-first by attachment ID approximates upload order; we don't
		// sort by date here because that would need another query per page.
		rsort( $used_ids );

		$offset = ( $page - 1 ) * $per_page;
		$slice  = array_slice( $used_ids, $offset, $per_page );

		return [ $slice, $total ];
	}
}
