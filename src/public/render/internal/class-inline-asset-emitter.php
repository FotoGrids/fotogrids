<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Hooks\Filters_Render;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Emits a render result's per-render inline CSS/JS/JSON-LD for direct page
 * output.
 *
 * The render pipeline no longer embeds <style>/<script> inside the collection
 * markup; it exposes them on Render_Result. On a normal page render this class
 * enqueues the CSS (a dedicated inline stylesheet handle) and JS (attached to
 * the always-present frontend runtime) and prints the JSON-LD in wp_footer.
 *
 * REST/AJAX renders are self-gated out here: those responses return the inline
 * assets as discrete fields for the client to inject, since a server-side
 * enqueue would never reach the already-loaded page.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Inline_Asset_Emitter {

	/**
	 * Handle prefix for the dedicated (src-less) per-render inline stylesheet the
	 * per-gallery CSS variables attach to. A unique handle per render keeps each
	 * gallery's inline block independently printable when several share a page.
	 */
	private const STYLE_HANDLE_PREFIX = 'fotogrids-inline-';

	/**
	 * Frontend runtime script handle (always enqueued) the inline JS attaches to.
	 */
	private const SCRIPT_HANDLE = 'fotogrids-runtime';

	/**
	 * @var int Monotonic counter guaranteeing a unique inline style handle per render.
	 */
	private static int $style_seq = 0;

	/**
	 * @var array<int, string> JSON-LD documents queued for the footer.
	 */
	private static array $pending_json_ld = array();

	/**
	 * @var bool Whether the wp_footer JSON-LD printer is hooked.
	 */
	private static bool $json_ld_hooked = false;

	/**
	 * Enqueue a render result's inline assets for direct page output.
	 *
	 * No-op in REST/AJAX requests (the response returns the assets instead) and
	 * when the result carries no inline assets.
	 *
	 * @since  1.0.0
	 * @param  Render_Result $result Render result.
	 * @return void
	 */
	public static function enqueue( Render_Result $result ): void {
		if ( wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}

		if ( '' !== $result->inline_css ) {
			self::emit_inline_css( $result->inline_css );
		}

		if ( '' !== $result->inline_js && wp_script_is( self::SCRIPT_HANDLE, 'registered' ) ) {
			wp_add_inline_script( self::SCRIPT_HANDLE, $result->inline_js );
		}

		if ( '' !== $result->json_ld ) {
			self::queue_json_ld( $result->json_ld );
		}
	}

	/**
	 * Register a unique src-less handle for this render's inline CSS, attach the
	 * CSS to it, and - when the document head has already printed (the classic
	 * "shortcode rendered in the_content past wp_head" case) - force-print it
	 * immediately so the per-gallery layout variables actually reach the page.
	 * Mirrors Asset_Resolver::flush()'s late-print behaviour.
	 *
	 * @param  string $inline_css Bare CSS (no <style> tags).
	 * @return void
	 */
	private static function emit_inline_css( string $inline_css ): void {
		$handle = self::STYLE_HANDLE_PREFIX . (string) ++self::$style_seq;

		wp_register_style( $handle, false, array(), FOTOGRIDS_VERSION );
		wp_enqueue_style( $handle );
		wp_add_inline_style( $handle, $inline_css );

		$default_inline = did_action( 'wp_head' ) > 0 || did_action( 'admin_head' ) > 0;
		$should_inline  = (bool) apply_filters( Filters_Render::SHOULD_INLINE_ASSETS, $default_inline );

		if ( $should_inline ) {
			wp_print_styles( $handle );
		}
	}

	/**
	 * Queue a JSON-LD document for printing in wp_footer.
	 *
	 * @param  string $json_ld Bare JSON-LD document.
	 * @return void
	 */
	private static function queue_json_ld( string $json_ld ): void {
		self::$pending_json_ld[] = $json_ld;
		if ( self::$json_ld_hooked ) {
			return;
		}
		self::$json_ld_hooked = true;
		add_action( 'wp_footer', array( __CLASS__, 'print_json_ld' ), 20 );
	}

	/**
	 * Print queued JSON-LD documents. Bound to wp_footer.
	 *
	 * @return void
	 */
	public static function print_json_ld(): void {
		foreach ( self::$pending_json_ld as $json_ld ) {
			// Guard against a "</script>" sequence breaking out of the tag; the
			// payload is inert JSON-LD structured data, not executable script.
			$safe = str_replace( '</', '<\/', $json_ld );
			echo '<script type="application/ld+json">' . $safe . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Inert schema.org JSON-LD data (not executable); break-out sequence neutralised above. JSON-LD cannot be enqueued.
		}
		self::$pending_json_ld = array();
	}
}
