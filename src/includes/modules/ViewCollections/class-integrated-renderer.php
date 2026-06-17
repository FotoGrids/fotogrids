<?php
/**
 * Integrated mode renderer: lets the active theme render the page and injects
 * the gallery/album via standard WordPress hooks.
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
 * Integrates view pages with the active theme.
 *
 * When `View_Settings_Store::layout_mode === 'integrated'`, the Router lets
 * WordPress resolve the singular template normally; the theme owns the
 * document. This class is what makes that document actually show the gallery:
 * it injects the rendered gallery/album into `the_content`, emits the document
 * title via `pre_get_document_title`, the head meta (robots, canonical, OG)
 * via `wp_head`, the body classes via `body_class`, enqueues the gallery
 * assets via `wp_enqueue_scripts`, and records the view stat from
 * `template_redirect`.
 *
 * Five behavioural toggles ride the same class:
 *   - integrated_show_title_block      - emit our <h1>+count strip above the gallery
 *   - integrated_hide_featured_image   - suppress the theme's post-thumbnail render
 *   - integrated_allow_comments        - opt-in comments support
 *   - integrated_include_in_archives   - opt-in author/date archive inclusion
 *   - integrated_post_navigation       - opt-in previous/next post navigation
 *
 * Each toggle has a `fotogrids/view/integrated/{key}` filter for programmatic
 * override (used by Pro and 3rd-party plugins).
 *
 * @since 1.0.0
 */
class Integrated_Renderer {

	/**
	 * Post types the Integrated renderer applies to.
	 *
	 * @var string[]
	 */
	private const POST_TYPES = array( 'fotogrids_gallery', 'fotogrids_album' );

	/**
	 * Per-request cache: have we already enqueued for this post?
	 *
	 * @var int 0 when not yet enqueued, post id when enqueued.
	 */
	private static int $enqueued_for = 0;

	/**
	 * Per-request cache: have we already recorded the view stat?
	 *
	 * @var int 0 when not yet tracked, post id when tracked.
	 */
	private static int $tracked_for = 0;

	/**
	 * Register all the WordPress hooks.
	 *
	 * Called once from Module::init() (on every request, not gated by mode).
	 * Each hook callback re-evaluates `should_run()` per request so a runtime
	 * change to layout_mode takes effect without requiring re-registration.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function init(): void {
		// CPT-level support (comments) needs to be added at registration time.
		// We hook it on `init` after the CPTs are registered (priority 11 in
		// Post_Types::register_cpts; we run at 20 to be safe).
		add_action( 'init', array( __CLASS__, 'register_cpt_support' ), 20 );

		// Singular-request hooks. All gated on `should_run()`, which checks
		// both layout_mode and is_singular(CPTs).
		add_filter( 'the_content', array( __CLASS__, 'inject_gallery' ), 20 );
		add_filter( 'pre_get_document_title', array( __CLASS__, 'filter_document_title' ) );
		add_action( 'wp_head', array( __CLASS__, 'emit_head_meta' ), 5 );
		add_filter( 'body_class', array( __CLASS__, 'filter_body_classes' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'template_redirect', array( __CLASS__, 'track_view' ), 20 );

		// Five behavioural toggles.
		add_filter( 'post_thumbnail_html', array( __CLASS__, 'maybe_hide_featured_image' ), 10, 2 );
		add_filter( 'comments_open', array( __CLASS__, 'filter_comments_open' ), 10, 2 );
		add_action( 'pre_get_posts', array( __CLASS__, 'filter_archives' ) );
		add_filter( 'get_previous_post_where', array( __CLASS__, 'filter_post_navigation_where' ), 10, 5 );
		add_filter( 'get_next_post_where', array( __CLASS__, 'filter_post_navigation_where' ), 10, 5 );
	}

	/**
	 * Whether the renderer should engage for the current singular request.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	private static function should_run(): bool {
		if ( ! is_singular( self::POST_TYPES ) ) {
			return false;
		}

		return self::layout_mode() === 'integrated';
	}

	/**
	 * Resolve the current layout mode, respecting the per-request filter.
	 *
	 * Mirrors Router::route()'s `fotogrids/view/layout_mode` resolution so
	 * Pro overrides take effect uniformly.
	 *
	 * @since 1.0.0
	 * @return string 'integrated' | 'standalone'
	 */
	private static function layout_mode(): string {
		$settings = \FotoGrids\Settings\View_Settings_Store::get();
		$mode     = isset( $settings['layout_mode'] ) ? (string) $settings['layout_mode'] : 'integrated';

		$post = get_queried_object();
		if ( $post instanceof \WP_Post ) {
			/** This filter is documented in Plugin/src/includes/modules/ViewCollections/class-router.php */
			$mode = (string) apply_filters( Filters_View::LAYOUT_MODE, $mode, $post );
		}

		return $mode;
	}

	/**
	 * Convenience: resolve and return the view settings array.
	 *
	 * @since 1.0.0
	 * @return array<string,mixed>
	 */
	private static function settings(): array {
		return \FotoGrids\Settings\View_Settings_Store::get();
	}

	/**
	 * Boolean toggle resolution with a paired filter.
	 *
	 * Reads the named setting from `View_Settings_Store::get()` and applies a
	 * `fotogrids/view/integrated/{key}` filter so Pro / 3rd parties can flip
	 * a toggle for a single request without writing the option.
	 *
	 * @since 1.0.0
	 * @param string        $key  Settings array key.
	 * @param \WP_Post|null $post Current post when known; the filter receives it.
	 * @return bool
	 */
	private static function toggle( string $key, ?\WP_Post $post = null ): bool {
		$settings = self::settings();
		$value    = ! empty( $settings[ $key ] );

		/**
		 * Filter an Integrated-mode toggle for the current request.
		 *
		 * The filter name is `fotogrids/view/integrated/{key}` where `{key}`
		 * is the settings array key (e.g. `integrated_show_title_block`).
		 *
		 * @since 1.0.0
		 * @param bool          $value Resolved from `fotogrids_view_settings`.
		 * @param \WP_Post|null $post  Current post when known.
		 */
		return (bool) apply_filters( 'fotogrids/view/integrated/' . $key, $value, $post ); // dynamic key - see Filters_View::INTEGRATED_KEY
	}

	/**
	 * Add `comments` post-type support when the toggle is on.
	 *
	 * Runs once on `init` after the CPTs are registered. Reads the global
	 * setting (filter is post-aware and isn't applicable at registration time).
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function register_cpt_support(): void {
		$settings = self::settings();
		if ( empty( $settings['integrated_allow_comments'] ) ) {
			return;
		}

		foreach ( self::POST_TYPES as $type ) {
			add_post_type_support( $type, 'comments' );
		}
	}

	/**
	 * Replace the post content with the rendered gallery/album.
	 *
	 * Runs on `the_content` (priority 20, after most theme/builder filters).
	 * The post body is typically empty on view-page CPTs, but we replace it
	 * unconditionally because the gallery markup IS the page content.
	 *
	 * Optional decorations:
	 *   - Draft-preview notice (for editors viewing unpublished collections).
	 *   - Title block (`<h1>` + count) when `integrated_show_title_block` is on.
	 *   - Footer share bar via the Sharing module's `data-fg-share-footer`
	 *     container (mirrors the standalone shell's share_html()).
	 *
	 * @since 1.0.0
	 * @param string $content Current post content.
	 * @return string
	 */
	public static function inject_gallery( string $content ): string {
		if ( ! self::should_run() ) {
			return $content;
		}

		// `the_content` fires for every post that renders. Guard against
		// calls inside the main loop where the queried object isn't the
		// post being filtered (e.g. a widget rendering an excerpt).
		if ( ! in_the_loop() || ! is_main_query() ) {
			return $content;
		}

		$post = get_queried_object();
		if ( ! $post instanceof \WP_Post ) {
			return $content;
		}

		$view = Renderer::for_post( $post );

		$html = '';

		if ( $view->is_draft_preview() ) {
			$html .= '<div class="fotogrids-view__notice fotogrids-view__notice--integrated">'
				. esc_html__( 'Draft preview - this collection is not published yet.', 'fotogrids' )
				. '</div>';
		}

		if ( self::toggle( 'integrated_show_title_block', $post ) ) {
			$html .= '<div class="fotogrids-view__title-block fotogrids-view__title-block--integrated">'
				. $view->header_html()
				. '</div>';
		}

		/**
		 * Fires before the integrated-mode gallery markup.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $post
		 */
		ob_start();
		do_action( Actions_View::INTEGRATED_BEFORE_GALLERY, $post );
		$html .= (string) ob_get_clean();

		$html .= $view->gallery_html();

		/**
		 * Fires after the integrated-mode gallery markup.
		 *
		 * @since 1.0.0
		 * @param \WP_Post $post
		 */
		ob_start();
		do_action( Actions_View::INTEGRATED_AFTER_GALLERY, $post );
		$html .= (string) ob_get_clean();

		// Always emit a footer share container (copy-link minimum, full bar
		// when Sharing's `view_page` placement is on). Mirrors the standalone
		// shell's share_html() so the Sharing module's attachFooterBars()
		// picks it up the same way.
		$html .= $view->share_html();

		/**
		 * Filter the complete integrated-mode content replacement.
		 *
		 * Receives the assembled markup (notice + optional title + gallery +
		 * share footer). Return an empty string to suppress entirely and fall
		 * back to the original content.
		 *
		 * @since 1.0.0
		 * @param string   $html
		 * @param \WP_Post $post
		 * @param string   $original_content
		 */
		return (string) apply_filters( Filters_View::INTEGRATED_CONTENT, $html, $post, $content );
	}

	/**
	 * Provide the document title for integrated-mode view pages.
	 *
	 * Returning a non-empty string from `pre_get_document_title` short-circuits
	 * `wp_get_document_title`. Reusing `Renderer::page_title()` keeps the
	 * title format identical to standalone mode.
	 *
	 * @since 1.0.0
	 * @param string $title Title from earlier filters (typically empty).
	 * @return string
	 */
	public static function filter_document_title( string $title ): string {
		if ( ! self::should_run() ) {
			return $title;
		}

		$post = get_queried_object();
		if ( ! $post instanceof \WP_Post ) {
			return $title;
		}

		return Renderer::for_post( $post )->page_title();
	}

	/**
	 * Emit head meta (robots, canonical, OG, Twitter) on integrated pages.
	 *
	 * Runs at wp_head priority 5 so SEO plugins (which typically run at 1-3)
	 * still emit first; FotoGrids' SEO_Conflict_Guard handles suppression
	 * when the user wants us to take over.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function emit_head_meta(): void {
		if ( ! self::should_run() ) {
			return;
		}

		$post = get_queried_object();
		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		// Renderer::head_meta() is already escape-aware.
		echo Renderer::for_post( $post )->head_meta(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Add integrated-mode body classes.
	 *
	 * `fotogrids-view--integrated` lets the theme-integrated CSS scope kick
	 * in. The gallery/album kind class mirrors what the standalone shell
	 * emits so per-kind CSS still applies.
	 *
	 * @since 1.0.0
	 * @param string[] $classes Existing classes from the theme.
	 * @return string[]
	 */
	public static function filter_body_classes( array $classes ): array {
		if ( ! self::should_run() ) {
			return $classes;
		}

		$post = get_queried_object();
		if ( ! $post instanceof \WP_Post ) {
			return $classes;
		}

		$classes[] = 'fotogrids-view';
		$classes[] = 'fotogrids-view--integrated';
		$classes[] = 'fotogrids-view--' . ( 'fotogrids_album' === $post->post_type ? 'album' : 'gallery' );

		/**
		 * Filter the integrated-mode body classes.
		 *
		 * @since 1.0.0
		 * @param string[] $classes
		 * @param \WP_Post $post
		 */
		return (array) apply_filters( Filters_View::INTEGRATED_BODY_CLASSES, $classes, $post );
	}

	/**
	 * Enqueue the gallery assets, deep-linking, sharing, fg-tooltip on
	 * integrated view pages.
	 *
	 * Mirrors the registration/enqueue list in
	 * `ViewCollections\Renderer::enqueue_assets()`, which runs from the
	 * standalone shell template. In integrated mode we have to hook
	 * `wp_enqueue_scripts` ourselves because the theme owns the template.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function enqueue_assets(): void {
		if ( ! self::should_run() ) {
			return;
		}

		$post = get_queried_object();
		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		// Idempotency: `wp_enqueue_scripts` can fire more than once across
		// odd theme code paths. Skip if we've already serviced this post.
		if ( self::$enqueued_for === (int) $post->ID ) {
			return;
		}
		self::$enqueued_for = (int) $post->ID;

		Renderer::for_post( $post )->enqueue_assets();
	}

	/**
	 * Record a view against the collection's statistics in integrated mode.
	 *
	 * `template_redirect` fires after the query but before output starts,
	 * which is exactly when the standalone shell would call track_view().
	 * Idempotency-guarded against the same request triggering twice.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function track_view(): void {
		if ( ! self::should_run() ) {
			return;
		}

		$post = get_queried_object();
		if ( ! $post instanceof \WP_Post ) {
			return;
		}

		if ( self::$tracked_for === (int) $post->ID ) {
			return;
		}
		self::$tracked_for = (int) $post->ID;

		Renderer::for_post( $post )->track_view();
	}

	/**
	 * Suppress the theme's post-thumbnail render on integrated view pages.
	 *
	 * Most classic themes call `the_post_thumbnail()` at the top of
	 * `single.php`. On a gallery view page that means the theme renders the
	 * featured image and then our gallery renders below it (often with the
	 * same image as its first item). Default is on; users opt out via the
	 * setting if their theme's featured-image treatment is the look they want.
	 *
	 * @since 1.0.0
	 * @param string $html    Theme's resolved post-thumbnail markup.
	 * @param int    $post_id Post the thumbnail is for.
	 * @return string
	 */
	public static function maybe_hide_featured_image( string $html, int $post_id ): string {
		if ( ! self::should_run() ) {
			return $html;
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof \WP_Post || ! in_array( $post->post_type, self::POST_TYPES, true ) ) {
			return $html;
		}

		// Only suppress on the singular view page itself, not on other
		// contexts where the same CPT thumbnail might render (e.g. an album's
		// child galleries listing on the same page).
		if ( ! is_singular( self::POST_TYPES ) ) {
			return $html;
		}

		if ( ! self::toggle( 'integrated_hide_featured_image', $post ) ) {
			return $html;
		}

		return '';
	}

	/**
	 * Force `comments_open` to match the integrated comments setting.
	 *
	 * `add_post_type_support('comments')` makes the form available; the
	 * `comments_open` filter is what themes actually consult. We respect the
	 * per-post `comment_status` only when comments are enabled site-wide for
	 * view pages.
	 *
	 * @since 1.0.0
	 * @param bool $open    Resolved open state.
	 * @param int  $post_id Post the comment status is for.
	 * @return bool
	 */
	public static function filter_comments_open( bool $open, int $post_id ): bool {
		if ( ! self::should_run() ) {
			return $open;
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof \WP_Post || ! in_array( $post->post_type, self::POST_TYPES, true ) ) {
			return $open;
		}

		if ( ! self::toggle( 'integrated_allow_comments', $post ) ) {
			return false;
		}

		return $open;
	}

	/**
	 * Exclude view-page CPTs from author and date archives unless opted in.
	 *
	 * Without this, a theme rendering `is_author()` / `is_date()` archives
	 * would surface galleries alongside (or instead of) blog posts. The
	 * default is to keep galleries out and let users opt in explicitly.
	 *
	 * Runs on `pre_get_posts` for the main query only, before any singular
	 * routing decision, so layout_mode resolution here MUST NOT call
	 * `should_run()` (which depends on `is_singular`, false on archives).
	 *
	 * @since 1.0.0
	 * @param \WP_Query $query
	 * @return void
	 */
	public static function filter_archives( \WP_Query $query ): void {
		if ( is_admin() || ! $query->is_main_query() ) {
			return;
		}

		if ( ! $query->is_author() && ! $query->is_date() ) {
			return;
		}

		$settings = self::settings();
		if ( ( $settings['layout_mode'] ?? 'integrated' ) !== 'integrated' ) {
			return;
		}

		// Filter resolution: the toggle's filter takes precedence so 3rd
		// parties can opt in even when the global setting says off.
		$include = (bool) apply_filters(
			Filters_View::INTEGRATED_INCLUDE_IN_ARCHIVES,
			! empty( $settings['integrated_include_in_archives'] ),
			null
		);

		if ( $include ) {
			return;
		}

		$existing = (array) $query->get( 'post_type' );
		if ( empty( $existing ) || in_array( 'any', $existing, true ) ) {
			// Default archives query 'post' only; explicit removal needed when
			// the theme has broadened the type list to 'any' or post_type
			// wasn't specified at all (which WordPress treats as 'post').
			$existing = array( 'post' );
		}
		$filtered = array_values( array_diff( $existing, self::POST_TYPES ) );
		if ( $filtered !== $existing ) {
			$query->set( 'post_type', $filtered );
		}
	}

	/**
	 * Scope or suppress the previous/next post navigation on view pages.
	 *
	 * When `integrated_post_navigation` is on: force same-CPT navigation
	 * (galleries only link to galleries; albums to albums) by overriding the
	 * `post_type` clause in `get_{previous,next}_post_where`.
	 *
	 * When the toggle is off (default): suppress navigation entirely by
	 * appending a clause that no row can satisfy (`AND 1 = 0`), which keeps
	 * the WP_Query path intact without breaking themes that call the
	 * navigation functions unconditionally.
	 *
	 * @since 1.0.0
	 * @param string   $where         The WHERE clause WP built.
	 * @param bool     $in_same_term  Whether to restrict by term.
	 * @param mixed    $excluded_terms
	 * @param string   $taxonomy
	 * @param \WP_Post $post          The post navigation is anchored to.
	 * @return string
	 */
	public static function filter_post_navigation_where( string $where, bool $in_same_term, $excluded_terms, string $taxonomy, $post ): string {
		if ( ! self::should_run() ) {
			return $where;
		}

		if ( ! $post instanceof \WP_Post || ! in_array( $post->post_type, self::POST_TYPES, true ) ) {
			return $where;
		}

		global $wpdb;

		if ( ! self::toggle( 'integrated_post_navigation', $post ) ) {
			// Suppress: an unsatisfiable clause yields no row, so the theme's
			// `previous_post_link()` / `next_post_link()` calls render nothing.
			return $where . ' AND 1 = 0';
		}

		// Scope: drop any pre-existing post_type constraint and replace it
		// with one that pins navigation to the current CPT. WordPress's
		// default `get_adjacent_post` builds `WHERE p.post_type = 'post'`
		// (or whatever the current post_type is, depending on WP version);
		// we normalise by stripping all `p.post_type = '…'` clauses and
		// adding our own.
		$where  = (string) preg_replace( "/\\s+AND\\s+p\\.post_type\\s*=\\s*'[^']+'/", '', $where );
		$where .= $wpdb->prepare( ' AND p.post_type = %s', $post->post_type );

		return $where;
	}
}
