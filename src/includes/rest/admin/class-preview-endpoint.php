<?php
declare(strict_types=1);

namespace FotoGrids\REST\Admin;

use FotoGrids\Hooks\Actions_Render;
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
		$gallery_id   = absint( $request->get_param( 'id' ) );
		$gallery_post = get_post( $gallery_id );

		if ( ! $gallery_post || 'fotogrids_gallery' !== $gallery_post->post_type ) {
			return new \WP_Error(
				'fotogrids_preview_gallery_not_found',
				__( 'Gallery not found.', 'fotogrids' ),
				array( 'status' => 404 )
			);
		}

		$validated_payload = Preview_Request_Validator::validate( $request );
		if ( is_wp_error( $validated_payload ) ) {
			return $validated_payload;
		}

		if (
			null !== $validated_payload['simulate_state']
			&& ! current_user_can( 'manage_fotogrids_settings' )
		) {
			$validated_payload['warnings'][]     = 'dropped simulate_state: insufficient permission';
			$validated_payload['simulate_state'] = null;
		}

		$item_order = $validated_payload['item_order'];
		if ( empty( $item_order ) ) {
			$item_order = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( (int) $gallery_id );
		}

		$base_settings   = \FotoGrids\Galleries\Gallery_Repository::get_settings( (int) $gallery_id );
		$context_builder = Context_Builder::for_preview();
		$render_context  = $context_builder->build_for_preview(
			gallery_id: $gallery_id,
			base_settings: is_array( $base_settings ) ? $base_settings : array(),
			settings_overlay: $validated_payload['settings'],
			collection_item_ids: $item_order,
			item_overrides: $validated_payload['item_overrides'],
			source: Request_Source::PREVIEW_UNSAVED,
			simulate_state: $validated_payload['simulate_state']
		);

		$render_context = $render_context->with(
			array(
				'settings' => array_merge(
					$render_context->settings,
					array(
						'_preview_source'     => Request_Source::PREVIEW_UNSAVED,
						'_show_render_errors' => current_user_can( 'edit_posts' ),
					)
				),
				'warnings' => array_merge( $render_context->warnings, $validated_payload['warnings'] ),
			)
		);

		$render_result = Render_Controller::factory()->render( $render_context );

		// The render pipeline calls wp_register_script / wp_enqueue_script for
		// every module's JS via Asset_Resolver::flush(). Modules that need a
		// page-scope global (currently only loading-icon) attach it via
		// wp_add_inline_script() inside an add_action('wp_footer',...) callback,
		// because on a normal page wp_footer paints those globals before the
		// footer scripts run. In a REST context wp_footer never fires, so we
		// fire a dedicated FotoGrids-only action that those modules also hook,
		// then snapshot any inline 'before' / 'after' payloads off each
		// enqueued JS handle. The client appends them around the matching
		// script tag so the preview gets the same runtime as a real embed.
		// Using a custom action instead of do_action('wp_footer') keeps third-
		// party footer callbacks (analytics, social pixels, etc.) out of the
		// REST response cycle.
		do_action( Actions_Render::LATE_ASSETS, $render_context );

		$css_assets = Asset_Resolver::instance()->get_css_asset_urls();
		$js_assets  = Asset_Resolver::instance()->get_js_asset_data();
		$js_payload = self::serialize_js_assets( $js_assets );

		// window.fotogrids carries the deep-link settings the frontend modules
		// (sharing, lightbox, pagination) read from. On the live site this is
		// attached via wp_localize_script. The preview client sets it as a
		// window property before injecting any scripts.
		$sharing            = \FotoGrids\Settings\Sharing_Settings_Store::get();
		$localize_fotogrids = array(
			'deep_linking_enabled'  => (bool) ( $sharing['deep_linking_enabled'] ?? false ),
			'embedded_share_target' => $sharing['embedded_share_target'] ?? '',
			'restUrl'               => esc_url_raw( rest_url() ),
			'renderUrl'             => esc_url_raw( rest_url( 'fotogrids/v1/gallery/render' ) ),
			'renderNonce'           => wp_create_nonce( 'wp_rest' ),
		);

		return rest_ensure_response(
			array(
				'html'           => $render_result->html,
				'instance_id'    => $render_result->instance_id,
				'active_modules' => $render_result->active_modules,
				'http_status'    => $render_result->http_status,
				'assets'         => array(
					'css'      => $css_assets,
					'js'       => $js_payload,
					'localize' => array(
						'fotogrids' => $localize_fotogrids,
					),
				),
				'meta'           => array(
					'warnings' => $render_context->warnings,
				),
			)
		);
	}

	/**
	 * Builds the client-side JS asset payload.
	 *
	 * Returns an ordered list of script descriptors so the client can load
	 * them in declaration order. Each descriptor carries its handle, src,
	 * footer flag, dependency handles, and any inline 'before' / 'after'
	 * payloads attached to the handle via wp_add_inline_script() (used by
	 * the loading-icon module to publish window.fotogridsLoadingIcons).
	 *
	 * @since   1.0.0
	 * @param   array<string, array{src: string, in_footer: bool}> $js_assets Asset_Resolver output.
	 * @return  array<int, array<string, mixed>>
	 */
	private static function serialize_js_assets( array $js_assets ): array {
		$scripts = wp_scripts();
		$records = array();

		foreach ( $js_assets as $handle => $meta ) {
			$deps = array();
			if ( isset( $scripts->registered[ $handle ] ) ) {
				$deps = (array) $scripts->registered[ $handle ]->deps;
			}

			$inline_before = '';
			$inline_after  = '';
			if ( isset( $scripts->registered[ $handle ] ) ) {
				$before_data = $scripts->get_data( $handle, 'before' );
				$after_data  = $scripts->get_data( $handle, 'after' );
				if ( is_array( $before_data ) ) {
					$inline_before = implode( "\n", array_filter( $before_data, 'is_string' ) );
				} elseif ( is_string( $before_data ) ) {
					$inline_before = $before_data;
				}
				if ( is_array( $after_data ) ) {
					$inline_after = implode( "\n", array_filter( $after_data, 'is_string' ) );
				} elseif ( is_string( $after_data ) ) {
					$inline_after = $after_data;
				}
			}

			$records[ $handle ] = array(
				'handle'        => $handle,
				'src'           => $meta['src'],
				'in_footer'     => (bool) $meta['in_footer'],
				'deps'          => array_values( $deps ),
				'inline_before' => $inline_before,
				'inline_after'  => $inline_after,
			);
		}

		// Topologically sort by deps so a script's dependencies are loaded
		// before it on the client. The Asset_Resolver collects in module
		// declaration order (decorators before features), which can put
		// dependent scripts ahead of their deps — most importantly
		// fotogrids-runtime, which every other module's JS declares as a
		// dep and which lives in the always-on Runtime_Bootstrap feature.
		// The client loads scripts with script.async = false and awaits
		// each load event, so ordering here is what determines execution
		// order in the document.
		return self::topo_sort( $records );
	}

	/**
	 * Stable topological sort over the script records, keyed by handle.
	 *
	 * Deps not present in the local record map (e.g. WordPress core deps
	 * like 'jquery' that aren't enqueued through Asset_Resolver) are
	 * ignored — they're either already on the page or the script doesn't
	 * actually need them on the preview surface.
	 *
	 * @since   1.0.0
	 * @param   array<string, array<string, mixed>> $records Handle => record.
	 * @return  array<int, array<string, mixed>>
	 */
	private static function topo_sort( array $records ): array {
		$sorted   = array();
		$visited  = array();
		$visiting = array();

		$visit = function ( string $handle ) use ( &$visit, &$records, &$sorted, &$visited, &$visiting ): void {
			if ( isset( $visited[ $handle ] ) || ! isset( $records[ $handle ] ) ) {
				return;
			}
			if ( isset( $visiting[ $handle ] ) ) {
				// Dependency cycle — treat as already visited so we don't loop forever.
				return;
			}
			$visiting[ $handle ] = true;

			foreach ( $records[ $handle ]['deps'] as $dep_handle ) {
				if ( is_string( $dep_handle ) ) {
					$visit( $dep_handle );
				}
			}

			$visited[ $handle ] = true;
			$sorted[]           = $records[ $handle ];
		};

		foreach ( $records as $handle => $_record ) {
			$visit( $handle );
		}

		return $sorted;
	}
}
