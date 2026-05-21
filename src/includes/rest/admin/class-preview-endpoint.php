<?php
declare(strict_types=1);

namespace FotoGrids\REST\Admin;

use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Render_Controller;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Preview endpoint callback placeholder.
 *
 * @package FotoGrids\REST\Admin
 * @since   1.0.0
 */
final class Preview_Endpoint {

    /**
     * Handle gallery preview requests.
     *
     * @since   1.0.0
     * @param   \WP_REST_Request $request Request object.
     * @return  \WP_REST_Response|\WP_Error
     */
    public static function preview( \WP_REST_Request $request ) {
        $gallery_id = absint( $request->get_param( 'id' ) );
        $gallery_post = get_post( $gallery_id );

        if ( ! $gallery_post || $gallery_post->post_type !== 'fotogrids_gallery' ) {
            return new \WP_Error(
                'fotogrids_preview_gallery_not_found',
                __( 'Gallery not found.', 'fotogrids' ),
                [ 'status' => 404 ]
            );
        }

        $validated_payload = Preview_Request_Validator::validate( $request );
        if ( is_wp_error( $validated_payload ) ) {
            return $validated_payload;
        }

        if (
            $validated_payload['simulate_state'] !== null
            && ! current_user_can( 'manage_fotogrids_settings' )
        ) {
            $validated_payload['warnings'][] = 'dropped simulate_state: insufficient permission';
            $validated_payload['simulate_state'] = null;
        }

        $item_order = $validated_payload['item_order'];
        if ( empty( $item_order ) ) {
            $item_order = fotogrids_get_gallery_item_ids( $gallery_id );
        }

        $base_settings = fotogrids_get_gallery_settings( $gallery_id );
        $context_builder = Context_Builder::for_preview();
        $render_context = $context_builder->build_for_preview(
            gallery_id: $gallery_id,
            base_settings: is_array( $base_settings ) ? $base_settings : [],
            settings_overlay: $validated_payload['settings'],
            collection_item_ids: $item_order,
            item_overrides: $validated_payload['item_overrides'],
            source: Request_Source::PREVIEW_UNSAVED,
            simulate_state: $validated_payload['simulate_state']
        );

        $render_context = $render_context->with(
            [
                'settings' => array_merge(
                    $render_context->settings,
                    [
                        '_preview_source' => Request_Source::PREVIEW_UNSAVED->value,
                        '_show_render_errors' => current_user_can( 'edit_posts' ),
                    ]
                ),
                'warnings' => array_merge( $render_context->warnings, $validated_payload['warnings'] ),
            ]
        );

        $render_result = Render_Controller::factory()->render( $render_context );
        $css_assets = Asset_Resolver::instance()->get_css_asset_urls();

        return rest_ensure_response(
            [
                'html' => $render_result->html,
                'instance_id' => $render_result->instance_id,
                'active_modules' => $render_result->active_modules,
                'http_status' => $render_result->http_status,
                'assets' => [
                    'css' => $css_assets,
                ],
                'meta' => [
                    'warnings' => $render_context->warnings,
                ],
            ]
        );
    }
}
