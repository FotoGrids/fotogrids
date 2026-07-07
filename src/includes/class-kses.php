<?php
declare(strict_types=1);

namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * wp_kses() allowlist tuned for FotoGrids' server-generated collection markup.
 *
 * The render pipeline produces gallery / album / lock-screen HTML that WordPress
 * core's `post` kses context would mutilate: it uses inline SVG loaders and
 * arrow icons, <picture>/<source>/<video>/<iframe> media, the password-gate
 * <form>, the filter-UI <select>, and ~200 distinct data-fg-* / aria-* hooks the
 * frontend runtime reads.
 *
 * Echo sites (Gutenberg blocks, Elementor / Divi widgets, the View Page
 * template) call WordPress core's wp_kses() directly with this allowlist -
 * `wp_kses( $html, \FotoGrids\Kses::rules( $html ) )` - so <script>/<style>/
 * on*-handlers are still stripped (the render pipeline emits none; the
 * per-render CSS/JS are enqueued or returned separately), while the
 * presentational markup the gallery needs survives. Using wp_kses() at the call
 * site (rather than a wrapper) keeps WordPress' own PHPCS standard and Plugin
 * Check - neither of which reads this plugin's phpcs.xml - satisfied with no
 * custom-function registration and no per-line ignore.
 *
 * data-* / aria-* are permitted dynamically: kses has no wildcard support, and
 * enumerating every data-fg-* would drift out of date, so the names actually
 * present in the HTML being filtered are discovered and allowed on every tag.
 * These are inert presentational hooks (they cannot execute), and their values
 * are still attribute-escaped by kses.
 *
 * @package FotoGrids
 * @since   1.0.0
 */
final class Kses {

	/**
	 * Build the wp_kses() allowlist for a block of collection markup.
	 *
	 * Call sites escape with the WP-core function directly - `wp_kses( $html,
	 * \FotoGrids\Kses::rules( $html ) )` - so that WordPress' own PHPCS standard
	 * (and Plugin Check, which does not read this plugin's phpcs.xml) recognises
	 * the output as escaped, with no custom-function registration or per-line
	 * ignore. The allowlist merges the static tag/attribute set with the data-* /
	 * aria-* attributes actually present in $html (kses has no wildcard support).
	 *
	 * Per-item inline style="" with CSS custom properties (Instant Photos
	 * rotation/shadow: --fg-rotation, --fg-shadow-x) would otherwise be stripped
	 * by safecss_filter_attr(); those are preserved by the always-registered
	 * allow_inline_css() filter (see register()), scoped to --fg- declarations.
	 *
	 * @since  1.0.0
	 * @param  string $html Server-generated collection markup.
	 * @return array<string, array<string, bool>>
	 */
	public static function rules( string $html ): array {
		return self::permit_dynamic_attributes( $html, self::allowed_html() );
	}

	/**
	 * Registers the inline-style filter. Called once at bootstrap.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function register(): void {
		add_filter( 'safecss_filter_attr_allow_css', array( __CLASS__, 'allow_inline_css' ), 10, 2 );
	}

	/**
	 * safecss_filter_attr_allow_css filter: preserve FotoGrids per-item CSS
	 * custom properties (--fg-*) that safecss_filter_attr() would otherwise
	 * strip. Scoped to declaration strings containing the --fg- prefix so it
	 * never broadens what safecss allows for any other inline style. The values
	 * are plugin-generated from sanitised settings (numbers, enums, colours),
	 * never raw user input - which only reaches text nodes and href/src.
	 *
	 * @since  1.0.0
	 * @param  bool   $allow_css        Whether the declaration list is allowed.
	 * @param  string $css_test_string  The style attribute's declaration list.
	 * @return bool
	 */
	public static function allow_inline_css( $allow_css, $css_test_string ) {
		if ( is_string( $css_test_string ) && strpos( $css_test_string, '--fg-' ) !== false ) {
			return true;
		}

		return $allow_css;
	}

	/**
	 * The wp_kses() allowlist for view-page <head> meta markup.
	 *
	 * The standalone View Page emits SEO / Open Graph tags (<meta>, canonical
	 * <link>, <title>) built from esc_url()/esc_attr()'d values. Call sites use
	 * `wp_kses( $html, \FotoGrids\Kses::head_meta_rules() )`.
	 *
	 * @since  1.0.0
	 * @return array<string, array<string, bool>>
	 */
	public static function head_meta_rules(): array {
		return array(
			'meta'  => array(
				'charset'    => true,
				'name'       => true,
				'content'    => true,
				'property'   => true,
				'itemprop'   => true,
				'http-equiv' => true,
			),
			'link'  => array(
				'rel'         => true,
				'href'        => true,
				'sizes'       => true,
				'type'        => true,
				'media'       => true,
				'as'          => true,
				'crossorigin' => true,
				'hreflang'    => true,
				'title'       => true,
			),
			'title' => array(),
		);
	}

	/**
	 * Global attributes permitted on every allowed (non-SVG) tag.
	 *
	 * @return array<string, bool>
	 */
	private static function global_attrs(): array {
		return array(
			'class'     => true,
			'id'        => true,
			'style'     => true,
			'title'     => true,
			'role'      => true,
			'tabindex'  => true,
			'hidden'    => true,
			'dir'       => true,
			'lang'      => true,
			'translate' => true,
		);
	}

	/**
	 * The static tag => attribute allowlist (before dynamic data-* / aria-* are
	 * merged in). Global attributes are applied to every non-SVG tag.
	 *
	 * @return array<string, array<string, bool>>
	 */
	private static function allowed_html(): array {
		$g = self::global_attrs();

		$tags = array(
			// Structure / text.
			'div'        => array(),
			'span'       => array(),
			'p'          => array(),
			'a'          => array(
				'href'     => true,
				'target'   => true,
				'rel'      => true,
				'download' => true,
				'name'     => true,
			),
			'i'          => array(),
			'b'          => array(),
			'strong'     => array(),
			'em'         => array(),
			'small'      => array(),
			'br'         => array(),
			'hr'         => array(),
			'h1'         => array(),
			'h2'         => array(),
			'h3'         => array(),
			'h4'         => array(),
			'h5'         => array(),
			'h6'         => array(),
			'header'     => array(),
			'footer'     => array(),
			'section'    => array(),
			'article'    => array(),
			'nav'        => array(),
			'ul'         => array(),
			'ol'         => array(),
			'li'         => array(),
			'figure'     => array(),
			'figcaption' => array(),
			'time'       => array( 'datetime' => true ),

			// Media.
			'img'        => array(
				'src'            => true,
				'srcset'         => true,
				'sizes'          => true,
				'alt'            => true,
				'width'          => true,
				'height'         => true,
				'loading'        => true,
				'decoding'       => true,
				'fetchpriority'  => true,
				'referrerpolicy' => true,
				'crossorigin'    => true,
			),
			'picture'    => array(),
			'source'     => array(
				'src'    => true,
				'srcset' => true,
				'sizes'  => true,
				'media'  => true,
				'type'   => true,
			),
			'video'      => array(
				'src'         => true,
				'poster'      => true,
				'width'       => true,
				'height'      => true,
				'controls'    => true,
				'autoplay'    => true,
				'loop'        => true,
				'muted'       => true,
				'playsinline' => true,
				'preload'     => true,
				'crossorigin' => true,
			),
			'iframe'     => array(
				'src'             => true,
				'width'           => true,
				'height'          => true,
				'frameborder'     => true,
				'allow'           => true,
				'allowfullscreen' => true,
				'loading'         => true,
				'referrerpolicy'  => true,
				'title'           => true,
				'name'            => true,
				'sandbox'         => true,
			),

			// Form controls (password gate + filter UI).
			'form'       => array(
				'action'       => true,
				'method'       => true,
				'name'         => true,
				'autocomplete' => true,
			),
			'fieldset'   => array(
				'disabled' => true,
				'name'     => true,
			),
			'legend'     => array(),
			'label'      => array( 'for' => true ),
			'input'      => array(
				'type'         => true,
				'name'         => true,
				'value'        => true,
				'placeholder'  => true,
				'autocomplete' => true,
				'required'     => true,
				'disabled'     => true,
				'readonly'     => true,
				'checked'      => true,
				'min'          => true,
				'max'          => true,
				'step'         => true,
				'pattern'      => true,
				'maxlength'    => true,
				'minlength'    => true,
				'size'         => true,
				'inputmode'    => true,
			),
			'button'     => array(
				'type'     => true,
				'name'     => true,
				'value'    => true,
				'disabled' => true,
			),
			'select'     => array(
				'name'     => true,
				'multiple' => true,
				'disabled' => true,
				'required' => true,
				'size'     => true,
			),
			'option'     => array(
				'value'    => true,
				'selected' => true,
				'disabled' => true,
				'label'    => true,
			),
			'optgroup'   => array(
				'label'    => true,
				'disabled' => true,
			),
		);

		foreach ( $tags as $tag => $attrs ) {
			$tags[ $tag ] = array_merge( $g, $attrs );
		}

		return $tags + self::svg_tags();
	}

	/**
	 * SVG element allowlist (loaders, arrow / toolbar icons). SVG attributes are
	 * deliberately NOT given the HTML global set - only the presentational SVG
	 * primitives the icons use. camelCase attribute names (viewBox,
	 * preserveAspectRatio, gradientUnits, ...) are written lowercase here because
	 * kses lowercases attribute names; the HTML parser re-adjusts them back to
	 * their correct SVG casing on the way into the DOM.
	 *
	 * @return array<string, array<string, bool>>
	 */
	private static function svg_tags(): array {
		$paint = array(
			'fill'              => true,
			'fill-opacity'      => true,
			'fill-rule'         => true,
			'stroke'            => true,
			'stroke-width'      => true,
			'stroke-linecap'    => true,
			'stroke-linejoin'   => true,
			'stroke-dasharray'  => true,
			'stroke-dashoffset' => true,
			'stroke-opacity'    => true,
			'opacity'           => true,
			'transform'         => true,
			'clip-path'         => true,
			'clip-rule'         => true,
			'style'             => true,
			'class'             => true,
			'id'                => true,
			'aria-hidden'       => true,
		);

		return array(
			'svg'            => $paint + array(
				'xmlns'               => true,
				'xmlns:xlink'         => true,
				'viewbox'             => true,
				'width'               => true,
				'height'              => true,
				'preserveaspectratio' => true,
				'focusable'           => true,
				'role'                => true,
			),
			'g'              => $paint,
			'defs'           => array( 'id' => true ),
			'symbol'         => array(
				'id'                  => true,
				'viewbox'             => true,
				'preserveaspectratio' => true,
			),
			'use'            => $paint + array(
				'href'       => true,
				'xlink:href' => true,
				'x'          => true,
				'y'          => true,
				'width'      => true,
				'height'     => true,
			),
			'path'           => $paint + array( 'd' => true ),
			'rect'           => $paint + array(
				'x'      => true,
				'y'      => true,
				'width'  => true,
				'height' => true,
				'rx'     => true,
				'ry'     => true,
			),
			'circle'         => $paint + array(
				'cx' => true,
				'cy' => true,
				'r'  => true,
			),
			'ellipse'        => $paint + array(
				'cx' => true,
				'cy' => true,
				'rx' => true,
				'ry' => true,
			),
			'line'           => $paint + array(
				'x1' => true,
				'y1' => true,
				'x2' => true,
				'y2' => true,
			),
			'polyline'       => $paint + array( 'points' => true ),
			'polygon'        => $paint + array( 'points' => true ),
			'text'           => $paint + array(
				'x'           => true,
				'y'           => true,
				'dx'          => true,
				'dy'          => true,
				'text-anchor' => true,
				'font-size'   => true,
				'font-family' => true,
			),
			'tspan'          => $paint + array(
				'x'  => true,
				'y'  => true,
				'dx' => true,
				'dy' => true,
			),
			'title'          => array(),
			'desc'           => array(),
			'lineargradient' => array(
				'id'                => true,
				'x1'                => true,
				'y1'                => true,
				'x2'                => true,
				'y2'                => true,
				'gradientunits'     => true,
				'gradienttransform' => true,
				'spreadmethod'      => true,
			),
			'radialgradient' => array(
				'id'                => true,
				'cx'                => true,
				'cy'                => true,
				'r'                 => true,
				'fx'                => true,
				'fy'                => true,
				'gradientunits'     => true,
				'gradienttransform' => true,
				'spreadmethod'      => true,
			),
			'stop'           => array(
				'offset'       => true,
				'stop-color'   => true,
				'stop-opacity' => true,
				'style'        => true,
				'class'        => true,
			),
			'clippath'       => array(
				'id'            => true,
				'clippathunits' => true,
			),
			'mask'           => array(
				'id'               => true,
				'maskunits'        => true,
				'maskcontentunits' => true,
				'x'                => true,
				'y'                => true,
				'width'            => true,
				'height'           => true,
			),
		);
	}

	/**
	 * Discover every data-* and aria-* attribute name in the HTML and allow it on
	 * every tag in the allowlist. kses has no wildcard support, so this replaces
	 * an unmaintainable enumeration of the ~200 data-fg-* hooks the runtime reads.
	 * The names are inert presentational hooks; their values are still
	 * attribute-escaped by kses.
	 *
	 * @param  string                                   $html    HTML being filtered.
	 * @param  array<string, array<string, bool>>       $allowed Static allowlist.
	 * @return array<string, array<string, bool>>
	 */
	private static function permit_dynamic_attributes( string $html, array $allowed ): array {
		if ( ! preg_match_all( '/\b((?:data|aria)-[a-z0-9_-]+)\s*=/i', $html, $matches ) ) {
			return $allowed;
		}

		$dynamic = array_fill_keys( array_map( 'strtolower', $matches[1] ), true );

		foreach ( $allowed as $tag => $attrs ) {
			$allowed[ $tag ] = $attrs + $dynamic;
		}

		return $allowed;
	}
}
