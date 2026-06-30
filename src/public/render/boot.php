<?php
declare(strict_types=1);

use FotoGrids\Hooks\Actions_Render;
use FotoGrids\Render\Internal\Asset_Resolver;

if ( ! defined( 'WPINC' ) ) {
	die;
}

if ( ! function_exists( 'fotogrids_render_autoload' ) ) {
	/**
	 * Autoloads render namespace classes.
	 *
	 * @since 1.0.0
	 * @param string $class_name Class name.
	 * @return void
	 */
	function fotogrids_render_autoload( string $class_name ): void {
		$namespace_prefix = 'FotoGrids\\Render\\';
		if ( strncmp( $class_name, $namespace_prefix, strlen( $namespace_prefix ) ) !== 0 ) {
			return;
		}

		$relative_class = substr( $class_name, strlen( $namespace_prefix ) );
		if ( false === $relative_class || '' === $relative_class ) {
			return;
		}

		$relative_parts = explode( '\\', $relative_class );
		$symbol_name    = array_pop( $relative_parts );
		$directory_path = implode(
			'/',
			array_map(
				static fn( string $part ): string => strtolower( str_replace( '_', '-', $part ) ),
				$relative_parts
			)
		);
		$symbol_slug    = strtolower( str_replace( '_', '-', $symbol_name ) );

		$base_path       = FOTOGRIDS_PLUGIN_DIR . 'public/render/';
		$candidate_paths = array(
			$base_path . ( '' !== $directory_path ? $directory_path . '/' : '' ) . 'class-' . $symbol_slug . '.php',
			$base_path . ( '' !== $directory_path ? $directory_path . '/' : '' ) . 'interface-' . $symbol_slug . '.php',
			$base_path . ( '' !== $directory_path ? $directory_path . '/' : '' ) . 'enum-' . $symbol_slug . '.php',
			$base_path . ( '' !== $directory_path ? $directory_path . '/' : '' ) . 'trait-' . $symbol_slug . '.php',
		);

		foreach ( $candidate_paths as $candidate_path ) {
			if ( file_exists( $candidate_path ) ) {
				require_once $candidate_path;
				return;
			}
		}
	}
}

spl_autoload_register( 'fotogrids_render_autoload' );

add_action(
	'plugins_loaded',
	static function (): void {
		// In debug builds, bust the per-asset cache on every change by versioning
		// against the render directory's newest file mtime instead of the static
		// plugin version (which never changes between rebuilds).
		$version = FOTOGRIDS_VERSION;
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$runtime_js = FOTOGRIDS_PLUGIN_DIR . 'assets/js/layout-masonry.js';
			if ( file_exists( $runtime_js ) ) {
				$version = (string) filemtime( $runtime_js );
			}
		}
		Asset_Resolver::register_plugin( 'fotogrids', FOTOGRIDS_PLUGIN_URL, $version );
	},
	5
);

add_action(
	'wp_loaded',
	static function (): void {
		do_action( Actions_Render::REGISTER_MODULES );
		do_action( Actions_Render::REGISTER_HOVER_EFFECTS );
	},
	5
);

add_action(
	Actions_Render::REGISTER_MODULES,
	static function (): void {
		if ( ! class_exists( \FotoGrids\Render\Internal\Module_Registry::class ) ) {
			return;
		}
		\FotoGrids\Render\Internal\Module_Registry::register( 'gates', \FotoGrids\Render\Gates\Collection_Permissions\Collection_Permissions::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'gates', \FotoGrids\Render\Gates\Password\Password_Gate::class );
		// Sorters run at the ID level, before item hydration. Only one sorter is
		// active per render (the highest-precedence module whose supports() returns
		// true). Pro registers additional sorters via the same hook at priority 10
		// with origin 'fotogrids-pro', which gives them automatic precedence.
		\FotoGrids\Render\Internal\Module_Registry::register( 'sorters', \FotoGrids\Render\Sorters\Manual\Manual_Sorter::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'sorters', \FotoGrids\Render\Sorters\Date\Date_Sorter::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'sorters', \FotoGrids\Render\Sorters\Title\Title_Sorter::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'sorters', \FotoGrids\Render\Sorters\Filename\Filename_Sorter::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'sorters', \FotoGrids\Render\Sorters\Random\Random_Sorter::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Grid::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Masonry::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Justified::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Single_Item::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Slider::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Image_Viewer::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Featured_Item::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Instant_Photos::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Captions\Captions::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Image_Filters\Image_Filters::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Border_Radius\Border_Radius::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Border\Border::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Shadow\Shadow::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Spacing\Spacing::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Effects\Hover_Effects::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Image_Zoom\Image_Zoom::class );
		// Click-behavior decorators must run after all visual decorators so the
		// <a> wraps the fully-decorated item media. Only one of these will be
		// active at a time (each checks click_behavior in supports()).
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Lightbox\Classic\Lightbox_Decorator::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Direct_Link\Direct_Link_Decorator::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\External_Link\External_Link_Decorator::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Sharing\Sharing_Decorator::class );
		// Album click-behaviour decorators. Mutually exclusive via
		// supports(): one runs per album based on use_ajax_from_album.
		// Both opt OUT of normal gallery renders via collection_kind.
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Album_To_View_Page\Album_To_View_Page::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Album_To_Gallery_Ajax\Album_To_Gallery_Ajax::class );
		// Runtime Bootstrap is registered first so window.FotoGrids is defined
		// before any other module's JS runs. Every other module's JS declares
		// the 'fotogrids-runtime' handle as a dep, but registering this module
		// first means the asset is queued first too.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Internal\Runtime\Runtime_Bootstrap::class );
		// Loading Icon must be registered before Lightbox so its <symbol> block
		// is emitted inside html_appendix() before the lightbox reads the global.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Loading_Icon\Loading_Icon::class );
		// Loaded Effect drives the image reveal animation once state="loaded".
		// Registered immediately after Loading Icon so the CSS loads in order.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Loaded_Effect\Loaded_Effect::class );
		// Lazy Load writes data-fg-lazy="1" on the wrapper when the setting is on,
		// and conditionally suppresses loading="lazy" on items when it is off.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Lazy_Load\Lazy_Load::class );
		// Stats fires view + share pings to the REST API. Gated by the
		// enable_statistics setting (default true) and never active in previews.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Stats\Stats::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Custom_Code\Custom_Css::class );
		// Inline video playback - active when video_playback_mode is "inline".
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Video\Video_Inline::class );
		// Minimal video lightbox - active when video_playback_mode is "lightbox"
		// but the gallery's click behaviour is not the full lightbox.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Video\Video_Lightbox_Mini::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Lightbox\Classic\Lightbox::class );
		// LightboxGrid - the "show all" overlay for the Featured Item layout.
		// Active only when that layout overflows its inline display.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Lightbox\Grid\Lightbox_Grid::class );
		// Lightbox Mini viewer - the single-image "mini" lightbox variant on the
		// variant-eligible layouts.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Lightbox\Mini_Viewer\Lightbox_Mini_Viewer::class );
		// Filter sources must be registered before Filter_UI so the feature can
		// call Module_Registry::active_modules('filter_sources', ...) during
		// supports() and html_before(). Tags decorator runs with decorators so
		// data-fg-tags is stamped before layout and feature rendering starts.
		\FotoGrids\Render\Internal\Module_Registry::register( 'filter_sources', \FotoGrids\Render\Filters\Sources\Tags\Tags_Filter_Source::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'filter_sources', \FotoGrids\Render\Filters\Sources\People\People_Filter_Source::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'filter_sources', \FotoGrids\Render\Filters\Sources\Location\Location_Filter_Source::class );
		// Sequence index decorator stamps data-fg-sequence-index on
		// every item using Gallery_Item_Sequence::resolve(). Lightbox
		// reads it to know each item's position in the full
		// filtered+sorted set. Always runs (gallery-only via supports).
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Sequence_Index\Sequence_Index_Decorator::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Filters\Decorators\Tags\Tags_Filter_Decorator::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Filters\Decorators\People\People_Filter_Decorator::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Filters\Decorators\Location\Location_Filter_Decorator::class );
		// Collection Header (back-to-album button + breadcrumbs) MUST be
		// registered before Filter_Ui so its html_before output renders
		// above .fotogrids-filters inside the gallery wrapper. The feature
		// gates itself via Breadcrumb_Resolver - never active on album
		// renders or galleries with zero / multiple parent albums.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Collection_Header\Collection_Header::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Filters\Features\Ui\Filter_Ui::class );
		// Pagination - three mutually exclusive sibling modules, all gated
		// on pagination_type === 'paginated' and the appropriate
		// pagination_method. Order between them doesn't matter
		// (supports() is mutually exclusive); registered after Filter_Ui
		// so the filter bar renders above the pagination chrome.
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Pagination\Endless_Scroll\Endless_Scroll::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Pagination\Load_More\Load_More::class );
		\FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Pagination\Page_Buttons\Page_Buttons::class );
	},
	10
);

add_action(
	Actions_Render::REGISTER_HOVER_EFFECTS,
	static function (): void {
		if ( class_exists( \FotoGrids\Render\Decorators\Hover\Hover_Effects_Catalog::class ) ) {
			\FotoGrids\Render\Decorators\Hover\Hover_Effects_Catalog::register();
		}
		if ( class_exists( \FotoGrids\Render\Decorators\Hover\Hover_Effects_Teasers::class ) ) {
			\FotoGrids\Render\Decorators\Hover\Hover_Effects_Teasers::register();
		}
	},
	10
);

add_action(
	'wp_loaded',
	static function (): void {
		// Register the Google Fonts enqueue hook once per request.
		// Decorators call Font_Resolver::instance()->resolve_font_family() during
		// style_vars(), which runs inside shortcode/block rendering (the_content).
		// By the time wp_enqueue_scripts fires at priority 20, all galleries on
		// the page have registered their fonts and a single combined URL is built.
		\FotoGrids\Render\Api\Font_Resolver::instance()->register_enqueue_hook();
	},
	10
);

add_action(
	'wp_footer',
	static function (): void {
		Asset_Resolver::instance()->flush();
	},
	9
);

add_action(
	'admin_footer',
	static function (): void {
		Asset_Resolver::instance()->flush();
	},
	9
);
