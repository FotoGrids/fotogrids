<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Collection_Header;

use FotoGrids\Hooks\Filters_Breadcrumb;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Builds a schema.org BreadcrumbList JSON-LD block for a gallery → album
 * trail and returns it as a ready-to-emit `<script type="application/ld+json">`
 * string.
 *
 * Called from Collection_Header::html_appendix() - so the schema is only
 * built when the visible header is being built. The schema mirrors the
 * visible breadcrumb exactly: parent album, then current gallery.
 *
 * Gates:
 *   - The album's per-collection `navigation_emit_breadcrumb_schema`
 *     toggle (default true) - flip off when an SEO plugin already emits.
 *   - The `is_ajax_swap` meta flag - never emit on Album → Gallery
 *     AJAX swaps. The page URL hasn't changed; emitting schema for the
 *     swapped-in gallery would describe content that doesn't match the
 *     canonical URL Google crawled.
 *   - The `fotogrids/breadcrumb/should_emit_schema` filter - final
 *     opt-out used by Pro SEO integrations.
 *
 * @package FotoGrids\Render\Features\Collection_Header
 * @since   1.0.0
 */
final class Breadcrumb_Schema {

	/**
	 * Build the JSON-LD schema string, or return '' when emission is
	 * suppressed by any of the gates.
	 *
	 * @since 1.0.0
	 * @param int                  $gallery_id    Gallery being rendered.
	 * @param int                  $album_id      Resolved parent album.
	 * @param array<string, mixed> $album_settings Album settings map.
	 * @param bool                 $is_ajax_swap  True if this render is producing an AJAX swap payload.
	 * @return string Empty string when suppressed.
	 */
	public static function build( int $gallery_id, int $album_id, array $album_settings, bool $is_ajax_swap ): string {
		if ( $is_ajax_swap ) {
			return '';
		}

		$schema_enabled = (bool) ( $album_settings['navigation_emit_breadcrumb_schema'] ?? true );
		if ( ! $schema_enabled ) {
			return '';
		}

		$context = array(
			'source' => (string) ( $album_settings['navigation_breadcrumb_source'] ?? 'fotogrids' ),
		);

		/**
		 * Final opt-out for the BreadcrumbList JSON-LD. Return false to
		 * suppress emission - used by Pro / third-party SEO plugin
		 * integrations that emit their own BreadcrumbList for the same
		 * URL and don't want a duplicate from FotoGrids.
		 *
		 * @since 1.0.0
		 * @param bool  $should_emit Whether to emit FotoGrids' schema.
		 * @param int   $gallery_id  Gallery being rendered.
		 * @param int   $album_id    Resolved parent album.
		 * @param array $context     ['source' => 'fotogrids'|'auto'|'yoast'|'rank_math']
		 */
		$should_emit = apply_filters( Filters_Breadcrumb::SHOULD_EMIT_SCHEMA, true, $gallery_id, $album_id, $context );
		if ( ! $should_emit ) {
			return '';
		}

		$album_post   = get_post( $album_id );
		$gallery_post = get_post( $gallery_id );
		if ( ! $album_post || ! $gallery_post ) {
			return '';
		}

		$album_permalink   = (string) get_permalink( $album_post );
		$gallery_permalink = (string) get_permalink( $gallery_post );
		if ( '' === $album_permalink ) {
			// Without a URL for the album, the BreadcrumbList lacks the
			// back-link Google needs - skip rather than emit a partial one.
			return '';
		}

		$album_title   = (string) get_the_title( $album_post );
		$gallery_title = (string) get_the_title( $gallery_post );

		$schema = array(
			'@context'        => 'https://schema.org',
			'@type'           => 'BreadcrumbList',
			'itemListElement' => array(
				array(
					'@type'    => 'ListItem',
					'position' => 1,
					'name'     => '' !== $album_title ? $album_title : __( 'Album', 'fotogrids' ),
					'item'     => $album_permalink,
				),
				array(
					'@type'    => 'ListItem',
					'position' => 2,
					'name'     => '' !== $gallery_title ? $gallery_title : __( 'Gallery', 'fotogrids' ),
					// The final item intentionally omits `item` per
					// Google's BreadcrumbList guidance - it's the current
					// page and adding the URL is discouraged.
				),
			),
		);

		// The current gallery's URL helps deduplication / canonicalisation
		// when the page URL doesn't match the gallery permalink (e.g.
		// embedded on a Portfolio page). Google's guidance is mixed on
		// including it for the leaf; we include it only when we have one
		// because some validators complain about an empty leaf URL too.
		if ( '' !== $gallery_permalink ) {
			$schema['itemListElement'][1]['item'] = $gallery_permalink;
		}

		$json = wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $json ) || '' === $json ) {
			return '';
		}

		// Inline script. Output is JSON, no need for esc_js() - the
		// surrounding type="application/ld+json" tells the browser to
		// parse it as data, not JavaScript.
		return '<script type="application/ld+json" class="fg-breadcrumb-schema">' . $json . '</script>';
	}
}
