<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Optional contract for render modules that contribute per-render inline CSS,
 * JavaScript, or JSON-LD.
 *
 * Implemented alongside Feature/Decorator/Sidecar by modules whose output must
 * NOT be embedded as raw <style>/<script> inside the collection markup. The
 * render controller collects these separately so page callers can enqueue them
 * (wp_add_inline_style / wp_add_inline_script) and REST/AJAX callers can return
 * them as discrete response fields, leaving the gallery HTML as pure markup
 * that can pass through wp_kses().
 *
 * Every method returns a bare payload with NO wrapping <style>/<script> tags,
 * or '' when the module contributes nothing for the given context.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Inline_Assets {

	/**
	 * Per-render CSS (no <style> tags), or '' if none.
	 *
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function inline_css( Render_Context $render_context ): string;

	/**
	 * Per-render JavaScript (no <script> tags), or '' if none.
	 *
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function inline_js( Render_Context $render_context ): string;

	/**
	 * Per-render JSON-LD document (raw JSON, no <script> tags), or '' if none.
	 *
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	public function json_ld( Render_Context $render_context ): string;
}
