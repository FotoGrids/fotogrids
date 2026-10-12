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
 * Engages on `wp` at priority 1, before the SEO plugins read their
 * switches, and only when `Router::view_post()` finds a view page.
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
	 * Keeps its meta description, and its title on theme-rendered pages.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private static function suppress_yoast(): void {
		add_filter( 'wpseo_frontend_presenters', array( __CLASS__, 'filter_yoast_presenters' ) );
	}

	/**
	 * Keep Yoast's meta description presenter, and its title presenter unless
	 * the standalone shell printed a title.
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
	 * RankMath reads `rank_math/frontend/disable_integration` on `wp`.
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
	 * Also unhooks AIOSEO's clearing of `wp_robots`, so the noindex survives.
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
	 * Drops its canonical, robots, Open Graph and Twitter tags.
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
