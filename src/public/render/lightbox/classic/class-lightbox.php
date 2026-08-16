<?php
declare(strict_types=1);

namespace FotoGrids\Render\Lightbox\Classic;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Hooks\Filters_Data;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Lightbox feature module.
 *
 * Active when click_behavior === 'lightbox'. Responsible for:
 *
 * 1. Writing data-fg-click="lightbox" and all data-fg-lb-* settings onto the
 *    gallery wrapper so the JS singleton can read per-gallery configuration
 *    without any global state.
 *
 * 2. Declaring the lightbox JS and CSS assets so the Asset_Resolver enqueues
 *    them only when a lightbox gallery is actually on the page.
 *
 * Data attribute contract (JS reads these from the gallery wrapper element):
 *
 *   data-fg-click                    = "lightbox"
 *   data-fg-lb-theme                 = "dark" | "light" | "custom"
 *
 * Colour attributes (all themes - JS reads these to build the per-gallery <style> block):
 *   data-fg-lb-bg                        rgba - backdrop background
 *   data-fg-lb-toolbar-bg                rgba - toolbar background
 *   data-fg-lb-toolbar-btn-bg            rgba - toolbar button background (regular)
 *   data-fg-lb-toolbar-btn-border        rgba - toolbar button border (regular)
 *   data-fg-lb-toolbar-btn-color         rgba - toolbar icon colour (regular)
 *   data-fg-lb-toolbar-btn-bg-hover      rgba - toolbar button background (hover)
 *   data-fg-lb-toolbar-btn-border-hover  rgba - toolbar button border (hover)
 *   data-fg-lb-toolbar-btn-hover         rgba - toolbar icon colour (hover)
 *   data-fg-lb-toolbar-btn-bg-active     rgba - toolbar button background (active toggle)
 *   data-fg-lb-toolbar-btn-border-active rgba - toolbar button border (active toggle)
 *   data-fg-lb-toolbar-btn-active-color  rgba - toolbar icon colour (active toggle)
 *   data-fg-lb-toolbar-btn-bg-focus      rgba - toolbar button background (focus)
 *   data-fg-lb-toolbar-btn-border-focus  rgba - toolbar button border (focus)
 *   data-fg-lb-toolbar-btn-focus-color   rgba - toolbar icon colour (focus)
 *   data-fg-lb-arrow-bg                  rgba - nav arrow button background (regular)
 *   data-fg-lb-arrow-border              rgba - nav arrow button border (regular)
 *   data-fg-lb-arrow-color               rgba - nav arrow icon colour (regular)
 *   data-fg-lb-arrow-bg-hover            rgba - nav arrow button background (hover)
 *   data-fg-lb-arrow-border-hover        rgba - nav arrow button border (hover)
 *   data-fg-lb-arrow-hover-color         rgba - nav arrow icon colour (hover)
 *   data-fg-lb-arrow-bg-active           rgba - nav arrow button background (active)
 *   data-fg-lb-arrow-border-active       rgba - nav arrow button border (active)
 *   data-fg-lb-arrow-active-color        rgba - nav arrow icon colour (active)
 *   data-fg-lb-arrow-bg-focus            rgba - nav arrow button background (focus)
 *   data-fg-lb-arrow-border-focus        rgba - nav arrow button border (focus)
 *   data-fg-lb-arrow-focus-color         rgba - nav arrow icon colour (focus)
 *   data-fg-lb-bullet-bg                 rgba - dot background (regular)
 *   data-fg-lb-bullet-border             rgba - dot border (regular)
 *   data-fg-lb-bullet-hover-bg           rgba - dot background (hover)
 *   data-fg-lb-bullet-hover-border       rgba - dot border (hover)
 *   data-fg-lb-bullet-active-bg          rgba - dot background (active)
 *   data-fg-lb-bullet-active-border      rgba - dot border (active)
 *   data-fg-lb-bullet-focus-bg           rgba - dot background (focus)
 *   data-fg-lb-bullet-focus-border       rgba - dot border (focus)
 *   data-fg-lb-thumbs-bg                 rgba - thumbnail strip background
 *   data-fg-lb-thumb-border-color        rgba - thumbnail border (regular)
 *   data-fg-lb-thumb-hover-border-color  rgba - thumbnail border (hover)
 *   data-fg-lb-thumb-active-color        rgba - thumbnail border (active)
 *   data-fg-lb-thumb-focus-border-color  rgba - thumbnail border (focus)
 *   data-fg-lb-info-bg                   rgba - info panel (sidebar/overlay) background
 *   data-fg-lb-info-block-bg             rgba - individual info block card background
 *   data-fg-lb-info-text                 rgba - info panel caption text
 *   data-fg-lb-info-title                rgba - info panel title text
 *   data-fg-lb-spinner-color             rgba - loading spinner colour
 *   data-fg-lb-img-shadow                rgba - image drop-shadow colour (only when shadow enabled)
 *
 * Behaviour / layout attributes:
 *   data-fg-lb-transition            = "fade" | "horizontal" | "vertical" | "none"
 *   data-fg-lb-duration              = "300"                  (ms, integer string)
 *   data-fg-lb-auto-progress         = "1" | omitted
 *   data-fg-lb-auto-delay            = "5"                    (seconds, integer string)
 *   data-fg-lb-fit-media             = "1" | omitted
 *   data-fg-lb-mobile-layout         = "mobile_optimized" | "desktop"
 *   data-fg-lb-show-arrows           = "1" | omitted
 *   data-fg-lb-arrow-icon            = "chevron" | "chevron_double" | "arrow" | "arrow_narrow" | "arrow_square" | "arrow_circle" | "arrow_circle_broken" | "arrow_block"
 *   data-fg-lb-arrow-size            = "40"                   (px, integer string)
 *   data-fg-lb-show-dots             = "1" | omitted
 *   data-fg-lb-show-counter                                    (present = show "1 / N" counter in toolbar-start)
 *   data-fg-lb-bullet-width          = "12px"                 (absent = 12px default)
 *   data-fg-lb-bullet-height         = "12px"                 (absent = 12px default)
 *   data-fg-lb-bullet-radius         = "50%"                  (absent = 50% default)
 *   data-fg-lb-bullet-border-width   = "2px"                  (absent = 2px default)
 *   data-fg-lb-bullet-spacing        = "8px"
 *   data-fg-lb-thumbnail-location    = "none" | "bottom" | "top" | "left" | "right"
 *   data-fg-lb-thumbnail-size        = "small" | "normal" | "large"
 *   data-fg-lb-overlay-blur          = "2"                    (px integer; 0 = none)
 *   data-fg-lb-preload-slides        = "2"                    (integer; slides to preload ahead and behind; absent = 2)
 *   data-fg-lb-info-panel            = "off"                  (present = info panel disabled; absent = enabled)
 *   data-fg-lb-info-default          = "closed"               (present = panel starts collapsed; absent = open)
 *   data-fg-lb-info-location         = "left" | "bottom"      (absent = "right" default; omitted when info panel disabled)
 *   data-fg-lb-no-backdrop-close                              (present = disabled; absent = enabled)
 *   data-fg-lb-no-loop                                        (present = no-loop; absent = loop enabled)
 *   data-fg-lb-hide-arrows-at-ends                            (present = hide at first/last; absent = always show)
 *   data-fg-lb-progress-style        = "spinner" | "none"     (absent = "bar" default)
 *   data-fg-lb-progress-color        rgba                     progress indicator colour
 *   data-fg-lb-progress-bar-loc      = "top" | "left" | "right" (absent = "bottom" default)
 *   data-fg-lb-progress-pause-on     = "image_hover thumbnail_hover" (space-sep, absent = "image_hover" default)
 *   data-fg-lb-progress-stop                                   (present = stop on interaction)
 *   data-fg-lb-progress-controls                               (present = show play/pause controls)
 *   data-fg-lb-thumb-spacing         = "5"                    (px integer string, absent = 5 default)
 *   data-fg-lb-no-thumb-drag                                   (present = drag disabled; absent = enabled)
 *   data-fg-lb-no-thumb-swipe                                  (present = swipe disabled; absent = enabled)
 *   data-fg-lb-fullscreen                                      (present = fullscreen button shown)
 *   data-fg-lb-no-tooltips                                     (present = tooltips disabled)
 *   data-fg-lb-zoom                                            (present = zoom enabled)
 *   data-fg-lb-zoom-icons                                      (present = show zoom +/- icons)
 *   data-fg-lb-zoom-beyond                                     (present = allow zoom beyond original size)
 *   data-fg-lb-info-blocks           = "caption description ..." (space-sep ordered list of enabled blocks)
 *   data-fg-lb-info-blocks-style     = "boxed" | "divided" | "plain"
 *   data-fg-lb-info-block-divider    rgba - divider colour (only when style=divided)
 *   data-fg-lb-credit-source         = "exif"  (absent = "item_meta" default)
 *   data-fg-lb-exif-fields           = "camera aperture ..." (space-sep list of enabled EXIF field keys; absent = exif block disabled or display_exif off)
 *
 * Image filter attributes (desktop breakpoint values only - lightbox is fullscreen):
 *   data-fg-lb-thumb-filter          = combined CSS filter string for lightbox thumbnail strip images
 *                                      (e.g. "grayscale(50%) blur(3px)") - emitted only when thumbnail
 *                                      filter is enabled and at least one filter type is selected.
 *   data-fg-lb-thumb-filter-hover    = combined CSS filter string applied on thumbnail :hover
 *                                      - emitted only when thumbnail filter is enabled.
 *   data-fg-lb-full-filter           = combined CSS filter string for the main lightbox stage image
 *                                      (e.g. "sepia(80%)") - emitted only when full-image filter is
 *                                      enabled and at least one filter type is selected.
 *   data-fg-lb-full-filter-hover     = combined CSS filter string applied on main image :hover
 *                                      - emitted only when full-image filter is enabled.
 *
 * Attributes with a boolean nature follow the "presence = true, absence = false"
 * convention: they are only emitted when the setting is truthy. The JS reads them
 * with hasAttribute() or dataset checks rather than comparing against the string "true".
 *
 * @package FotoGrids\Render\Lightbox\Classic
 * @since   1.0.0
 */
final class Lightbox implements Feature {

	use Setting_Helpers;

	private const DEFAULT_INFO_BLOCKS = array( 'title', 'caption', 'description', 'file_info', 'exif', 'share', 'credit', 'tags', 'people', 'location' );

	/** @var array<string, array{prev: string, next: string}>|null */
	private static ?array $arrow_icons_cache = null;

	/**
	 * Loads arrow SVG pairs from arrow-icons.json, cached for the request.
	 *
	 * @return array<string, array{prev: string, next: string}>
	 */
	private static function arrow_icons(): array {
		if ( null !== self::$arrow_icons_cache ) {
			return self::$arrow_icons_cache;
		}
		$path = __DIR__ . '/../shared/arrow-icons.json';
		if ( file_exists( $path ) ) {
			$decoded = json_decode( file_get_contents( $path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled local plugin file (not a remote URL); WP_Filesystem is unnecessary here.
			if ( is_array( $decoded ) ) {
				self::$arrow_icons_cache = $decoded;
				return self::$arrow_icons_cache;
			}
		}
		// Fallback: bare chevrons so the lightbox always has something.
		self::$arrow_icons_cache = array(
			'chevron' => array(
				'prev' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
				'next' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			),
		);
		return self::$arrow_icons_cache;
	}

	public function id(): string {
		return 'fotogrids/lightbox';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	public function supports( Render_Context $render_context ): bool {
		// Lightbox shows full-size attachment media for the items inside a
		// collection. Album items are themselves galleries (their click goes
		// to a view-page or AJAX-swaps to the child gallery), so there is
		// no "open this item in a lightbox" semantic. Opt out cleanly to
		// avoid polluting album wrappers with data-fg-click + data-fg-lb-*.
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}

		if ( 'lightbox' !== $render_context->behavior->click_behavior ) {
			return false;
		}

		return 'full' === $render_context->behavior->lightbox_variant;
	}

	/**
	 * Emits data-fg-click and all per-gallery lightbox configuration as
	 * data-fg-lb-* attributes on the gallery wrapper element.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$s     = $render_context->settings;
		$attrs = array( 'data-fg-click' => 'lightbox' );

		// Theme
		$theme                     = \FotoGrids\Render\Lightbox\Shared\Lightbox_Colors::theme( $s );
		$attrs['data-fg-lb-theme'] = $theme;

		// ── Colour palette ────────────────────────────────────────────────────
		// The dark/light/custom palette is resolved by the shared
		// Lightbox_Colors helper (also used by LightboxGrid). attrs() returns
		// the always-on data-fg-lb-* colour map; the conditional colours
		// (info-block bg/divider, image shadow) are emitted below because they
		// depend on non-colour settings. $palette gives the resolved fallback
		// values those conditional emissions need. JS uses these to build the
		// full CSS variable block - no theme classes in SCSS.
		$attrs   = array_merge( $attrs, \FotoGrids\Render\Lightbox\Shared\Lightbox_Colors::attrs( $s ) );
		$palette = \FotoGrids\Render\Lightbox\Shared\Lightbox_Colors::palette( $s );

		// Info blocks style - drives visual separation between blocks.
		$info_blocks_style = is_string( $s['lightbox_info_blocks_style'] ?? null ) ? (string) $s['lightbox_info_blocks_style'] : 'boxed';
		$allowed_styles    = array( 'boxed', 'divided', 'plain' );
		if ( ! in_array( $info_blocks_style, $allowed_styles, true ) ) {
			$info_blocks_style = 'boxed';
		}
		$attrs['data-fg-lb-info-blocks-style'] = $info_blocks_style;

		// Info block background - only when style = boxed.
		if ( 'boxed' === $info_blocks_style ) {
			$attrs['data-fg-lb-info-block-bg'] = 'custom' === $theme
				? $this->safe_color( $s['lightbox_info_block_bg'] ?? null, $palette['info_block_bg'] )
				: $palette['info_block_bg'];
		}

		// Info block divider colour - only when style = divided.
		if ( 'divided' === $info_blocks_style ) {
			$attrs['data-fg-lb-info-block-divider'] = 'custom' === $theme
				? $this->safe_color( $s['lightbox_info_block_divider'] ?? null, $palette['info_block_divider'] )
				: $palette['info_block_divider'];
		}

		// Image shadow - emitted only when the shadow is enabled.
		if ( $this->setting_to_bool( $s['lightbox_img_shadow_enabled'] ?? false ) ) {
			$shadow_color                   = 'custom' === $theme
				? $this->safe_color( $s['lightbox_img_shadow_color'] ?? null, 'rgba(0, 0, 0, 0.3)' )
				: ( 'light' === $theme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.3)' );
			$attrs['data-fg-lb-img-shadow'] = $shadow_color;
		}

		// Transition
		$attrs['data-fg-lb-transition'] = is_string( $s['lightbox_transition'] ?? null ) ? (string) $s['lightbox_transition'] : 'fade';

		// Duration (ms) - when the button_group value is "custom", use the custom field.
		$duration_raw = $s['lightbox_transition_duration'] ?? 300;
		if ( 'custom' === $duration_raw ) {
			$duration = absint( $s['lightbox_transition_duration_custom'] ?? 400 );
		} else {
			$duration = absint( $duration_raw );
		}
		if ( 300 !== $duration ) {
			$attrs['data-fg-lb-duration'] = (string) $duration;
		}

		// Auto-progress (boolean - present = true)
		if ( $this->setting_to_bool( $s['lightbox_auto_progress'] ?? true ) ) {
			$attrs['data-fg-lb-auto-progress'] = '1';
			$delay                             = absint( $s['lightbox_auto_progress_delay'] ?? 5 );
			if ( 5 !== $delay ) {
				$attrs['data-fg-lb-auto-delay'] = (string) $delay;
			}

			// Progress indicator style (bar by default - omit attribute when bar).
			// Accepted values: "bar" (default, omitted) | "spinner" | "none".
			$progress_style = is_string( $s['lightbox_auto_progress_style'] ?? null ) ? (string) $s['lightbox_auto_progress_style'] : 'bar';
			if ( 'bar' !== $progress_style ) {
				$attrs['data-fg-lb-progress-style'] = $progress_style;
			}

			// Progress bar location (bottom by default - omit attribute when bottom)
			if ( 'bar' === $progress_style ) {
				$bar_loc = is_string( $s['lightbox_auto_progress_bar_location'] ?? null ) ? (string) $s['lightbox_auto_progress_bar_location'] : 'bottom';
				if ( 'bottom' !== $bar_loc ) {
					$attrs['data-fg-lb-progress-bar-loc'] = $bar_loc;
				}
			}

			// Progress indicator colour - emitted for all themes when style ≠ none.
			if ( 'none' !== $progress_style ) {
				$progress_color_default             = 'rgba(60, 70, 240, 1)'; // --fg-colors-blue
				$attrs['data-fg-lb-progress-color'] = 'custom' === $theme
					? $this->safe_color( $s['lightbox_progress_color'] ?? null, $progress_color_default )
					: $progress_color_default;
			}

			// Pause-on: token_select stored as array (e.g. ['image_hover', 'click']).
			$pause_on_raw = $s['lightbox_auto_progress_pause_on'] ?? array( 'image_hover' );
			if ( is_array( $pause_on_raw ) && ! empty( $pause_on_raw ) ) {
				$pause_on_clean = array_intersect( array_map( 'strval', $pause_on_raw ), array( 'image_hover', 'thumbnail_hover' ) );
				if ( ! empty( $pause_on_clean ) ) {
					$attrs['data-fg-lb-progress-pause-on'] = implode( ' ', $pause_on_clean );
				}
			}

			// Stop on interaction (false by default - only emit when true)
			if ( $this->setting_to_bool( $s['lightbox_auto_progress_stop_on_interaction'] ?? true ) ) {
				$attrs['data-fg-lb-progress-stop'] = '';
			}

			// Show play/pause controls (false by default - only emit when true)
			if ( $this->setting_to_bool( $s['lightbox_auto_progress_show_controls'] ?? false ) ) {
				$attrs['data-fg-lb-progress-controls'] = '';
			}
		}

		// Fit media (boolean - present = true)
		if ( $this->setting_to_bool( $s['lightbox_fit_media'] ?? true ) ) {
			$attrs['data-fg-lb-fit-media'] = '1';
		}

		// Mobile layout
		$mob = is_string( $s['lightbox_mobile_layout'] ?? null ) ? (string) $s['lightbox_mobile_layout'] : 'mobile_optimized';
		if ( 'mobile_optimized' !== $mob ) {
			$attrs['data-fg-lb-mobile-layout'] = $mob;
		}

		// Arrows (boolean - present = true; arrows are ON by default so only write when ON)
		if ( $this->setting_to_bool( $s['lightbox_show_arrows'] ?? true ) ) {
			$attrs['data-fg-lb-show-arrows'] = '1';

			// Embed the SVG pair directly so JS never has to look them up from
			// window.FotoGridsIcons (which loads async and is admin-only).
			$arrow_icon_key                 = is_string( $s['lightbox_arrow_icon'] ?? null ) ? $s['lightbox_arrow_icon'] : 'chevron';
			$icons                          = self::arrow_icons();
			$arrow_pair                     = $icons[ $arrow_icon_key ] ?? $icons['chevron'];
			$attrs['data-fg-lb-arrow-prev'] = $arrow_pair['prev'];
			$attrs['data-fg-lb-arrow-next'] = $arrow_pair['next'];

			$arrow_size = absint( $s['lightbox_arrow_size'] ?? 40 );
			if ( 40 !== $arrow_size ) {
				$attrs['data-fg-lb-arrow-size'] = (string) $arrow_size;
			}
		}

		// Dots (boolean - present = true; dots are OFF by default so only write when ON)
		if ( $this->setting_to_bool( $s['lightbox_show_dots'] ?? false ) ) {
			$attrs['data-fg-lb-show-dots'] = '1';

			$size_raw   = is_array( $s['lightbox_bullet_size'] ?? null ) ? $s['lightbox_bullet_size'] : array();
			$dot_width  = $this->normalize_unit_value( $size_raw['width'] ?? null, 'px' );
			$dot_height = $this->normalize_unit_value( $size_raw['height'] ?? null, 'px' );
			if ( '' !== $dot_width ) {
				$attrs['data-fg-lb-bullet-width'] = $dot_width;
			}
			if ( '' !== $dot_height ) {
				$attrs['data-fg-lb-bullet-height'] = $dot_height;
			}

			$dot_radius = $this->normalize_unit_value( $s['lightbox_bullet_radius'] ?? null, 'px' );
			if ( '' !== $dot_radius ) {
				$attrs['data-fg-lb-bullet-radius'] = $dot_radius;
			}

			$dot_border = $this->normalize_unit_value( $s['lightbox_bullet_border_width'] ?? null, 'px' );
			if ( '' !== $dot_border ) {
				$attrs['data-fg-lb-bullet-border-width'] = $dot_border;
			}

			$spacing = $this->normalize_unit_value( $s['lightbox_bullet_spacing'] ?? null, 'px' );
			if ( '' !== $spacing && '8px' !== $spacing ) {
				$attrs['data-fg-lb-bullet-spacing'] = $spacing;
			}
		}

		// Counter (false by default - only emit when enabled)
		if ( $this->setting_to_bool( $s['lightbox_show_counter'] ?? false ) ) {
			$attrs['data-fg-lb-show-counter'] = '';
		}

		$blur = absint( $s['lightbox_overlay_blur'] ?? 8 );
		if ( 8 !== $blur ) {
			$attrs['data-fg-lb-overlay-blur'] = (string) $blur;
		}

		$preload_slides = absint( $s['lightbox_preload_slides'] ?? 2 );
		if ( 2 !== $preload_slides ) {
			$attrs['data-fg-lb-preload-slides'] = (string) $preload_slides;
		}

		// Info panel visibility - enabled by default; emit absence-marker only when disabled.
		$info_panel_enabled = $this->setting_to_bool( $s['lightbox_info_panel_enabled'] ?? true );
		if ( ! $info_panel_enabled ) {
			$attrs['data-fg-lb-info-panel'] = 'off';
		}

		if ( $info_panel_enabled ) {
			// Default panel state - open by default; emit attribute only when collapsed.
			$info_default_state = is_string( $s['lightbox_info_panel_default_state'] ?? null ) ? (string) $s['lightbox_info_panel_default_state'] : 'open';
			if ( 'closed' === $info_default_state ) {
				$attrs['data-fg-lb-info-default'] = 'closed';
			}

			// Info panel location (only relevant when panel is shown).
			$info_location = is_string( $s['lightbox_info_panel_location'] ?? null ) ? (string) $s['lightbox_info_panel_location'] : 'right';
			if ( 'right' !== $info_location ) {
				$attrs['data-fg-lb-info-location'] = $info_location;
			}
		}

		// Backdrop close (true by default - only emit attribute when disabled)
		if ( ! $this->setting_to_bool( $s['lightbox_backdrop_close'] ?? true ) ) {
			$attrs['data-fg-lb-no-backdrop-close'] = '';
		}

		// Loop (true by default - only emit attribute when disabled)
		if ( ! $this->setting_to_bool( $s['lightbox_loop'] ?? true ) ) {
			$attrs['data-fg-lb-no-loop'] = '';
		}

		// Hide arrows at ends (false by default - only emit when enabled)
		if ( $this->setting_to_bool( $s['lightbox_hide_arrows_at_ends'] ?? false ) ) {
			$attrs['data-fg-lb-hide-arrows-at-ends'] = '';
		}

		// Fullscreen button (false by default - only emit when enabled)
		if ( $this->setting_to_bool( $s['lightbox_fullscreen'] ?? true ) ) {
			$attrs['data-fg-lb-fullscreen'] = '';
		}

		// Tooltips - enabled by default; emit absence-marker only when disabled
		if ( ! $this->setting_to_bool( $s['lightbox_show_tooltips'] ?? true ) ) {
			$attrs['data-fg-lb-no-tooltips'] = '';
		}

		// Zoom
		if ( $this->setting_to_bool( $s['lightbox_zoom'] ?? true ) ) {
			$attrs['data-fg-lb-zoom'] = '';

			$trigger                          = $s['lightbox_zoom_trigger'] ?? 'double_click';
			$allowed                          = array( 'double_click', 'click', 'wheel_pinch' );
			$attrs['data-fg-lb-zoom-trigger'] = in_array( $trigger, $allowed, true ) ? $trigger : 'double_click';

			if ( $this->setting_to_bool( $s['lightbox_zoom_icons'] ?? false ) ) {
				$attrs['data-fg-lb-zoom-icons'] = '';
			}

			if ( $this->setting_to_bool( $s['lightbox_zoom_beyond_original'] ?? true ) ) {
				$attrs['data-fg-lb-zoom-beyond'] = '';
			}
		}

		// Thumbnail strip
		$thumb_loc = is_string( $s['lightbox_thumbnail_strip_location'] ?? null ) ? (string) $s['lightbox_thumbnail_strip_location'] : 'bottom';
		// Always write thumbnail-location so JS knows whether to build the strip.
		$attrs['data-fg-lb-thumbnail-location'] = $thumb_loc;

		if ( 'none' !== $thumb_loc ) {
			$thumb_size = is_string( $s['lightbox_thumbnail_size'] ?? null ) ? (string) $s['lightbox_thumbnail_size'] : 'normal';
			if ( 'normal' !== $thumb_size ) {
				$attrs['data-fg-lb-thumbnail-size'] = $thumb_size;
			}

			// Thumbnail spacing (5 by default - omit when default)
			$thumb_spacing = absint( $s['lightbox_thumbnail_spacing'] ?? 5 );
			if ( 5 !== $thumb_spacing ) {
				$attrs['data-fg-lb-thumb-spacing'] = (string) $thumb_spacing;
			}

			// Thumbnail drag (true by default - emit attribute when disabled)
			if ( ! $this->setting_to_bool( $s['lightbox_thumbnail_drag'] ?? true ) ) {
				$attrs['data-fg-lb-no-thumb-drag'] = '';
			}

			// Thumbnail swipe (true by default - emit attribute when disabled)
			if ( ! $this->setting_to_bool( $s['lightbox_thumbnail_swipe'] ?? true ) ) {
				$attrs['data-fg-lb-no-thumb-swipe'] = '';
			}
		}

		// Info panel blocks - token_select stored as array. The attribute is
		// always emitted (even empty) so JS can distinguish an explicit empty
		// selection from an absent attribute. An empty selection means the
		// panel is not rendered.
		if ( $info_panel_enabled ) {
			$info_blocks_raw                 = $s['lightbox_info_blocks'] ?? self::DEFAULT_INFO_BLOCKS;
			$info_blocks_raw                 = is_array( $info_blocks_raw ) ? $info_blocks_raw : array();
			$info_blocks_clean               = array_values( array_filter( array_map( 'strval', $info_blocks_raw ) ) );
			$attrs['data-fg-lb-info-blocks'] = implode( ' ', $info_blocks_clean );

			// Credit source - only relevant when credit block is enabled.
			if ( in_array( 'credit', $info_blocks_clean, true ) ) {
				$credit_source = is_string( $s['lightbox_credit_source'] ?? null ) ? (string) $s['lightbox_credit_source'] : 'item_meta';
				if ( in_array( $credit_source, array( 'exif', 'xmp' ), true ) ) {
					$attrs['data-fg-lb-credit-source'] = $credit_source;
				}
			}

			// EXIF fields - which fields are enabled for display in the EXIF block.
			// Only emitted when the exif block is enabled and display_exif is on.
			if ( in_array( 'exif', $info_blocks_clean, true ) && $this->setting_to_bool( $s['display_exif'] ?? false ) ) {
				$exif_key_map   = array(
					'exif_camera'        => 'camera',
					'exif_aperture'      => 'aperture',
					'exif_shutter_speed' => 'shutter_speed',
					'exif_iso'           => 'iso',
				);
				$enabled_fields = array();
				foreach ( $exif_key_map as $setting_key => $field_key ) {
					if ( $this->setting_to_bool( $s[ $setting_key ] ?? true ) ) {
						$enabled_fields[] = $field_key;
					}
				}
				// Add-ons extend the emitted EXIF field list (mirrors
				// Exif_Extractor::enabled_fields_for_gallery()).
				$enabled_fields = (array) apply_filters(
					Filters_Data::EXIF_ENABLED_FIELDS,
					$enabled_fields,
					$s,
					$render_context->meta->gallery_id
				);
				if ( ! empty( $enabled_fields ) ) {
					$attrs['data-fg-lb-exif-fields'] = implode( ' ', $enabled_fields );
				}
			}
		}

		// ── Image filters ────────────────────────────────────────────────────
		// Thumbnail filter (applies to the lightbox thumbnail strip images).
		if ( $this->setting_to_bool( $s['thumbnail_filter_enabled'] ?? false ) ) {
			$thumb_filter = $this->build_filter_string( $s, 'thumbnail_filter_type', 'thumbnail_filter_amount_' );
			if ( '' !== $thumb_filter ) {
				$attrs['data-fg-lb-thumb-filter'] = $thumb_filter;
			}
			$thumb_filter_hover = $this->build_filter_string( $s, 'thumbnail_filter_type', 'thumbnail_filter_hover_amount_' );
			if ( '' !== $thumb_filter_hover ) {
				$attrs['data-fg-lb-thumb-filter-hover'] = $thumb_filter_hover;
			}
		}

		// Full-image filter (applies to the main lightbox stage image).
		if ( $this->setting_to_bool( $s['full_image_filter_enabled'] ?? false ) ) {
			$full_filter = $this->build_filter_string( $s, 'full_image_filter_type', 'full_image_filter_amount_' );
			if ( '' !== $full_filter ) {
				$attrs['data-fg-lb-full-filter'] = $full_filter;
			}
			$full_filter_hover = $this->build_filter_string( $s, 'full_image_filter_type', 'full_image_filter_hover_amount_' );
			if ( '' !== $full_filter_hover ) {
				$attrs['data-fg-lb-full-filter-hover'] = $full_filter_hover;
			}
		}

		return $attrs;
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * Lightbox gallery items should show a pointer cursor.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Declares the lightbox JS and CSS assets.
	 *
	 * Asset_Resolver base URL: plugin_url/public/render/
	 * Paths below are relative from that base.
	 *
	 *   ../../assets/css/lightbox-styles.css → overlay styles (webpack: lightbox-styles entry)
	 *   ../../assets/js/lightbox.js          → overlay JS    (webpack: lightbox entry)
	 *
	 * Both the JS and SCSS sources now live alongside this file in
	 * public/render/lightbox/classic/ and are compiled by webpack from there.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				// Tooltip styles - shared across all frontend surfaces.
				'fotogrids-tooltip'  => new Asset_Decl(
					'../../assets/css/fg-tooltip.css',
					array(),
					false,
				),
				// Full overlay stylesheet compiled from lightbox.scss.
				'fotogrids-lightbox' => new Asset_Decl(
					'../../assets/css/lightbox-styles.css',
					array(),
					false,
				),
			),
			array(
				// Tooltip module - loaded before lightbox so FgTooltip is available.
				'fotogrids-tooltip'  => new Asset_Decl(
					'../../assets/js/fg-tooltip.js',
					array(),
					true,
				),
				'fotogrids-lightbox' => new Asset_Decl(
					'../../assets/js/lightbox.js',
					array( 'fotogrids-tooltip' ),
					true,
				),
			)
		);
	}

	/**
	 * Returns $value if it looks like a valid CSS colour string, otherwise $default.
	 *
	 * Accepts:
	 *   - 3- and 6-digit hex (#RGB, #RRGGBB)
	 *   - 8-digit hex with alpha (#RRGGBBAA)
	 *   - rgb() and rgba()
	 *   - hsl() and hsla()
	 *
	 * The color picker (fg-color-picker.js) emits rgba() strings, so hex-only
	 * validation would silently discard every user-picked colour.
	 *
	 * @since   1.0.0
	 * @param   mixed  $value   Raw setting value.
	 * @param   string $default Fallback colour string.
	 * @return  string
	 */
	private function safe_color( $value, string $default_value ): string {
		if ( ! is_string( $value ) ) {
			return $default_value;
		}
		$v = trim( $value );
		if (
			preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $v ) ||
			preg_match( '/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(\s*,\s*[\d.]+)?\s*\)$/', $v ) ||
			preg_match( '/^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(\s*,\s*[\d.]+)?\s*\)$/', $v )
		) {
			return $v;
		}
		return $default_value;
	}

	/**
	 * Build a desktop-breakpoint CSS filter string from a multi-select filter
	 * type setting and the corresponding per-filter amount settings.
	 *
	 * Lightbox is always fullscreen, so only the desktop breakpoint value is
	 * needed (responsive CSS vars are not scoped inside the lightbox dialog).
	 *
	 * Example output: "grayscale(50%) blur(3px)"
	 * Empty string is returned when no valid filter types are selected.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $s            Full settings array.
	 * @param   string               $type_key     Settings key that holds the filter type array
	 *                                             (e.g. 'thumbnail_filter_type').
	 * @param   string               $amount_prefix Settings key prefix for per-filter amounts
	 *                                             (e.g. 'thumbnail_filter_amount_').
	 * @return  string  Combined CSS filter string, or '' when nothing is selected.
	 */
	private function build_filter_string( array $s, string $type_key, string $amount_prefix ): string {
		$allowed = array(
			'grayscale',
			'sepia',
			'blur',
			'brightness',
			'contrast',
			'saturate',
			'invert',
			'opacity',
			'hue-rotate',
		);

		$filter_meta = array(
			'grayscale'  => array(
				'suffix' => 'grayscale',
				'unit'   => '%',
			),
			'sepia'      => array(
				'suffix' => 'sepia',
				'unit'   => '%',
			),
			'blur'       => array(
				'suffix' => 'blur',
				'unit'   => 'px',
			),
			'brightness' => array(
				'suffix' => 'brightness',
				'unit'   => '%',
			),
			'contrast'   => array(
				'suffix' => 'contrast',
				'unit'   => '%',
			),
			'saturate'   => array(
				'suffix' => 'saturate',
				'unit'   => '%',
			),
			'invert'     => array(
				'suffix' => 'invert',
				'unit'   => '%',
			),
			'opacity'    => array(
				'suffix' => 'opacity',
				'unit'   => '%',
			),
			'hue-rotate' => array(
				'suffix' => 'hue_rotate',
				'unit'   => 'deg',
			),
		);

		// Decode the token_select value (JSON string, PHP array, or legacy plain string).
		$raw = $s[ $type_key ] ?? array();
		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			$raw     = is_array( $decoded ) ? $decoded : array( $raw );
		}
		if ( ! is_array( $raw ) ) {
			return '';
		}

		$parts = array();
		foreach ( $raw as $type ) {
			if ( ! is_string( $type ) || ! in_array( $type, $allowed, true ) ) {
				continue;
			}
			$meta   = $filter_meta[ $type ];
			$key    = $amount_prefix . $meta['suffix'];
			$amount = $this->resolve_responsive_value( $s[ $key ] ?? array(), 'desktop', $meta['unit'] );
			if ( '' !== $amount ) {
				$parts[] = $type . '(' . $amount . ')';
			}
		}

		return implode( ' ', $parts );
	}
}
