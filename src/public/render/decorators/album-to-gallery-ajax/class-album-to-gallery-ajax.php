<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Album_To_Gallery_Ajax;

use FotoGrids\Hooks\Filters_Render;
use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Item_Wrapper;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Internal\Hooks;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Album → Gallery (AJAX in place) click behaviour.
 *
 * Wraps each album item in an <a> that ALSO carries
 * data-fg-album-ajax-trigger. The JS client intercepts the click, fetches
 * the gallery's rendered HTML from a REST endpoint, injects any missing
 * CSS handles, and swaps the HTML into a target slot inside the album
 * wrapper. The runtime's MutationObserver then initialises the inserted
 * gallery, so every per-gallery feature (sharing, filters, lazy-load,
 * stats) works automatically against the swapped-in gallery.
 *
 * Graceful degradation: the <a> still has a real href to the gallery's
 * View Page. If the JS fails to load (or the user middle-clicks), the
 * link works as a normal navigation. Same fallback as Album_To_View_Page.
 *
 * Active on album renders when use_ajax_from_album is true.
 *
 * @package FotoGrids\Render\Decorators\Album_To_Gallery_Ajax
 * @since   1.0.0
 */
final class Album_To_Gallery_Ajax implements Decorator {

	public function id(): string {
		return 'fotogrids/album-to-gallery-ajax';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM !== $render_context->meta->collection_kind ) {
			return false;
		}
		return ! empty( $render_context->settings['use_ajax_from_album'] );
	}

	/**
	 * Wrap each item's figure in an <a data-fg-album-ajax-trigger>.
	 * href points to the gallery's view page so middle-click and JS-off
	 * still navigate somewhere useful.
	 *
	 * @since 1.0.0
	 * @param array<int, Item_View> $collection_items Collection items.
	 * @param Render_Context        $render_context   Render context.
	 * @return array<int, Item_View>
	 */
	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		$decorated = array();

		// Resolve the REST URL once per render rather than once per item.
		$render_url = rest_url( 'fotogrids/v1/gallery/render' );
		$nonce      = wp_create_nonce( 'wp_rest' );

		// Visit-context: stamp the source album on every trigger so the
		// JS client can forward it as `via_album_id` in the POST body.
		// Also carry it through to the href fallback (middle-click /
		// JS-off / fetch failure all land on the View Page with the
		// ?fg_via= already in place).
		$via_album_id = $render_context->meta->album_id;

		foreach ( $collection_items as $item_view ) {
			$gallery_id = $item_view->id;
			$permalink  = get_permalink( $gallery_id );
			$href       = is_string( $permalink ) && '' !== $permalink
				? $permalink
				: '#';

			if ( '#' !== $href && null !== $via_album_id && $via_album_id > 0 ) {
				$href = add_query_arg( 'fg_via', (int) $via_album_id, $href );
			}

			$trigger_attrs = array(
				'href'                       => esc_url( $href ),
				'data-fg-album-target'       => 'ajax',
				'data-fg-album-ajax-trigger' => '',
				'data-fg-gallery-id'         => (string) $gallery_id,
				'data-fg-render-url'         => esc_url( $render_url ),
				'data-fg-render-nonce'       => esc_attr( $nonce ),
			);

			if ( null !== $via_album_id && $via_album_id > 0 ) {
				$trigger_attrs['data-fg-via-album'] = (string) $via_album_id;
			}

			$trigger_attrs = (array) Hooks::apply_filter( Filters_Render::ANCHOR_ATTRS_SUFFIX, $trigger_attrs, $render_context );

			$figure_wrapper = new Item_Wrapper(
				'a',
				$trigger_attrs,
			);

			$decorated[] = $item_view->with(
				array(
					'figure_wrappers' => array_merge( $item_view->figure_wrappers, array( $figure_wrapper ) ),
				)
			);
		}

		return $decorated;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array( 'data-fg-album-click' => 'ajax' );
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * The AJAX client + a minimal stylesheet (loading state on the album
	 * wrapper while a swap is in flight).
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-album-to-gallery-ajax' => new Asset_Decl(
					'decorators/album-to-gallery-ajax/album-to-gallery-ajax.css',
				),
				// Pre-enqueue the collection-header CSS too. The AJAX-swapped
				// gallery will carry the back button / breadcrumb chrome, and
				// the swap response only injects *missing* CSS handles into the
				// host page - but the JS bundle that wires the Back button is
				// never injected by the swap flow (the REST response carries
				// CSS URLs but not JS). Loading both up-front, on any page that
				// can do an AJAX swap, guarantees the chrome's CSS and JS are
				// already present when the swapped content lands.
				'fotogrids-collection-header'     => new Asset_Decl(
					'features/collection-header/collection-header.css',
				),
			),
			array(
				'fotogrids-album-to-gallery-ajax' => new Asset_Decl(
					'../../assets/js/album-to-gallery-ajax.js',
					array( 'fotogrids-runtime' ),
					true,
				),
				// See CSS note above. The Collection_Header feature only
				// becomes active *inside* the swapped-in gallery render, so
				// its own assets() is never called on the host page - yet
				// the Back button it emits needs collection-header.js to
				// intercept clicks. Declaring it here means any page that
				// can swap an album → gallery already has the Back button
				// wiring loaded and ready.
				'fotogrids-collection-header'     => new Asset_Decl(
					'../../assets/js/collection-header.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}
}
