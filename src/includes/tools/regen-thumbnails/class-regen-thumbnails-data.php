<?php
namespace FotoGrids\Tools\RegenThumbnails;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Regen Thumbnails Data
 *
 * REST handler methods for the Regenerate Thumbnails tool.
 *
 * @since 1.0.0
 */
class Regen_Thumbnails_Data {

	/**
	 * GET /fotogrids/v1/admin/tools/regen-thumbnails/status
	 *
	 * Returns per-attachment derivative status for fotogrids_thumbnail,
	 * fotogrids_full, and any registered custom FotoGrids sizes.
	 *
	 * @param  \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public static function get_status( \WP_REST_Request $request ): \WP_REST_Response {
		global $wpdb;

		// Collect all unique attachment IDs used across FotoGrids galleries.
		$table          = $wpdb->prefix . 'fotogrids_item_meta';
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$attachment_ids = $wpdb->get_col( "SELECT DISTINCT attachment_id FROM {$table} WHERE attachment_id > 0" );

		$plugin_sizes = [
			\FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL,
			\FotoGrids\Image_Size_Manager::SLUG_FULL,
		];
		$custom_sizes = array_keys( \FotoGrids\Image_Size_Manager::get_custom_sizes() );

		$items = [];
		foreach ( $attachment_ids as $attachment_id ) {
			$attachment_id   = (int) $attachment_id;
			$attachment_post = get_post( $attachment_id );
			if ( ! $attachment_post ) {
				continue;
			}

			$size_statuses = [];
			foreach ( array_merge( $plugin_sizes, $custom_sizes ) as $slug ) {
				$data                   = image_get_intermediate_size( $attachment_id, $slug );
				$size_statuses[ $slug ] = [
					'exists' => ( $data !== false && ! empty( $data['file'] ) ),
					'width'  => $data['width']  ?? null,
					'height' => $data['height'] ?? null,
				];
			}

			$items[] = [
				'attachment_id' => $attachment_id,
				'filename'      => basename( get_attached_file( $attachment_id ) ?: '' ),
				'thumb_url'     => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ) ?: '',
				'sizes'         => $size_statuses,
			];
		}

		return rest_ensure_response( [
			'items'        => $items,
			'plugin_sizes' => $plugin_sizes,
			'custom_sizes' => $custom_sizes,
		] );
	}

	/**
	 * POST /fotogrids/v1/admin/tools/regen-thumbnails/regenerate
	 *
	 * Regenerates image derivatives for a single attachment.
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

		$metadata = wp_generate_attachment_metadata( $attachment_id, $file );
		if ( is_wp_error( $metadata ) ) {
			return $metadata;
		}
		wp_update_attachment_metadata( $attachment_id, $metadata );

		// Return updated size statuses.
		$plugin_sizes  = [
			\FotoGrids\Image_Size_Manager::SLUG_THUMBNAIL,
			\FotoGrids\Image_Size_Manager::SLUG_FULL,
		];
		$custom_sizes  = array_keys( \FotoGrids\Image_Size_Manager::get_custom_sizes() );
		$size_statuses = [];

		foreach ( array_merge( $plugin_sizes, $custom_sizes ) as $slug ) {
			$data                   = image_get_intermediate_size( $attachment_id, $slug );
			$size_statuses[ $slug ] = [
				'exists' => ( $data !== false && ! empty( $data['file'] ) ),
				'width'  => $data['width']  ?? null,
				'height' => $data['height'] ?? null,
			];
		}

		return rest_ensure_response( [
			'attachment_id' => $attachment_id,
			'sizes'         => $size_statuses,
		] );
	}
}
