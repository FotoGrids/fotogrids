<?php
/**
 * View Page (standalone + integrated) filter hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * View page filter hooks.
 */
final class Filters_View {

	// -------------------------------------------------------------------
	// Appearance settings store
	// -------------------------------------------------------------------

	/**
	 * Default view-page appearance settings.
	 *
	 * @since 1.0.0
	 * @param array $defaults Default settings.
	 */
	public const APPEARANCE_DEFAULTS = 'fotogrids/view/appearance/defaults';

	/**
	 * Resolved view-page appearance settings.
	 *
	 * @since 1.0.0
	 * @param array $settings Resolved settings.
	 */
	public const APPEARANCE = 'fotogrids/view/appearance';

	/**
	 * Sanitised view-page appearance settings input.
	 *
	 * @since 1.0.0
	 * @param array $sanitized Sanitised input.
	 * @param array $input     Raw input.
	 */
	public const APPEARANCE_SANITIZE = 'fotogrids/view/appearance/sanitize';

	// -------------------------------------------------------------------
	// Routing
	// -------------------------------------------------------------------

	/**
	 * Master enable flag for the View Collections module.
	 *
	 * @since 1.0.0
	 * @param bool $enabled Default true.
	 */
	public const ENABLED = 'fotogrids/view/enabled';

	/**
	 * Register-post-type args for the View Collection CPT.
	 *
	 * @since 1.0.0
	 * @param array  $args      CPT args.
	 * @param string $post_type Post type slug.
	 */
	public const CPT_ARGS = 'fotogrids/view/cpt_args';

	/**
	 * Base slug used for the View Collection CPT permalink.
	 *
	 * @since 1.0.0
	 * @param string $slug      Default slug.
	 * @param string $post_type Post type slug.
	 */
	public const BASE_SLUG = 'fotogrids/view/base_slug';

	/**
	 * Short-circuit hook returning HTML to use instead of running the render.
	 *
	 * @since 1.0.0
	 * @param string|null $pre  Return non-null to short-circuit.
	 * @param \WP_Post    $post Post being rendered.
	 */
	public const PRE_RENDER = 'fotogrids/view/pre_render';

	/**
	 * Layout mode for a view (`'integrated'` or `'standalone'`).
	 *
	 * @since 1.0.0
	 * @param string   $layout_mode Default mode.
	 * @param \WP_Post $post        Post being viewed.
	 */
	public const LAYOUT_MODE = 'fotogrids/view/layout_mode';

	/**
	 * Template file used to render the standalone view page.
	 *
	 * @since 1.0.0
	 * @param string $template Absolute template path.
	 */
	public const TEMPLATE = 'fotogrids/view/template';

	// -------------------------------------------------------------------
	// Head / SEO
	// -------------------------------------------------------------------

	/**
	 * The view page `<title>`.
	 *
	 * @since 1.0.0
	 * @param string   $title Title string.
	 * @param \WP_Post $post  Post being viewed.
	 */
	public const PAGE_TITLE = 'fotogrids/view/page_title';

	/**
	 * The view page robots noindex flag.
	 *
	 * @since 1.0.0
	 * @param bool     $noindex Whether to emit noindex.
	 * @param \WP_Post $post    Post being viewed.
	 */
	public const ROBOTS = 'fotogrids/view/robots';

	/**
	 * The view page canonical URL.
	 *
	 * @since 1.0.0
	 * @param string   $canonical Canonical URL.
	 * @param \WP_Post $post      Post being viewed.
	 */
	public const CANONICAL = 'fotogrids/view/canonical';

	/**
	 * Additional `<meta>` markup injected into the view page `<head>`.
	 *
	 * @since 1.0.0
	 * @param string   $meta Meta markup.
	 * @param \WP_Post $post Post being viewed.
	 */
	public const HEAD_META = 'fotogrids/view/head_meta';

	/**
	 * Whether the SEO-conflict guard runs against an SEO plugin's hooks.
	 *
	 * @since 1.0.0
	 * @param bool     $enabled Default true.
	 * @param \WP_Post $post    Post being viewed.
	 */
	public const SEO_CONFLICT_GUARD_ENABLED = 'fotogrids/view/seo_conflict_guard/enabled';

	// -------------------------------------------------------------------
	// Open Graph
	// -------------------------------------------------------------------

	/**
	 * Whether Open Graph tags should be emitted for an item.
	 *
	 * @since 1.0.0
	 * @param bool|string $enabled Bool, or empty string for short-circuit.
	 * @param \WP_Post    $post    Post being viewed.
	 * @param array       $item    Item meta.
	 */
	public const OG_ENABLED = 'fotogrids/view/og/enabled';

	/**
	 * OG title for an item.
	 *
	 * @since 1.0.0
	 * @param string   $title OG title.
	 * @param \WP_Post $post  Post being viewed.
	 * @param array    $item  Item meta.
	 */
	public const OG_TITLE = 'fotogrids/view/og/title';

	/**
	 * OG description for an item.
	 *
	 * @since 1.0.0
	 * @param string   $description OG description.
	 * @param \WP_Post $post        Post being viewed.
	 * @param array    $item        Item meta.
	 */
	public const OG_DESCRIPTION = 'fotogrids/view/og/description';

	/**
	 * OG URL for an item.
	 *
	 * @since 1.0.0
	 * @param string   $url  OG URL.
	 * @param \WP_Post $post Post being viewed.
	 * @param array    $item Item meta.
	 */
	public const OG_URL = 'fotogrids/view/og/url';

	/**
	 * OG image array (url/width/height) for an item.
	 *
	 * @since 1.0.0
	 * @param array    $image OG image array.
	 * @param \WP_Post $post  Post being viewed.
	 * @param array    $item  Item meta.
	 */
	public const OG_IMAGE = 'fotogrids/view/og/image';

	/**
	 * OG `og:type` for the view page.
	 *
	 * @since 1.0.0
	 * @param string   $type OG type.
	 * @param \WP_Post $post Post being viewed.
	 */
	public const OG_TYPE = 'fotogrids/view/og/type';

	// -------------------------------------------------------------------
	// Standalone page sections
	// -------------------------------------------------------------------

	/**
	 * View page `<body>` classes.
	 *
	 * @since 1.0.0
	 * @param string[] $classes Body classes.
	 * @param \WP_Post $post    Post being viewed.
	 */
	public const BODY_CLASSES = 'fotogrids/view/body_classes';

	/**
	 * Whether to render the view page header region.
	 *
	 * @since 1.0.0
	 * @param bool     $show Default true.
	 * @param \WP_Post $post Post being viewed.
	 */
	public const SHOW_HEADER = 'fotogrids/view/show_header';

	/**
	 * Header HTML on the view page.
	 *
	 * @since 1.0.0
	 * @param string   $html Header HTML.
	 * @param \WP_Post $post Post being viewed.
	 */
	public const HEADER_HTML = 'fotogrids/view/header_html';

	/**
	 * Gallery HTML on the view page.
	 *
	 * @since 1.0.0
	 * @param string   $html Gallery HTML.
	 * @param \WP_Post $post Post being viewed.
	 */
	public const GALLERY_HTML = 'fotogrids/view/gallery_html';

	/**
	 * Share-buttons HTML on the view page.
	 *
	 * @since 1.0.0
	 * @param string   $html Share buttons HTML.
	 * @param \WP_Post $post Post being viewed.
	 */
	public const SHARE_BUTTONS = 'fotogrids/view/share_buttons';

	/**
	 * Footer credit HTML on the view page.
	 *
	 * @since 1.0.0
	 * @param string   $html Footer credit HTML.
	 * @param \WP_Post $post Post being viewed.
	 */
	public const FOOTER_CREDIT = 'fotogrids/view/footer_credit';

	// -------------------------------------------------------------------
	// Settings store + REST
	// -------------------------------------------------------------------

	/**
	 * View Collections module default settings.
	 *
	 * @since 1.0.0
	 * @param array $defaults Default settings.
	 */
	public const SETTINGS_DEFAULTS = 'fotogrids/view/settings/defaults';

	/**
	 * Resolved view collections settings for a post.
	 *
	 * @since 1.0.0
	 * @param array $settings Resolved settings.
	 * @param int   $post_id  Post ID.
	 */
	public const SETTINGS = 'fotogrids/view/settings';

	/**
	 * REST settings response payload for view collections.
	 *
	 * @since 1.0.0
	 * @param array    $data REST response payload.
	 * @param \WP_Post $post Post being read.
	 */
	public const REST_SETTINGS_RESPONSE = 'fotogrids/view/rest/settings_response';

	// -------------------------------------------------------------------
	// Integrated layout
	// -------------------------------------------------------------------

	/**
	 * Generic per-key Integrated layout toggle.
	 *
	 * Fired as `fotogrids/view/integrated/<key>` where `<key>` is the toggle
	 * key (e.g. `show_post_title`, `show_excerpt`). This constant documents
	 * the prefix only - the dispatch site composes the key dynamically.
	 *
	 * @since 1.0.0
	 * @param bool     $value Default toggle value.
	 * @param \WP_Post $post  Post being viewed.
	 */
	public const INTEGRATED_KEY = 'fotogrids/view/integrated/{key}';

	/**
	 * The fully-composed HTML for the Integrated layout post content.
	 *
	 * @since 1.0.0
	 * @param string   $html    Final HTML.
	 * @param \WP_Post $post    Post being viewed.
	 * @param string   $content Original post content.
	 */
	public const INTEGRATED_CONTENT = 'fotogrids/view/integrated/content';

	/**
	 * Body classes added to the Integrated layout.
	 *
	 * @since 1.0.0
	 * @param string[] $classes Body classes.
	 * @param \WP_Post $post    Post being viewed.
	 */
	public const INTEGRATED_BODY_CLASSES = 'fotogrids/view/integrated/body_classes';

	/**
	 * Whether Integrated views are included in CPT archives.
	 *
	 * @since 1.0.0
	 * @param bool     $include Default from settings.
	 * @param \WP_Post $post    Post being viewed (when known).
	 */
	public const INTEGRATED_INCLUDE_IN_ARCHIVES = 'fotogrids/view/integrated/integrated_include_in_archives';
}
