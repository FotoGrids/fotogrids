<?php
/**
 * Conflict guard between FotoGrids view-page OG and third-party SEO plugins.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

use FotoGrids\Hooks\Actions_View;
use FotoGrids\Hooks\Filters_View;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Suppresses third-party SEO plugins' Open Graph / Twitter / canonical /
 * robots / schema output on FotoGrids view pages.
 *
 * Strategy: FotoGrids owns the view-page URL, so it always emits its own
 * OG markup. To prevent duplicate tags from Yoast / RankMath / All in One
 * SEO / SEOPress on the same page, this class hooks each plugin's documented
 * suppression filters and disables them only while the request is rendering
 * a FotoGrids view page.
 *
 * Detection: a view-page request is one where `Router::view_post()` resolves
 * the main query to a FotoGrids gallery or album when `wp` fires. The
 * suppression filters are registered at that point, ahead of the SEO plugins
 * that read them on `wp`; nothing is registered for non-view-page requests so
 * SEO plugins continue to manage every other URL on the site.
 *
 * Escape hatch: site owners can opt out of suppression entirely via the
 * `fotogrids/view/seo_conflict_guard/enabled` filter. When the broader
 * Plugin Settings SEO tab lands, a "Defer to other SEO plugins on view
 * pages" toggle will short-circuit suppression by returning false from
 * that filter and false from `fotogrids/view/og/enabled`.
 *
 * @since 1.0.0
 */
class SEO_Conflict_Guard {

	/**
	 * Register the late-binding hook that activates suppression on view pages.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function init(): void {
		add_action( 'wp', array( __CLASS__, 'maybe_engage' ), 1 );
	}

	/**
	 * If the current request is a FotoGrids view page, register the
	 * per-plugin suppressors. Otherwise no-op.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function maybe_engage(): void {
		$post = Router::view_post();
		if ( null === $post ) {
			return;
		}

		// When the site owner has chosen to defer to their SEO plugin on view
		// pages, the renderer already short-circuits OG emission. In that
		// mode we MUST NOT suppress the SEO plugin's output - that's the
		// whole point of deferring. The conflict guard only makes sense when
		// FotoGrids is the one emitting OG.
		$seo = \FotoGrids\Settings\SEO_Settings_Store::resolve( (int) $post->ID );
		if ( ! empty( $seo['defer_to_seo_plugins'] ) ) {
			return;
		}

		/**
		 * Master switch for the third-party SEO plugin conflict guard.
		 *
		 * Return false to keep both FotoGrids OG AND the SEO plugin's OG
		 * active (e.g. for debugging differences, or when the site owner
		 * has manually configured the SEO plugin to omit FotoGrids CPTs).
		 * The broader "Defer to other SEO plugins on view pages" setting
		 * in Plugin Settings → SEO is layered on top of this filter.
		 *
		 * @since 1.0.0
		 * @param bool     $enabled Default true.
		 * @param \WP_Post $post    The view-page collection post.
		 */
		$enabled = (bool) apply_filters( Filters_View::SEO_CONFLICT_GUARD_ENABLED, true, $post );
		if ( ! $enabled ) {
			return;
		}

		self::suppress_yoast();
		self::suppress_rankmath();
		self::suppress_aioseo();
		self::suppress_seopress();
	}

	/**
	 * Suppress Yoast SEO's frontend output on this request.
	 *
	 * Drops every presenter except the meta description, which FotoGrids does
	 * not emit, and the title on theme-rendered pages, where Yoast replaces
	 * core's title tag with its own presenter. Yoast's robots directives reach
	 * the page through `wp_robots`, where they merge with the view page's own.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private static function suppress_yoast(): void {
		add_filter( 'wpseo_frontend_presenters', array( __CLASS__, 'filter_yoast_presenters' ) );
	}

	/**
	 * Keep only Yoast's meta description presenter, plus its title presenter
	 * unless the standalone shell has printed its own title.
	 *
	 * @since 1.3.0
	 * @param mixed $presenters Presenter instances.
	 * @return array
	 */
	public static function filter_yoast_presenters( $presenters ): array {
		$keep_title = ! did_action( Actions_View::HEAD );

		return array_values(
			array_filter(
				(array) $presenters,
				static function ( $presenter ) use ( $keep_title ) {
					return is_a( $presenter, 'Yoast\WP\SEO\Presenters\Meta_Description_Presenter' )
						|| ( $keep_title && is_a( $presenter, 'Yoast\WP\SEO\Presenters\Title_Presenter' ) );
				}
			)
		);
	}

	/**
	 * Suppress RankMath's frontend output on this request.
	 *
	 * RankMath gates its frontend presenter through `rank_math/frontend/disable_integration`,
	 * which it reads on `wp` and exits without emitting head metadata when true.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private static function suppress_rankmath(): void {
		add_filter( 'rank_math/frontend/disable_integration', '__return_true' );
	}

	/**
	 * Suppress All in One SEO's frontend output on this request.
	 *
	 * `aioseo_disable` turns off its head output and title rewrites. AIOSEO
	 * also clears every `wp_robots` filter at `wp_head` priority -1 so that
	 * only its own robots tag prints; that step is removed so core's robots
	 * meta, carrying the view page's noindex, still prints.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private static function suppress_aioseo(): void {
		add_filter( 'aioseo_disable', '__return_true' );

		if ( function_exists( 'aioseo' ) && isset( aioseo()->meta->robots ) ) {
			remove_action( 'wp_head', array( aioseo()->meta->robots, 'disableWpRobotsCore' ), -1 );
		}
	}

	/**
	 * Suppress SEOPress's frontend output on this request.
	 *
	 * Empties its canonical and robots tags through `seopress_titles_canonical`
	 * and `seopress_titles_robots`, and unhooks the loader for its Open Graph
	 * and Twitter tags. Its title and meta description are left in place.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private static function suppress_seopress(): void {
		add_filter( 'seopress_titles_canonical', '__return_empty_string' );
		add_filter( 'seopress_titles_robots', '__return_empty_string' );
		remove_action( 'wp_head', 'seopress_load_social_options', 0 );
	}
}
