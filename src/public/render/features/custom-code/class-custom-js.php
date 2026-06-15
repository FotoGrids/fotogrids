<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Custom_Code;

use FotoGrids\Hooks\Filters_Features;
use FotoGrids\Hooks\Filters_Render;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Outputs a sandboxed, sanitized custom JS block for a gallery or album instance.
 *
 * IIFE wrapping
 * -------------
 * The user's code is wrapped in an Immediately Invoked Function Expression so
 * that variables declared inside it do not leak into the global scope. Two
 * identifiers are injected as IIFE parameters for convenience:
 *
 *   collection  - the live DOM element for this gallery/album instance,
 *                 equivalent to document.getElementById('COLLECTION_ID').
 *                 Will be `null` if the element is not found at execution time
 *                 (defensive coding: always check `if (collection) { … }`).
 *
 * Users may also write the bare token `COLLECTION_ID` (all-caps, no
 * punctuation) anywhere in their code to reference the current instance ID
 * string explicitly:
 *
 *   const el = document.getElementById('COLLECTION_ID');
 *   el.addEventListener('click', handler);
 *
 * `COLLECTION_ID` is replaced with the real instance ID (single-quoted string,
 * no surrounding quotes needed - the substitution includes them) before the
 * IIFE is emitted. Example output after substitution:
 *
 *   (function(collection) {
 *       const el = document.getElementById('fg-123-1');
 *       // …
 *   })(document.getElementById('fg-123-1'));
 *
 * Placement
 * ---------
 * The `<script>` block is emitted via html_after(), placing it immediately
 * after the collection wrapper in the DOM. This guarantees the `collection`
 * element already exists when the script runs - no DOMContentLoaded wrapper
 * is needed for simple DOM queries.
 *
 * Sanitization (defence-in-depth on top of capability-gating)
 * -----------------------------------------------------------
 * Only users who can edit the collection (manage_fotogrids) can save
 * custom JS. This class adds a second layer as output-time defence:
 *
 *  - Null bytes and ASCII control characters stripped.
 *  - JS block comments (/* … *\/) and line comments (// …) stripped before
 *    further analysis, preventing payloads hidden across comment boundaries.
 *  - `</script` closing sequences (case-insensitive, with whitespace variants)
 *    rejected - a legitimate script block never needs to close an HTML tag.
 *  - Bare `<` and `>` rejected - prevents smuggling a second `<script>` tag
 *    or other HTML inside the block.
 *
 * Dynamic execution gate
 * ----------------------
 * By default, dynamic code execution constructs are also blocked:
 *
 *  - eval(…)
 *  - new Function(…) / Function(…)
 *  - setTimeout / setInterval called with a string argument (the string-eval
 *    form). The callback form - setTimeout(fn, ms) - is not affected.
 *
 * These restrictions are deliberately narrow. `fetch`, `XMLHttpRequest`,
 * `document`, `window`, `cookie`, and all other browser APIs remain allowed -
 * they are legitimate gallery JS patterns and blocking them would be
 * security theatre.
 *
 * Administrators are never subject to the dynamic execution restriction -
 * it exists to protect against lower-privilege roles that have gallery
 * editing access. For non-administrators, the restriction can be lifted by
 * enabling the `custom_js_allow_dynamic_execution` setting on the collection
 * (which inherits its default from the global plugin option), OR by filtering
 * `fotogrids/features/custom_js/allow_dynamic_execution`. The filter is the
 * hook point for the future Permissions Manager:
 *
 *   add_filter(
 *       'fotogrids/features/custom_js/allow_dynamic_execution',
 *       function( bool $allowed, Render_Context $ctx ): bool {
 *           // Grant per-role, per-collection, or globally.
 *           return current_user_can( 'manage_options' );
 *       },
 *       10, 2
 *   );
 *
 * Developer filters
 * -----------------
 * Two filters allow Pro or third-party plugins to extend the sanitizer and
 * the final output without replacing the class:
 *
 *   fotogrids/render/custom_js/sanitize
 *     Called after the built-in sanitizer. Receives the sanitized string, the
 *     original raw string, and the Render_Context. Return '' to suppress output.
 *     Signature: ( string $sanitized, string $raw, Render_Context $context ) : string
 *
 *   fotogrids/render/custom_js/output
 *     Called on the final <script> HTML string before it is returned. Useful
 *     for injecting a CSP nonce attribute or other script attributes.
 *     Signature: ( string $script_html, Render_Context $context ) : string
 *
 * @package FotoGrids\Render\Features\Custom_Code
 * @since   1.0.0
 */
final class Custom_Js implements Feature {

	/**
	 * Token users write to reference the current collection instance ID.
	 *
	 * Written as the bare word COLLECTION_ID (all-caps, no punctuation).
	 * The token is resolved to a single-quoted JS string literal of the real
	 * instance ID before the IIFE wrapper is emitted.
	 *
	 * @since 1.0.0
	 */
	private const COLLECTION_ID_TOKEN = 'COLLECTION_ID';

	public function id(): string {
		return 'fotogrids/custom-js';
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
		return $this->resolve_custom_js( $render_context ) !== '';
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Returns a sandboxed, sanitized `<script>` block placed after the wrapper.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function html_after( Render_Context $render_context ): string {
		$custom_js = $this->resolve_custom_js( $render_context );
		if ( '' === $custom_js ) {
			return '';
		}

		$instance_id = $render_context->meta->instance_id;
		$escaped_id  = esc_js( $instance_id );
		$wrapped_js  = $this->wrap_iife( $custom_js, $escaped_id );

		$script_html = '<script class="fg-custom-js">' . "\n" . $wrapped_js . "\n" . '</script>';

		/**
		 * Filters the final <script> HTML string.
		 *
		 * Use this to add a CSP nonce attribute, a type attribute, or any
		 * other script tag modification. Return a non-string or empty string
		 * to suppress the output entirely.
		 *
		 * @since 1.0.0
		 * @param string         $script_html  The full <script>…</script> block.
		 * @param Render_Context $render_context Render context.
		 */
		$filtered = apply_filters( Filters_Render::CUSTOM_JS_OUTPUT, $script_html, $render_context );

		return is_string( $filtered ) ? $filtered : '';
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
	 * Extracts and sanitizes the raw JS string from render settings.
	 *
	 * Returns '' when the value is absent, non-string, or rejected by the
	 * sanitizer.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	private function resolve_custom_js( Render_Context $render_context ): string {
		$raw = $render_context->settings['custom_js'] ?? '';
		if ( ! is_string( $raw ) || '' === $raw ) {
			return '';
		}

		$allow_dynamic = $this->allow_dynamic_execution( $render_context );
		$sanitized     = $this->sanitize( $raw, $allow_dynamic );

		/**
		 * Filters the sanitized JS string after the built-in sanitizer runs.
		 *
		 * Return '' to suppress output. Return the original $raw to bypass all
		 * built-in checks (use with care - only for fully trusted contexts).
		 *
		 * @since 1.0.0
		 * @param string         $sanitized      Output of the built-in sanitizer, or '' if rejected.
		 * @param string         $raw            Original unsanitized value from settings.
		 * @param Render_Context $render_context Render context.
		 */
		$filtered = apply_filters( Filters_Render::CUSTOM_JS_SANITIZE, $sanitized, $raw, $render_context );

		return is_string( $filtered ) ? trim( $filtered ) : '';
	}

	/**
	 * Resolves whether dynamic code execution is permitted for this render.
	 *
	 * Administrators are always allowed - the restriction only applies to
	 * lower-privilege roles that have gallery editing access. For everyone
	 * else, the per-collection setting (which defaults to the global plugin
	 * option) is the baseline, and the filter is the override point for the
	 * Permissions Manager and other access-control integrations.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return bool
	 */
	private function allow_dynamic_execution( Render_Context $render_context ): bool {
		// Administrators are never restricted.
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		$setting_value = ! empty( $render_context->settings['custom_js_allow_dynamic_execution'] );

		/**
		 * Filters whether dynamic code execution (eval, Function constructor,
		 * string-form setTimeout/setInterval) is permitted in custom JS.
		 *
		 * Off by default. Enable only for explicitly trusted contexts.
		 *
		 * @since 1.0.0
		 * @param bool           $allowed        Whether dynamic execution is currently allowed.
		 * @param Render_Context $render_context Render context.
		 */
		$filtered = apply_filters(
			Filters_Features::CUSTOM_JS_ALLOW_DYNAMIC,
			$setting_value,
			$render_context
		);

		return (bool) $filtered;
	}

	/**
	 * Sanitizes a raw JS string.
	 *
	 * Removes dangerous constructs while preserving valid JavaScript. The method
	 * is intentionally focused on HTML-breakout prevention rather than attempting
	 * a full JS sandbox - that would be security theatre for a capability-gated
	 * field. When in doubt, the input is rejected entirely.
	 *
	 * @since  1.0.0
	 * @param  string $js             Raw JS input from settings storage.
	 * @param  bool   $allow_dynamic  Whether eval / Function / string timers are permitted.
	 * @return string Clean JS, or '' if nothing safe survives.
	 */
	private function sanitize( string $js, bool $allow_dynamic ): string {
		// 1. Null bytes and ASCII control characters (except tab/newline/CR).
		$js = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $js );
		if ( ! is_string( $js ) ) {
			return '';
		}

		// 2. Strip JS block comments /* … */ before further analysis.
		//    This prevents payloads hidden inside /* </script> */ boundaries.
		$js = preg_replace( '#/\*.*?\*/#s', '', $js );
		if ( ! is_string( $js ) ) {
			return '';
		}

		// 3. Strip JS line comments // … (to end of line).
		//    Prevents payloads like:  // </script><script>evil()
		$js = preg_replace( '#//[^\r\n]*#', '', $js );
		if ( ! is_string( $js ) ) {
			return '';
		}

		// 4. Reject any </script closing sequence (case-insensitive, with optional
		//    whitespace or slash variants). A legitimate script block never needs to
		//    close an HTML tag.
		if ( preg_match( '#</\s*script#i', $js ) ) {
			return '';
		}

		// 5. Reject bare < and > to prevent HTML smuggling (e.g. a second <script>
		//    tag injected inside the block).
		if ( strpos( $js, '<' ) !== false || strpos( $js, '>' ) !== false ) {
			return '';
		}

		// 6. Dynamic execution gate - blocked unless explicitly enabled.
		//    eval()           - direct JS evaluation.
		//    Function(…)      - Function constructor (equivalent to eval).
		//    new Function(…)  - same, with new keyword.
		//    setTimeout / setInterval with a string first argument - the string
		//    is evaluated as code. The callback form (fn, ms) is legitimate and
		//    is NOT blocked (we check for a quote character after the opening
		//    parenthesis to distinguish the two forms).
		if ( ! $allow_dynamic ) {
			if ( preg_match( '/\beval\s*\(/i', $js ) ) {
				return '';
			}

			if ( preg_match( '/\bFunction\s*\(/i', $js ) ) {
				return '';
			}

			if ( preg_match( '/\b(setTimeout|setInterval)\s*\(\s*[\'"`]/i', $js ) ) {
				return '';
			}
		}

		return trim( $js );
	}

	/**
	 * Wraps the user's code in a scoped IIFE.
	 *
	 * The IIFE receives the live collection DOM element as its first parameter
	 * (`collection`). The COLLECTION_ID token is replaced with the single-quoted
	 * instance ID string before wrapping.
	 *
	 * @since  1.0.0
	 * @param  string $js          Sanitized JS input.
	 * @param  string $escaped_id  esc_js()-escaped instance ID (no surrounding quotes).
	 * @return string
	 */
	private function wrap_iife( string $js, string $escaped_id ): string {
		// Replace the explicit user token with a single-quoted JS string literal.
		$js = str_replace( self::COLLECTION_ID_TOKEN, "'" . $escaped_id . "'", $js );

		return sprintf(
			"(function(collection) {\n%s\n})(document.getElementById('%s'));",
			$js,
			$escaped_id
		);
	}
}
