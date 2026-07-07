<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Custom_Code;

use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Inline_Assets;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Outputs scoped, sanitized custom CSS for a gallery or album instance.
 *
 * Scoping
 * -------
 * Every top-level rule is automatically prefixed with the wrapper's unique
 * instance ID selector (e.g. `#fg-123-1`), so custom CSS written for one
 * gallery cannot affect another gallery or the rest of the page.
 *
 * Users may also write the bare token `SELECTOR` (all-caps) anywhere in
 * their CSS to reference the current wrapper explicitly:
 *
 *   SELECTOR .fg-item { border: 2px solid red; }
 *   SELECTOR.fotogrids-collection { background: #fafafa; }
 *
 * `SELECTOR` is replaced with the real `#instance_id` selector before
 * output. Rules that already contain the expanded selector are NOT
 * double-prefixed.
 *
 * Sanitization (defence-in-depth on top of capability-gating)
 * -----------------------------------------------------------
 * The setting is only exposed to users who can edit the gallery. This class
 * adds a second layer, blocking the most common CSS injection vectors:
 *
 *  - `</style>` break-out sequences (including obfuscated variants)
 *  - `@import` (external stylesheet loading / data exfiltration)
 *  - `url( javascript: … )` and `url( data:text/html … )` schemes
 *  - `expression( … )` (legacy IE CSS eval)
 *  - CSS comments stripped before further checks, then re-allowed clean
 *  - Null bytes and ASCII control characters
 *  - Orphan `<` / `>` that could smuggle HTML markup
 *
 * The output is contributed as per-render inline CSS (Inline_Assets::inline_css)
 * rather than embedded as a `<style>` in the markup, so the gallery HTML stays
 * pure and can pass through wp_kses(); the controller enqueues the CSS on page
 * renders and returns it as a response field for AJAX-injected renders.
 *
 * @package FotoGrids\Render\Features\Custom_Code
 * @since   1.0.0
 */
final class Custom_Css implements Feature, Inline_Assets {

	/**
	 * Token users write to reference the current gallery selector.
	 *
	 * Written as the bare word SELECTOR (all-caps, no punctuation).
	 * The token is resolved to the real #instance_id selector before
	 * scoping runs, so rules containing it are never double-prefixed.
	 *
	 * @since 1.0.0
	 */
	private const SELECTOR_TOKEN = 'SELECTOR';

	public function id(): string {
		return 'fotogrids/custom-css';
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
		return $this->resolve_custom_css( $render_context ) !== '';
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * No markup after the wrapper - the scoped CSS is contributed as inline_css.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Returns the scoped, sanitized custom CSS as a bare CSS string (no <style>
	 * tags). Contributed as per-render inline CSS so the gallery markup stays
	 * pure and can pass through wp_kses(); the controller enqueues it (page) or
	 * returns it in the REST response (AJAX-injected renders).
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function inline_css( Render_Context $render_context ): string {
		$custom_css = $this->resolve_custom_css( $render_context );
		if ( '' === $custom_css ) {
			return '';
		}

		$selector = '#' . esc_attr( $render_context->meta->instance_id );

		return $this->scope_css( $custom_css, $selector );
	}

	/**
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function inline_js( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function json_ld( Render_Context $render_context ): string {
		return '';
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}

	/**
	 * Extracts and sanitizes the raw CSS string from render settings.
	 *
	 * Returns '' when the value is absent, non-string, or rejected by the
	 * sanitizer.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	private function resolve_custom_css( Render_Context $render_context ): string {
		$raw = $render_context->settings['custom_css'] ?? '';
		if ( ! is_string( $raw ) ) {
			return '';
		}

		return $this->sanitize( $raw );
	}

	/**
	 * Sanitizes a raw CSS string.
	 *
	 * Removes dangerous constructs while preserving valid CSS. The method is
	 * intentionally strict: when in doubt, reject.
	 *
	 * @since  1.0.0
	 * @param  string $css Raw CSS input from settings storage.
	 * @return string Clean CSS, or '' if nothing safe survives.
	 */
	private function sanitize( string $css ): string {
		// 1. Null bytes and ASCII control characters (except tab/newline/CR).
		$css = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $css );
		if ( ! is_string( $css ) ) {
			return '';
		}

		// 2. Strip CSS block comments entirely before further analysis.
		//    This prevents payloads hidden inside /* ... </style> ... */.
		$css = preg_replace( '#/\*.*?\*/#s', '', $css );
		if ( ! is_string( $css ) ) {
			return '';
		}

		// 3. Reject any </style closing sequence (case-insensitive, with optional
		//    whitespace or slash variations).  A legitimate stylesheet never needs
		//    to close an HTML tag.
		if ( preg_match( '#</\s*style#i', $css ) ) {
			return '';
		}

		// 4. Reject bare < and > to prevent any HTML smuggling.
		if ( strpos( $css, '<' ) !== false || strpos( $css, '>' ) !== false ) {
			return '';
		}

		// 5. Reject @import - prevents external stylesheet loading and exfiltration.
		if ( preg_match( '/@import\b/i', $css ) ) {
			return '';
		}

		// 6. Reject dangerous url() schemes: javascript:, data:text/html, vbscript:.
		if ( preg_match( '#url\s*\(\s*["\']?\s*(javascript|vbscript|data\s*:\s*text/html)#i', $css ) ) {
			return '';
		}

		// 7. Reject expression() - legacy IE CSS evaluation.
		if ( preg_match( '/\bexpression\s*\(/i', $css ) ) {
			return '';
		}

		return trim( $css );
	}

	/**
	 * Scopes every top-level CSS rule to the gallery's instance selector.
	 *
	 * Rules that already contain the `SELECTOR` token are resolved but not
	 * double-prefixed. At-rules (`@media`, `@keyframes`, etc.) are kept as-is
	 * and their inner rules are scoped recursively.
	 *
	 * The algorithm is a lightweight brace-counting parser - it handles nested
	 * at-rules (e.g. `@media { @supports { … } }`) correctly without requiring
	 * a full CSS parser.
	 *
	 * @since  1.0.0
	 * @param  string $css      Sanitized CSS input.
	 * @param  string $selector Real instance selector, e.g. `#fg-123-1`.
	 * @return string
	 */
	private function scope_css( string $css, string $selector ): string {
		// Replace the explicit user token wherever it appears.
		$css = str_replace( self::SELECTOR_TOKEN, $selector, $css );

		$output = '';
		$len    = strlen( $css );
		$i      = 0;

		while ( $i < $len ) {
			// Skip whitespace between top-level rules.
			if ( ctype_space( $css[ $i ] ) ) {
				++$i;
				continue;
			}

			// Find the end of the next top-level rule or block.
			$brace_depth = 0;
			$start       = $i;
			$block_start = false; // position of the first '{', or false

			while ( $i < $len ) {
				$ch = $css[ $i ];

				if ( '{' === $ch ) {
					if ( 0 === $brace_depth ) {
						$block_start = $i;
					}
					++$brace_depth;
				} elseif ( '}' === $ch ) {
					--$brace_depth;
					if ( 0 === $brace_depth ) {
						++$i; // include closing brace
						break;
					}
				} elseif ( ';' === $ch && 0 === $brace_depth ) {
					// Bare declaration at top level (unusual but possible, e.g.
					// a stray `;`). Skip it silently.
					++$i;
					break;
				}

				++$i;
			}

			if ( false === $block_start ) {
				// No `{` found - trailing garbage; skip.
				continue;
			}

			$selector_part = trim( substr( $css, $start, $block_start - $start ) );
			$block_part    = substr( $css, $block_start, $i - $block_start );

			if ( '' === $selector_part ) {
				continue;
			}

			// Detect at-rules: @media, @keyframes, @supports, @layer, etc.
			if ( str_starts_with( $selector_part, '@' ) ) {
				$inner_raw = substr( $block_part, 1, -1 );

				// @keyframes / @-webkit-keyframes contain keyframe stops (from,
				// to, percentages), NOT regular selectors.  Pass the inner block
				// through un-scoped so we don't prefix "from" and "to".
				if ( preg_match( '/^@(-webkit-|-moz-|-o-)?keyframes\b/i', $selector_part ) ) {
					$output .= $selector_part . ' ' . $block_part . "\n";
				} else {
					$inner_scoped = $this->scope_css( $inner_raw, $selector );
					$output      .= $selector_part . " {\n" . $inner_scoped . "}\n";
				}
				continue;
			}

			// Regular rule: scope every comma-separated selector that does not
			// already contain the instance selector (because the user already
			// wrote #SELECTOR# which was expanded above).
			$individual_selectors = explode( ',', $selector_part );
			$scoped_selectors     = array();

			foreach ( $individual_selectors as $sel ) {
				$sel = trim( $sel );
				if ( '' === $sel ) {
					continue;
				}

				// Already contains the real selector - don't double-prefix.
				if ( strpos( $sel, $selector ) !== false ) {
					$scoped_selectors[] = $sel;
				} else {
					$scoped_selectors[] = $selector . ' ' . $sel;
				}
			}

			if ( empty( $scoped_selectors ) ) {
				continue;
			}

			$output .= implode( ",\n", $scoped_selectors ) . ' ' . $block_part . "\n";
		}

		return $output;
	}
}
