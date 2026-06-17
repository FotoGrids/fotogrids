<?php
namespace FotoGrids\REST\Gallery;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Lightbox slides REST data handler.
 *
 * Returns a flat slide-metadata payload for a contiguous range of items
 * in the gallery's filtered + sorted sequence. The lightbox JS uses
 * this to lazy-fetch slides beyond the currently-loaded page, so users
 * can navigate the full gallery from inside the lightbox without
 * re-paginating the visible grid.
 *
 * Endpoint: POST /fotogrids/v1/gallery/lightbox/slides
 *
 * @since 1.0.0
 */
class Lightbox_Slides_Data {

	/**
	 * GET handler for the /gallery/lightbox/slides route.
	 *
	 * @since 1.0.0
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function get_lightbox_slides( $request ) {
		$gallery_id  = (int) $request->get_param( 'gallery_id' );
		$offset      = max( 0, (int) $request->get_param( 'offset' ) );
		$limit       = max( 1, (int) $request->get_param( 'limit' ) );
		$random_seed = (int) $request->get_param( 'random_seed' );
		$filters_raw = $request->get_param( 'filters' );
		$filters     = is_array( $filters_raw ) ? $filters_raw : array();

		if ( $gallery_id <= 0 ) {
			return new \WP_Error(
				'gallery_id_required',
				__( 'A gallery_id is required.', 'fotogrids' ),
				array( 'status' => 400 )
			);
		}

		$gallery = get_post( $gallery_id );
		if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
			return new \WP_Error(
				'gallery_not_found',
				__( 'Gallery not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		if ( 'publish' !== $gallery->post_status ) {
			return new \WP_Error(
				'gallery_not_published',
				__( 'Gallery is not published.', 'fotogrids' ),
				array( 'status' => 403 )
			);
		}

		$settings = \FotoGrids\Galleries\Gallery_Repository::get_settings( (int) $gallery_id );

		// Resolve the full filtered + sorted sequence. Random seed = 0
		// (the param default for "no seed") becomes null so the sorter
		// can generate its own - but in practice every gallery on the
		// page already has a seed stamped on the wrapper, so a paginated
		// client will send a real seed.
		$sequence = \FotoGrids\Render\Internal\Gallery_Item_Sequence::resolve(
			$gallery_id,
			$settings,
			$random_seed > 0 ? $random_seed : null,
			$filters
		);

		$total     = count( $sequence );
		$slice_ids = array_slice( $sequence, $offset, $limit );
		$slides    = ! empty( $slice_ids )
			? \FotoGrids\Render\Lightbox\Shared\Lightbox_Slide_Builder::build_many( $slice_ids, $settings )
			: array();

		return rest_ensure_response(
			array(
				'success' => true,
				'total'   => $total,
				'offset'  => $offset,
				'count'   => count( $slides ),
				'slides'  => $slides,
			)
		);
	}
}
