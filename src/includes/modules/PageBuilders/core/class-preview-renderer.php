<?php
/**
 * Shared page-builder preview renderer.
 *
 * @package FotoGrids\Modules\PageBuilders
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders;

use FotoGrids\Hooks\Actions_Render;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Render_Controller;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders a gallery or album in "preview" mode for every page-builder
 * host that needs in-editor output that respects the
 * {@see Preview_Options} toggles.
 *
 * Single chokepoint shared by:
 *   - the REST `/preview/{kind}/{id}` endpoint (Gutenberg's LivePreview
 *     consumes it via JSON + asset wiring)
 *   - per-builder widgets that render in-process (Elementor's
 *     `Widget_Gallery::render()` when `is_edit_mode()` is true)
 *
 * Returns just the rendered HTML string. Asset_Resolver flushes the
 * per-render CSS/JS during `Render_Controller::render()`, so callers
 * that emit HTML inline get their styles automatically (gated by the
 * `Filters_Render::SHOULD_INLINE_ASSETS` filter for editor contexts).
 * Callers that need the asset map serialised — i.e. the REST handler —
 * call `Asset_Resolver::instance()->get_*` themselves.
 *
 * @since 1.0.0
 */
final class Preview_Renderer {

	/**
	 * Render a gallery preview to HTML.
	 *
	 * @since 1.0.0
	 * @param int                                          $gallery_id      Gallery ID.
	 * @param array{click_behavior: bool, pagination: bool} $preview_options Normalised toggles.
	 * @return string Rendered HTML, or empty string if the pipeline is unavailable.
	 */
	public static function render_gallery_html( int $gallery_id, array $preview_options ): string {
		if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
			return '';
		}

		$render_settings = class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? (array) \FotoGrids\Galleries\Gallery_Repository::get_settings( $gallery_id )
			: array();

		$item_ids = class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
			? (array) \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id )
			: array();

		if ( false === $preview_options['click_behavior'] ) {
			$render_settings['item_click_behavior'] = 'nothing';
		}

		$context = Context_Builder::for_preview()->build_for_public(
			$gallery_id,
			$render_settings,
			$item_ids,
			Request_Source::PREVIEW_SAVED
		);

		$context = self::flip_to_preview_context( $context, Request_Source::PREVIEW_SAVED );

		$result = Render_Controller::factory()->render( $context );

		// Modules that publish page-scope assets (loading-icon etc.)
		// hook this action so they can attach themselves outside the
		// normal wp_footer path.
		do_action( Actions_Render::LATE_ASSETS, $context );

		return (string) $result->html;
	}

	/**
	 * Render an album preview to HTML.
	 *
	 * @since 1.0.0
	 * @param int                                          $album_id        Album ID.
	 * @param array{click_behavior: bool, pagination: bool} $preview_options Normalised toggles.
	 * @return string Rendered HTML, or empty string if the pipeline is unavailable.
	 */
	public static function render_album_html( int $album_id, array $preview_options ): string {
		if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
			return '';
		}

		$album_settings = class_exists( '\FotoGrids\Albums\Album_Repository' )
			? (array) \FotoGrids\Albums\Album_Repository::get_settings( $album_id )
			: array();

		$child_ids = array();
		if ( class_exists( '\FotoGrids\Gallery_Album_Relations' ) ) {
			$children = (array) \FotoGrids\Gallery_Album_Relations::get_galleries_for_album(
				$album_id,
				array(
					'orderby' => 'position',
					'order'   => 'ASC',
				)
			);
			foreach ( $children as $child ) {
				$id = is_object( $child ) ? (int) ( $child->ID ?? 0 ) : 0;
				if ( $id > 0 ) {
					$child_ids[] = $id;
				}
			}
		}

		if ( false === $preview_options['click_behavior'] ) {
			$album_settings['item_click_behavior'] = 'nothing';
		}

		$context = Context_Builder::for_preview()->build_for_album(
			$album_id,
			$album_settings,
			$child_ids,
			Request_Source::PREVIEW_SAVED
		);

		$context = self::flip_to_preview_context( $context, Request_Source::PREVIEW_SAVED );

		$result = Render_Controller::factory()->render( $context );

		do_action( Actions_Render::LATE_ASSETS, $context );

		return (string) $result->html;
	}

	/**
	 * Return a copy of the render context with `is_preview = true` and
	 * the supplied source stamped on the meta, plus preview-only
	 * settings markers merged in.
	 *
	 * Mirrors {@see \FotoGrids\Modules\PageBuilders\REST\Preview_Data::flip_to_preview_context}
	 * — duplicated rather than imported because that class lives behind
	 * the REST autoload boundary and we want this renderer usable from
	 * `init`-time widget code that runs before REST is bootstrapped.
	 *
	 * @since 1.0.0
	 * @param Render_Context $context
	 * @param Request_Source $source
	 * @return Render_Context
	 */
	private static function flip_to_preview_context( Render_Context $context, string $source ): Render_Context {
		$preview_meta = $context->meta->with(
			array(
				'is_preview' => true,
				'source'     => $source,
			)
		);

		$preview_settings = array_merge(
			$context->settings,
			array(
				'_preview_source'     => $source,
				'_show_render_errors' => current_user_can( 'edit_posts' ),
			)
		);

		return new Render_Context(
			$preview_meta,
			$context->layout,
			$context->behavior,
			$preview_settings,
			$context->items,
			$context->warnings,
			$context->via_album_id,
		);
	}

	/**
	 * Render a friendly in-editor empty-state panel for a gallery or
	 * album that exists but has zero items / child galleries.
	 *
	 * Used by page-builder widgets to short-circuit the layout pipeline
	 * when there's nothing to draw. Encourages the user to add content
	 * via a deep-link to the post edit screen.
	 *
	 * @since 1.0.0
	 * @param 'gallery'|'album' $kind Collection kind.
	 * @param int               $id   Collection ID.
	 * @return string Sanitised HTML.
	 */
	public static function render_empty_state_html( string $kind, int $id ): string {
		$edit_url = get_edit_post_link( $id, '' ) ?: '';

		if ( 'album' === $kind ) {
			$title       = esc_html__( 'This album has no galleries yet', 'fotogrids' );
			$description = esc_html__( 'Add one or more galleries so this album has something to display.', 'fotogrids' );
			$button_lbl  = esc_html__( 'Add galleries', 'fotogrids' );
		} else {
			$title       = esc_html__( 'This gallery has no items yet', 'fotogrids' );
			$description = esc_html__( 'Add images, videos, or other media so this gallery has something to display.', 'fotogrids' );
			$button_lbl  = esc_html__( 'Add items', 'fotogrids' );
		}

		// We render the CTA as a <button> rather than an <a> because the
		// page-builder preview iframe blocks `target="_blank"` and
		// `window.open()` calls. The click handler postMessages the URL
		// up to the parent editor window, which opens it (see the
		// `fg-pb-empty-state:open` listener registered by editor.jsx).
		// The inline `onclick` keeps the empty-state self-contained so
		// it still works on hosts that haven't wired the parent listener.
		$cta = '';
		if ( '' !== $edit_url ) {
			$cta = sprintf(
				'<button type="button" class="fg-pb-empty-state__cta" data-fg-edit-url="%1$s" onclick="(function(b){try{(window.top||window.parent||window).postMessage({type:\'fg-pb-empty-state:open\',url:b.dataset.fgEditUrl},\'*\');}catch(e){window.open(b.dataset.fgEditUrl,\'_blank\',\'noopener\');}})(this)">%2$s</button>',
				esc_url( $edit_url ),
				$button_lbl
			);
		}

		// Inline, scoped styles — keeps the empty-state self-contained so
		// it works in the page-builder preview iframe (which doesn't
		// enqueue the editor stylesheet) and in any future host. Browsers
		// dedupe duplicate <style> blocks effectively; the cost is
		// negligible.
		$styles = '<style>'
			. '.fg-pb-empty-state{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:32px 24px;border:1px dashed rgba(0,0,0,.18);border-radius:8px;background:rgba(0,0,0,.02);color:#1d2327;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5;}'
			. '.fg-pb-empty-state__title{font-size:15px;font-weight:600;}'
			. '.fg-pb-empty-state__description{font-size:13px;color:#50575e;max-width:42ch;}'
			. '.fg-pb-empty-state__cta{display:inline-block;margin-top:8px;padding:8px 16px;background:#3858e9;color:#fff;font-size:13px;font-weight:500;text-decoration:none;border:0;border-radius:4px;cursor:pointer;font-family:inherit;line-height:1.4;transition:background-color .15s ease;}'
			. '.fg-pb-empty-state__cta:hover,.fg-pb-empty-state__cta:focus-visible{background:#2e4bc4;color:#fff;text-decoration:none;}'
			// Dark Elementor canvas (Elementor sets a dark body class on
			// the preview iframe when ui_theme=dark).
			. 'body.elementor-editor--dark .fg-pb-empty-state{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#f0f0f1;}'
			. 'body.elementor-editor--dark .fg-pb-empty-state__description{color:#a7aaad;}'
			// "auto" follows OS preference.
			. '@media (prefers-color-scheme:dark){body.elementor-editor--auto .fg-pb-empty-state{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#f0f0f1;}'
			. 'body.elementor-editor--auto .fg-pb-empty-state__description{color:#a7aaad;}}'
			. '</style>';

		return $styles
			. '<div class="fg-pb-empty-state" data-fg-kind="' . esc_attr( $kind ) . '" data-fg-id="' . esc_attr( (string) $id ) . '">'
			. '<div class="fg-pb-empty-state__title">' . $title . '</div>'
			. '<div class="fg-pb-empty-state__description">' . $description . '</div>'
			. $cta
			. '</div>';
	}
}
