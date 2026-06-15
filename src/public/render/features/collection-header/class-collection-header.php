<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Collection_Header;

use FotoGrids\Hooks\Filters_Breadcrumb;
use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders the per-gallery navigation chrome — back-to-album button and
 * breadcrumb trail — inside the gallery wrapper, above .fotogrids-filters.
 *
 * Behaviour matrix:
 *
 *   - Album renders themselves never carry this chrome (it's about
 *     navigating *into* a gallery from an album).
 *   - The visible markup is built only when Breadcrumb_Resolver finds a
 *     single parent album for the current gallery (see resolver docblock
 *     for the visit-context vs. single-album-fallback rules).
 *   - Placement gating: the album's `navigation_breadcrumbs_placements`
 *     setting decides whether breadcrumbs may render on View Pages,
 *     embedded contexts, or both. The back button is single-toggle and
 *     applies to whichever context the chrome is showing.
 *   - The schema (BreadcrumbList JSON-LD) is emitted separately by
 *     Breadcrumb_Schema, called from html_appendix() so it runs whenever
 *     this Feature renders.
 *
 * The breadcrumb markup is an ordered list with explicit `<li>` separator
 * items carrying an inline SVG chevron. That lets users restyle the
 * separator (or override the SVG entirely via the
 * fotogrids/breadcrumb/separator_svg filter) without fighting a CSS
 * pseudo-element's `content:` declaration.
 *
 * @package FotoGrids\Render\Features\Collection_Header
 * @since   1.0.0
 */
final class Collection_Header implements Feature {

	/**
	 * Default chevron separator. Matches the visual weight of native
	 * theme breadcrumbs (1.5 stroke, rounded join, currentColor) without
	 * leaking colour from this module's own stylesheet.
	 *
	 * @since 1.0.0
	 */
	private const DEFAULT_SEPARATOR_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 4l4 4-4 4"/></svg>';

	public function id(): string {
		return 'fotogrids/collection-header';
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

	/**
	 * Active only when:
	 *   - This is a gallery render (not an album-as-collection).
	 *   - Breadcrumb_Resolver yields a single parent album.
	 *   - The parent album's settings turn on at least one of the two
	 *     UI elements AND the current placement is permitted.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::GALLERY !== $render_context->meta->collection_kind ) {
			return false;
		}

		$resolution = $this->resolve( $render_context );
		return null !== $resolution;
	}

	/**
	 * Emit the header markup immediately before the layout content. That
	 * positions .fg-collection-header above .fotogrids-filters (which
	 * Filter_Ui registers in html_before too, but later in boot.php).
	 *
	 * Allows third-party / Pro replacement of the entire breadcrumb output
	 * via the `fotogrids/breadcrumb/render_html` filter. Returning a
	 * non-null string from that filter wins; returning null defers to
	 * FotoGrids' own markup.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return string
	 */
	public function html_before( Render_Context $render_context ): string {
		$resolution = $this->resolve( $render_context );
		if ( null === $resolution ) {
			return '';
		}

		$gallery_id = $render_context->meta->gallery_id;
		$album_id   = $resolution['album_id'];
		$album_post = get_post( $album_id );
		if ( ! $album_post ) {
			return '';
		}

		$album_title     = (string) get_the_title( $album_post );
		$album_permalink = (string) get_permalink( $album_post );
		if ( '' === $album_permalink ) {
			// No public URL for the album — no useful back link.
			return '';
		}

		$gallery_post  = get_post( $gallery_id );
		$gallery_title = $gallery_post ? (string) get_the_title( $gallery_post ) : '';

		$filter_context = array(
			'placement'       => $resolution['placement'],
			'show_breadcrumb' => $resolution['show_breadcrumb'],
			'show_back'       => $resolution['show_back'],
			'source'          => $resolution['source'],
		);

		/**
		 * Filter the entire FotoGrids breadcrumb / back-button block.
		 *
		 * Return a non-empty string to replace FotoGrids' output (used by
		 * Pro SEO integrations to hand off to Yoast / Rank Math / SEOPress).
		 * Return an empty string to suppress the block. Return null
		 * (default) to let FotoGrids render its own markup.
		 *
		 * @since 1.0.0
		 * @param string|null $html         Replacement HTML, or null to defer.
		 * @param int         $gallery_id   Gallery being rendered.
		 * @param int         $album_id     Resolved parent album.
		 * @param array       $context      placement / show_* / source flags.
		 */
		$overridden = apply_filters( Filters_Breadcrumb::RENDER_HTML, null, $gallery_id, $album_id, $filter_context );
		if ( is_string( $overridden ) ) {
			return $overridden;
		}

		return $this->render_header_html(
			$album_id,
			$album_title,
			$album_permalink,
			$gallery_title,
			$resolution
		);
	}

	public function html_appendix( Render_Context $render_context ): string {
		$resolution = $this->resolve( $render_context );
		if ( null === $resolution ) {
			return '';
		}

		// Defer to the schema emitter. It checks the per-album schema
		// toggle, the is_ajax_swap guard, and the
		// fotogrids/breadcrumb/should_emit_schema filter on its own.
		return Breadcrumb_Schema::build(
			$render_context->meta->gallery_id,
			$resolution['album_id'],
			$resolution['album_settings'],
			$render_context->meta->is_ajax_swap
		);
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$resolution = $this->resolve( $render_context );
		if ( null === $resolution ) {
			return array();
		}

		return array(
			'data-fg-via-album' => (string) $resolution['album_id'],
		);
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			css: array(
				'fotogrids-collection-header' => new Asset_Decl(
					path: 'features/collection-header/collection-header.css',
				),
			),
			js: array(
				// Tiny behaviour bundle whose only job is to make the
				// in-place "Back" button restore the AJAX-swapped album
				// wrapper instead of navigating. Declares the runtime
				// as a dep so onGallery() is callable and
				// FotoGrids.modules.albumAjax is reachable.
				'fotogrids-collection-header' => new Asset_Decl(
					path:      '../../assets/js/collection-header.js',
					deps:      array( 'fotogrids-runtime' ),
					in_footer: true,
				),
			)
		);
	}

	/**
	 * Combine the Breadcrumb_Resolver result, the album's saved settings, and
	 * the current placement into a single decision record. Returns null when
	 * nothing should render. Memoised per render context (cheap to call from
	 * supports(), html_before(), html_appendix(), wrapper_data_attrs()).
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context
	 * @return array{album_id:int, album_settings:array<string,mixed>, placement:string, show_breadcrumb:bool, show_back:bool, back_show_album_name:bool, source:string}|null
	 */
	private function resolve( Render_Context $render_context ): ?array {
		static $memo_key = null;
		static $memo_val = null;

		$gallery_id   = $render_context->meta->gallery_id;
		$via_album_id = $render_context->via_album_id;

		$key = $gallery_id . '|' . ( $via_album_id ? $via_album_id : 0 ) . '|' . ( $render_context->meta->view_page ? 'v' : 'e' );
		if ( $memo_key === $key ) {
			return $memo_val;
		}

		$memo_key = $key;
		$memo_val = null;

		$album_id = Breadcrumb_Resolver::resolve_parent_album( $gallery_id, $via_album_id );
		if ( null === $album_id ) {
			return null;
		}

		$album_settings = class_exists( '\FotoGrids\Albums\Album_Repository' )
			? \FotoGrids\Albums\Album_Repository::get_settings( $album_id )
			: ( class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
				? \FotoGrids\Galleries\Gallery_Repository::get_settings( $album_id )
				: array() );

		if ( ! is_array( $album_settings ) ) {
			$album_settings = array();
		}

		$show_breadcrumb_setting      = (bool) ( $album_settings['navigation_show_breadcrumbs'] ?? true );
		$show_back_setting            = (bool) ( $album_settings['navigation_show_back_button'] ?? false );
		$show_on_direct_visit_setting = (bool) ( $album_settings['navigation_show_breadcrumbs_on_direct_visit'] ?? false );

		// A "direct visit" is one without a visit-context hint — the
		// visitor landed on the gallery's permalink (or had it embedded
		// somewhere) without coming through ?fg_via or an AJAX swap.
		// Breadcrumb_Resolver still produced a parent album via the
		// single-album-fallback rule, but that's a *canonical* link not
		// a *visit-context* link. The per-album toggle decides whether
		// we want to render anything in that case.
		$is_direct_visit = null === $render_context->via_album_id;
		if ( $is_direct_visit && ! $show_on_direct_visit_setting ) {
			return null;
		}

		// Resolve the current placement against the album's per-placement
		// breadcrumb gate. The setting is a list — ['view_pages', 'embedded'].
		$placements_raw = $album_settings['navigation_breadcrumbs_placements'] ?? array( 'view_pages', 'embedded' );
		if ( is_string( $placements_raw ) && '' !== $placements_raw && '[' === $placements_raw[0] ) {
			$decoded        = json_decode( $placements_raw, true );
			$placements_raw = is_array( $decoded ) ? $decoded : array();
		}
		$placements = is_array( $placements_raw ) ? array_map( 'strval', $placements_raw ) : array();

		$placement               = $render_context->meta->view_page ? 'view_pages' : 'embedded';
		$breadcrumb_placement_ok = in_array( $placement, $placements, true );

		$show_breadcrumb = $show_breadcrumb_setting && $breadcrumb_placement_ok;
		$show_back       = $show_back_setting;

		if ( ! $show_breadcrumb && ! $show_back ) {
			return null;
		}

		$source               = (string) ( $album_settings['navigation_breadcrumb_source'] ?? 'fotogrids' );
		$back_show_album_name = (bool) ( $album_settings['navigation_back_button_show_album_name'] ?? true );

		$memo_val = array(
			'album_id'             => $album_id,
			'album_settings'       => $album_settings,
			'placement'            => $placement,
			'show_breadcrumb'      => $show_breadcrumb,
			'show_back'            => $show_back,
			'back_show_album_name' => $back_show_album_name,
			'source'               => $source,
		);

		return $memo_val;
	}

	/**
	 * Build the visible <div.fg-collection-header> markup.
	 *
	 * @since 1.0.0
	 * @param int    $album_id
	 * @param string $album_title
	 * @param string $album_permalink
	 * @param string $gallery_title
	 * @param array  $resolution
	 * @return string
	 */
	private function render_header_html(
		int $album_id,
		string $album_title,
		string $album_permalink,
		string $gallery_title,
		array $resolution
	): string {
		$children = '';

		if ( $resolution['show_back'] ) {
			$children .= $this->render_back_button_html(
				$album_permalink,
				$album_title,
				! empty( $resolution['back_show_album_name'] )
			);
		}

		if ( $resolution['show_breadcrumb'] ) {
			$children .= $this->render_breadcrumb_html( $album_permalink, $album_title, $gallery_title );
		}

		if ( '' === $children ) {
			return '';
		}

		return '<div class="fg-collection-header" data-fg-via-album="' . esc_attr( (string) $album_id ) . '">'
			. $children
			. '</div>';
	}

	/**
	 * Render the back button. When $show_album_name is true the label reads
	 * "Back to {Album Title}"; when false it's just "Back" — useful for long
	 * album titles or tight layouts.
	 *
	 * @since 1.0.0
	 * @param string $album_permalink
	 * @param string $album_title
	 * @param bool   $show_album_name
	 * @return string
	 */
	private function render_back_button_html( string $album_permalink, string $album_title, bool $show_album_name ): string {
		if ( $show_album_name && '' !== $album_title ) {
			/* translators: %s: album title */
			$label = sprintf( __( 'Back to %s', 'fotogrids' ), $album_title );
		} else {
			$label = __( 'Back', 'fotogrids' );
		}

		// Inline back-arrow SVG. Matches the separator style — currentColor,
		// 1.5 stroke, rounded join — so theming carries through.
		$back_icon = '<svg class="fg-back-button__icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 8H4"/><path d="M7 5l-3 3 3 3"/></svg>';

		return '<a class="fg-back-button" href="' . esc_url( $album_permalink ) . '">'
			. $back_icon
			. '<span class="fg-back-button__label">' . esc_html( $label ) . '</span>'
			. '</a>';
	}

	/**
	 * Render the breadcrumb ordered list. Separator lives in its own <li>
	 * with `aria-hidden` so screen readers announce only "Album, Gallery"
	 * instead of "Album, chevron, Gallery".
	 *
	 * @since 1.0.0
	 * @param string $album_permalink
	 * @param string $album_title
	 * @param string $gallery_title
	 * @return string
	 */
	private function render_breadcrumb_html( string $album_permalink, string $album_title, string $gallery_title ): string {
		/**
		 * Filter the SVG markup used as the breadcrumb separator. Return a
		 * full `<svg>...</svg>` string. Used by Pro / third-party plugins
		 * (and by future per-collection style options) to swap the chevron
		 * for a slash, dot, arrow, or custom icon. Stick with currentColor +
		 * `aria-hidden="true"` so the visual + a11y story stays intact.
		 *
		 * @since 1.0.0
		 * @param string $svg Default chevron SVG.
		 */
		$separator_svg = (string) apply_filters( Filters_Breadcrumb::SEPARATOR_SVG, self::DEFAULT_SEPARATOR_SVG );

		$album_label   = '' !== $album_title ? $album_title : __( 'Album', 'fotogrids' );
		$current_label = '' !== $gallery_title ? $gallery_title : __( 'Gallery', 'fotogrids' );

		return '<nav class="fg-breadcrumbs" aria-label="' . esc_attr__( 'Breadcrumb', 'fotogrids' ) . '">'
			. '<ol>'
			. '<li class="fg-breadcrumbs__item"><a href="' . esc_url( $album_permalink ) . '">' . esc_html( $album_label ) . '</a></li>'
			. '<li class="fg-breadcrumbs__separator" aria-hidden="true">' . $separator_svg . '</li>'
			. '<li class="fg-breadcrumbs__item fg-breadcrumbs__item--current" aria-current="page">' . esc_html( $current_label ) . '</li>'
			. '</ol>'
			. '</nav>';
	}
}
