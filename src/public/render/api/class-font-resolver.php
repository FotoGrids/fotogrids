<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

use FotoGrids\Hooks\Filters_Render;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves font-family, font-weight, and font-style setting values into CSS strings.
 *
 * Acts as the single authoritative translator between raw admin setting values
 * ('Poppins', '700', 'default') and the CSS strings emitted as inline custom
 * properties by decorators and features.
 *
 * Key responsibilities:
 *  - Normalise 'default' / empty / null values to '' (do not emit the var).
 *  - Wrap Google Font names in quotes and append a generic fallback.
 *  - Collect all non-system Google Fonts encountered across every gallery on
 *    the current page render and enqueue a single combined stylesheet once,
 *    before wp_head fires. Deduplicates across multiple galleries on the same
 *    page by keeping state in the singleton instance.
 *  - Fire filterable hooks so Pro (and 3rd parties) can intercept resolution -
 *    for example to expand a typography-set reference like 'typography:big_title'
 *    into the correct CSS value.
 *
 * Usage in a decorator's style_vars():
 *
 *   $resolver = Font_Resolver::instance();
 *   $family   = $resolver->resolve_font_family( $settings['caption_title_font_family'] ?? null, $render_context );
 *   $weight   = $resolver->resolve_font_weight( $settings['caption_title_font_weight'] ?? null, $render_context );
 *   // Both return '' when the setting is 'default' or unset - skip emitting the var in that case.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Font_Resolver {

	/**
	 * System font names that ship with every major OS.
	 *
	 * Anything in this list does not need a Google Fonts stylesheet.
	 * Must stay in sync with FOTOGRIDS_SYSTEM_FONT_OPTIONS in renderFontFamily.js.
	 *
	 * @var array<string>
	 */
	private const SYSTEM_FONTS = array(
		'Arial',
		'Helvetica',
		'Times New Roman',
		'Georgia',
		'Courier New',
	);

	/**
	 * Google Font names collected during this page render, deduplicated.
	 *
	 * @var array<string, true>
	 */
	private array $google_fonts_seen = array();

	/**
	 * Whether the wp_enqueue_scripts hook has already been registered.
	 *
	 * @var bool
	 */
	private bool $enqueue_hook_registered = false;

	/**
	 * Whether the combined Google Fonts stylesheet has already been emitted
	 * (either via wp_enqueue_style at wp_enqueue_scripts time or via the
	 * footer fallback). Prevents double-printing when both passes fire.
	 *
	 * @var bool
	 */
	private bool $stylesheet_printed = false;

	/**
	 * Returns the request-scoped singleton instance.
	 *
	 * One instance per PHP request ensures Google Font names are collected
	 * across all galleries on the same page before wp_head fires.
	 *
	 * @since  1.0.0
	 * @return self
	 */
	public static function instance(): self {
		static $instance = null;

		if ( null === $instance ) {
			$instance = new self();
		}

		return $instance;
	}

	/**
	 * Private constructor - use Font_Resolver::instance().
	 */
	private function __construct() {}

	/**
	 * Resolves a raw font-family setting value to a CSS string.
	 *
	 * Returns '' when the value is 'default', null, or empty - callers should
	 * skip emitting the CSS custom property in that case.
	 *
	 * For non-system fonts the name is collected for Google Fonts loading and
	 * the value is returned as a quoted family name with a sans-serif fallback.
	 *
	 * The resolved value is passed through the filter
	 * 'fotogrids/render/font/resolve_family' so Pro and 3rd parties can
	 * override the result - for example to expand a 'typography:*' reference.
	 *
	 * @since  1.0.0
	 * @param  mixed               $raw    Raw setting value from the settings array.
	 * @param  Render_Context|null $render Render context, passed to filter callbacks.
	 * @return string  CSS value string, or '' to skip emitting the variable.
	 */
	public function resolve_font_family( $raw, ?Render_Context $render = null ): string {
		$normalized = $this->normalize_scalar( $raw );

		// Let Pro / 3rd parties intercept before default resolution.
		// A non-empty string returned by the filter short-circuits local logic.
		$filtered = (string) apply_filters( Filters_Render::FONT_RESOLVE_FAMILY, '', $normalized, $render );
		if ( '' !== $filtered ) {
			return $filtered;
		}

		if ( '' === $normalized ) {
			return '';
		}

		// System fonts: pass through as-is (no Google Fonts needed).
		if ( in_array( $normalized, self::SYSTEM_FONTS, true ) ) {
			return $normalized . ', sans-serif';
		}

		// Non-system font: collect for Google Fonts loading and quote the name.
		$this->collect_google_font( $normalized );

		return '"' . $normalized . '", sans-serif';
	}

	/**
	 * Resolves a raw font-weight setting value to a CSS string.
	 *
	 * Returns '' when the value is 'default', null, or empty.
	 *
	 * The resolved value is passed through the filter
	 * 'fotogrids/render/font/resolve_weight' so Pro and 3rd parties can
	 * override the result.
	 *
	 * @since  1.0.0
	 * @param  mixed               $raw    Raw setting value from the settings array.
	 * @param  Render_Context|null $render Render context, passed to filter callbacks.
	 * @return string  CSS value string ('400', '700', etc.), or '' to skip emitting.
	 */
	public function resolve_font_weight( $raw, ?Render_Context $render = null ): string {
		$normalized = $this->normalize_scalar( $raw );

		// Let Pro / 3rd parties intercept before default resolution.
		$filtered = (string) apply_filters( Filters_Render::FONT_RESOLVE_WEIGHT, '', $normalized, $render );
		if ( '' !== $filtered ) {
			return $filtered;
		}

		if ( '' === $normalized ) {
			return '';
		}

		// Accept numeric weight strings only ('100'–'900').
		if ( preg_match( '/^[1-9]00$/', $normalized ) ) {
			return $normalized;
		}

		return '';
	}

	/**
	 * Resolves a raw font-style setting value to a CSS string.
	 *
	 * Returns '' when the value is 'default', null, or empty.
	 *
	 * The resolved value is passed through the filter
	 * 'fotogrids/render/font/resolve_style' so Pro and 3rd parties can
	 * override the result.
	 *
	 * @since  1.0.0
	 * @param  mixed               $raw    Raw setting value from the settings array.
	 * @param  Render_Context|null $render Render context, passed to filter callbacks.
	 * @return string  CSS value string ('normal' or 'italic'), or '' to skip emitting.
	 */
	public function resolve_font_style( $raw, ?Render_Context $render = null ): string {
		$normalized = $this->normalize_scalar( $raw );

		// Let Pro / 3rd parties intercept before default resolution.
		$filtered = (string) apply_filters( Filters_Render::FONT_RESOLVE_STYLE, '', $normalized, $render );
		if ( '' !== $filtered ) {
			return $filtered;
		}

		if ( '' === $normalized ) {
			return '';
		}

		// Accept the two supported CSS font-style keywords only.
		if ( 'normal' === $normalized || 'italic' === $normalized ) {
			return $normalized;
		}

		return '';
	}

	/**
	 * Registers the hooks that try to enqueue Google Fonts at three points
	 * across the request, in order of preference:
	 *
	 *   1. `wp_enqueue_scripts` priority 20. The cleanest option (stylesheet
	 *      goes into wp_head, no FOUT) but only catches fonts collected
	 *      from sources that resolve BEFORE `the_content` runs - primarily
	 *      View Page renders that go through a template hook before
	 *      wp_head, and admin previews.
	 *   2. `wp_footer` priority 1. Catches fonts collected during normal
	 *      shortcode/block rendering inside `the_content`, which fires
	 *      after wp_head and after the original enqueue window has closed.
	 *      Emits the stylesheet via `<link>` printed directly into the
	 *      footer because the wp_enqueue_styles pipeline is long past.
	 *   3. `wp_print_footer_scripts` as a last-chance backstop for late
	 *      registrations from pagination / AJAX-album flows.
	 *
	 * Called from boot.php once per request. Safe to call multiple times -
	 * the hooks are only registered on the first call.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public function register_enqueue_hook(): void {
		if ( $this->enqueue_hook_registered ) {
			return;
		}

		$this->enqueue_hook_registered = true;

		// First pass - best case, lands in wp_head.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_google_fonts' ), 20 );

		// Footer pass - catches fonts collected during the_content
		// rendering (the common case for shortcodes / blocks).
		add_action( 'wp_footer', array( $this, 'print_google_fonts_footer' ), 1 );
		add_action( 'wp_print_footer_scripts', array( $this, 'print_google_fonts_footer' ), 1 );
	}

	/**
	 * Enqueues a single combined Google Fonts stylesheet for all collected fonts.
	 *
	 * Called automatically via the wp_enqueue_scripts hook registered in
	 * register_enqueue_hook(). Skips silently when no Google Fonts have been
	 * collected yet (the common case - the_content hasn't run at this point
	 * for shortcodes/blocks; see print_google_fonts_footer() for the second
	 * pass that handles that case).
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public function enqueue_google_fonts(): void {
		if ( $this->stylesheet_printed ) {
			return;
		}
		if ( empty( $this->google_fonts_seen ) ) {
			return;
		}

		$url = $this->build_google_fonts_url( array_keys( $this->google_fonts_seen ) );
		if ( '' === $url ) {
			return;
		}

		// Version is intentionally null: $url is an external Google Fonts URL
		// that carries its own versioning; appending ?ver= would be wrong.
		// phpcs:disable WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_enqueue_style(
			'fotogrids-google-fonts',
			$url,
			array(),
			null // No version - Google Fonts URLs are self-versioning.
		);
		// phpcs:enable WordPress.WP.EnqueuedResourceParameters.MissingVersion

		$this->stylesheet_printed = true;
	}

	/**
	 * Footer fallback for fonts that were collected after wp_enqueue_scripts
	 * already fired. Registers, enqueues, and prints the stylesheet through
	 * WordPress at footer time via wp_print_styles().
	 *
	 * Idempotent across both wp_footer and wp_print_footer_scripts (whichever
	 * fires first wins - the second call returns early).
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public function print_google_fonts_footer(): void {
		if ( $this->stylesheet_printed ) {
			return;
		}
		if ( empty( $this->google_fonts_seen ) ) {
			return;
		}

		$url = $this->build_google_fonts_url( array_keys( $this->google_fonts_seen ) );
		if ( '' === $url ) {
			return;
		}

		$this->stylesheet_printed = true;

		// wp_enqueue_scripts has already fired by footer time, so the stylesheet
		// is registered, enqueued, and printed through WordPress here (rather than
		// echoed as a raw <link>). Version is null because Google Fonts URLs carry
		// their own versioning.
		// phpcs:disable WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_register_style( 'fotogrids-google-fonts', $url, array(), null );
		// phpcs:enable WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_enqueue_style( 'fotogrids-google-fonts' );
		wp_print_styles( 'fotogrids-google-fonts' );
	}

	/**
	 * Returns the combined Google Fonts stylesheet URL for every font collected
	 * so far this request, or '' if none were collected.
	 *
	 * Unlike enqueue_google_fonts() / print_google_fonts_footer(), this does NOT
	 * mark the stylesheet as printed and does not touch WordPress enqueue/footer
	 * hooks. It exists for REST flows (gallery unlock, album-to-gallery AJAX)
	 * that render a gallery in a separate request whose wp_footer never reaches
	 * the visitor's already-loaded page - those handlers read this URL and
	 * return it in the JSON response so the client can inject the <link>
	 * itself. See Gallery_Data::unlock_gallery() / render_gallery().
	 *
	 * @since  1.0.0
	 * @return string Combined Google Fonts URL, or '' when no fonts collected.
	 */
	public function get_collected_fonts_url(): string {
		if ( empty( $this->google_fonts_seen ) ) {
			return '';
		}

		return $this->build_google_fonts_url( array_keys( $this->google_fonts_seen ) );
	}

	/**
	 * Collects a Google Font name and ensures the enqueue hook is registered.
	 *
	 * Gated on the `fotogrids_allow_google_fonts` option (on by default). When
	 * an administrator turns it off, no font is collected, so no
	 * fonts.googleapis.com stylesheet is ever enqueued or printed for visitors;
	 * the CSS font-family is still emitted, so the browser falls back to the
	 * system font stack.
	 *
	 * @since  1.0.0
	 * @param  string $family Font family name.
	 * @return void
	 */
	private function collect_google_font( string $family ): void {
		if ( ! get_option( 'fotogrids_allow_google_fonts', true ) ) {
			return;
		}
		$this->google_fonts_seen[ $family ] = true;
		$this->register_enqueue_hook();
	}

	/**
	 * Builds a combined Google Fonts API v2 URL for the given font families.
	 *
	 * Requests regular (400) weight for all fonts - individual weight loading
	 * is handled by the inline CSS custom property, not the stylesheet URL.
	 *
	 * @since  1.0.0
	 * @param  array<string> $families Font family names.
	 * @return string
	 */
	private function build_google_fonts_url( array $families ): string {
		if ( empty( $families ) ) {
			return '';
		}

		$params = array_map(
			static function ( string $family ): string {
				return 'family=' . rawurlencode( $family ) . ':wght@100;200;300;400;500;600;700;800;900';
			},
			$families
		);

		return 'https://fonts.googleapis.com/css2?' . implode( '&', $params ) . '&display=swap';
	}

	/**
	 * Normalises a raw setting value to a plain string, treating 'default' as empty.
	 *
	 * @since  1.0.0
	 * @param  mixed $raw Raw setting value.
	 * @return string
	 */
	private function normalize_scalar( $raw ): string {
		if ( null === $raw || '' === $raw || 'default' === $raw ) {
			return '';
		}

		if ( ! is_string( $raw ) ) {
			return '';
		}

		return trim( $raw );
	}
}
