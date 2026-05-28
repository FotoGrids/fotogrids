<?php
/**
 * Conflict guard between FotoGrids view-page OG and third-party SEO plugins.
 *
 * @package FotoGrids\Modules\ViewCollections
 * @since   1.0.0
 */

namespace FotoGrids\Modules\ViewCollections;

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
 * Detection: a view-page request is one where `Router::current_post()` is
 * non-null at the time `template_redirect` fires (the router has resolved
 * the request to a FotoGrids gallery or album). The suppression filters
 * are registered at that point; nothing is registered for non-view-page
 * requests so SEO plugins continue to manage every other URL on the site.
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
        add_action( 'template_redirect', array( __CLASS__, 'maybe_engage' ), 1 );
    }

    /**
     * If the current request is a FotoGrids view page, register the
     * per-plugin suppressors. Otherwise no-op.
     *
     * @since 1.0.0
     * @return void
     */
    public static function maybe_engage(): void {
        $post = Router::current_post();
        if ( ! $post instanceof \WP_Post ) {
            return;
        }

        // When the site owner has chosen to defer to their SEO plugin on view
        // pages, the renderer already short-circuits OG emission. In that
        // mode we MUST NOT suppress the SEO plugin's output — that's the
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
        $enabled = (bool) apply_filters( 'fotogrids/view/seo_conflict_guard/enabled', true, $post );
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
     * Yoast emits its presentation through a single `wpseo_frontend_presenters`
     * filter. Returning an empty array drops every presenter (OG, Twitter,
     * canonical, robots, schema, title), which is exactly the right surface
     * for a FotoGrids-owned page.
     *
     * @since 1.0.0
     * @return void
     */
    private static function suppress_yoast(): void {
        add_filter( 'wpseo_frontend_presenters', '__return_empty_array' );
    }

    /**
     * Suppress RankMath's frontend output on this request.
     *
     * RankMath gates its frontend presenter through `rank_math/frontend/disable_integration`.
     * The plugin checks this filter early in `\RankMath\Frontend\Frontend` and
     * exits without emitting head metadata when true.
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
     * AIOSEO exposes per-surface disable filters; we cover OG, Twitter, the
     * page-level meta block, schema graph, and the robots header so the
     * FotoGrids markup is the only voice on the page.
     *
     * @since 1.0.0
     * @return void
     */
    private static function suppress_aioseo(): void {
        add_filter( 'aioseo_disable', '__return_true' );
        add_filter( 'aioseo_disable_meta_tags', '__return_true' );
        add_filter( 'aioseo_disable_schema', '__return_true' );
    }

    /**
     * Suppress SEOPress's frontend output on this request.
     *
     * SEOPress reads `seopress_titles_single_titles_disable` and a parallel
     * `seopress_titles_single_metadesc_disable` to skip title/description
     * output, plus dedicated filters for OG and Twitter. Combined, these
     * stop SEOPress from emitting anything on a FotoGrids view page.
     *
     * @since 1.0.0
     * @return void
     */
    private static function suppress_seopress(): void {
        add_filter( 'seopress_titles_single_titles_disable',   '__return_true' );
        add_filter( 'seopress_titles_single_metadesc_disable', '__return_true' );
        add_filter( 'seopress_social_og_disable',              '__return_true' );
        add_filter( 'seopress_social_twitter_card_disable',    '__return_true' );
    }
}
