<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Features\Ui;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Filter_Option;
use FotoGrids\Render\Api\Font_Resolver;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;
use FotoGrids\Render\Internal\Layout_Capabilities;
use FotoGrids\Render\Internal\Module_Registry;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Filter UI feature.
 *
 * Renders the filter bar (`.fotogrids-filters`) inside the gallery wrapper,
 * before the layout content, via html_before().
 *
 * Responsibilities:
 *  - Queries the filter_sources registry for active sources.
 *  - Builds the filter bar HTML (buttons / dropdowns / checkboxes) per
 *    `filter_ui_style` setting.
 *  - Emits CSS variable declarations into the wrapper <style> block (via
 *    style_vars) - no hardcoded colours or sizes.
 *  - Writes `data-fg-filter-ui` and `data-fg-filter-style` onto the gallery
 *    wrapper so the JS and CSS can scope cleanly.
 *  - Enqueues the filter CSS and JS assets once per page.
 *
 * Active when `filtering_enabled` is truthy and at least one filter source
 * is active.
 *
 * @package FotoGrids\Render\Filters\Features\Ui
 * @since   1.0.0
 */
final class Filter_Ui implements Feature {

	use Setting_Helpers;

	/** @var array<string, string> Allowed filter_ui_style values. */
	private const ALLOWED_STYLES = array( 'buttons', 'dropdowns', 'checkboxes' );

	/** @var array<string, string> Allowed filter_ui_position values. */
	private const ALLOWED_POSITIONS = array( 'top', 'sidebar' );

	/** @var array<string, string> Allowed filter_sidebar_side values. */
	private const ALLOWED_SIDEBAR_SIDES = array( 'left', 'right' );

	/** @var array<string, string> Allowed filter_display_mode values. */
	private const ALLOWED_DISPLAY_MODES = array( 'always', 'toggle' );

	public function id(): string {
		return 'fotogrids/filter-ui';
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

	/**
	 * Active when filtering is enabled and at least one source is active.
	 *
	 * @since  1.0.0
	 */
	public function supports( Render_Context $render_context ): bool {
		// Filters operate on attachment-level metadata (tags, people,
		// locations on the items inside a gallery). Album items are
		// galleries, not attachments - none of the filter sources have
		// anything to filter by.
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}

		// Ask the active layout whether it wants a filter bar around it.
		// Single Item / Image Viewer / Slider / Carousel return
		// capabilities()['filters'] = false because they render a single
		// item (or handle navigation themselves) - filtering chrome on top
		// would make no sense. Belt-and-braces: this also catches the case
		// where a user toggled filtering on in a multi-item layout and
		// then switched to one of these layouts.
		if ( ! Layout_Capabilities::supports( $render_context, 'filters' ) ) {
			return false;
		}

		if ( ! ( $render_context->settings['filtering_enabled'] ?? false ) ) {
			return false;
		}

		$sources = Module_Registry::active_modules( 'filter_sources', $render_context );

		return count( $sources ) > 0;
	}

	/**
	 * Builds and returns the .fotogrids-filters HTML block.
	 *
	 * Placed inside the gallery wrapper, before the layout grid, so JS can
	 * use `wrapper.querySelector('.fotogrids-filters')` to find it.
	 *
	 * @since  1.0.0
	 */
	public function html_before( Render_Context $render_context ): string {
		$sources = Module_Registry::active_modules( 'filter_sources', $render_context );
		if ( empty( $sources ) ) {
			return '';
		}

		$style          = $this->resolve_style( $render_context );
		$position       = $this->resolve_position( $render_context );
		$display_mode   = $this->resolve_display_mode( $render_context );
		$reset_enabled  = (bool) ( $render_context->settings['filter_reset_btn_enabled'] ?? true );
		$reset_position = $this->resolve_reset_position( $render_context );
		$reset_label    = $this->resolve_reset_label( $render_context );
		$show_count     = (bool) ( $render_context->settings['show_filter_count'] ?? true );

		// When toggle mode is active, the filter bar starts collapsed. The
		// toggle button lives inside .fotogrids-filters as its first child so
		// it stays visible while every other child is hidden via CSS.
		$collapsed_attr = '';
		if ( 'toggle' === $display_mode ) {
			$collapsed_attr = ' data-fg-filter-collapsed="true"';
		}

		$html = sprintf(
			'<div class="fotogrids-filters fg-filters--%s fg-filters--%s" role="group" aria-label="%s" data-fg-filter-display="%s"%s>',
			esc_attr( $style ),
			esc_attr( $position ),
			esc_attr__( 'Filter gallery items', 'fotogrids' ),
			esc_attr( $display_mode ),
			$collapsed_attr
		);

		if ( 'toggle' === $display_mode ) {
			$html .= $this->render_toggle_button();
		}

		// Reset control + filter groups share a single wrapper so the
		// reset button can be flex-ordered relative to the groups
		// (Start | End) and so the wrapper itself can switch axis
		// between top (row) and sidebar (column) positions.
		$html .= sprintf(
			'<div class="fg-filter__wrapper" data-fg-filter-reset-position="%s">',
			esc_attr( $reset_position )
		);

		if ( $reset_enabled ) {
			$html .= $this->render_all_control( $style, $reset_label );
		}

		foreach ( $sources as $source ) {
			$options = $source->get_options( $render_context );
			if ( empty( $options ) ) {
				continue;
			}

			$group_id    = 'fg-filter-group-' . esc_attr( sanitize_html_class( $source->id() ) );
			$attr_key    = esc_attr( $source->item_data_attr_key() );
			$group_label = esc_html( $source->group_label( $render_context ) );

			$html .= sprintf(
				'<div class="fg-filter-group" data-fg-filter-source="%s" data-fg-filter-attr="%s" aria-label="%s">',
				esc_attr( $source->id() ),
				$attr_key,
				$group_label
			);

			switch ( $style ) {
				case 'dropdowns':
					$html .= $this->render_dropdown( $group_id, $group_label, $options, $show_count );
					break;

				case 'checkboxes':
					$html .= $this->render_checkboxes( $group_id, $group_label, $options, $show_count );
					break;

				default: // 'buttons'
					$html .= $this->render_buttons( $options, $show_count );
					break;
			}

			$html .= '</div>'; // .fg-filter-group
		}

		$html .= '</div>'; // .fg-filter__wrapper
		$html .= '</div>'; // .fotogrids-filters

		return $html;
	}

	/**
	 * No appendix content needed.
	 *
	 * @since  1.0.0
	 */
	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * No after-wrapper content needed.
	 *
	 * @since  1.0.0
	 */
	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Writes filter state onto the gallery wrapper for JS and CSS scoping.
	 *
	 * @since  1.0.0
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$attrs = array(
			'data-fg-filter-ui'       => 'true',
			'data-fg-filter-style'    => $this->resolve_style( $render_context ),
			'data-fg-filter-position' => $this->resolve_position( $render_context ),
			'data-fg-filter-display'  => $this->resolve_display_mode( $render_context ),
			'data-fg-filter-multiple' => $this->resolve_multiple( $render_context ) ? 'true' : 'false',
		);

		if ( $this->resolve_position( $render_context ) === 'sidebar' ) {
			$attrs['data-fg-filter-sidebar-side'] = $this->resolve_sidebar_side( $render_context );
		}

		return $attrs;
	}

	/**
	 * Provides CSS variables consumed by the filter bar stylesheet.
	 *
	 * All visual properties of the filter bar are expressed as CSS variables
	 * set here - the SCSS never hardcodes colours or sizes. JS reads the same
	 * variables for animated state (e.g. active bg).
	 *
	 * @since  1.0.0
	 */
	public function style_vars( Render_Context $render_context ): array {
		$s = $render_context->settings;

		$vars = array();

		// ---- Spacing ----
		// All four are responsive_range settings with px/em/rem units.
		// resolve_responsive_value() reads the per-breakpoint {value, unit}
		// object (or scalar) and falls back to px when no unit is stored.
		$responsive_specs = array(
			'--fg-filter-wrapper-gap'   => 'filter_wrapper_gap',
			'--fg-filter-bar-gap'       => 'filter_bar_gap',
			'--fg-filter-gap'           => 'filter_gap',
			'--fg-filter-sidebar-width' => 'filter_sidebar_width',
		);
		foreach ( $responsive_specs as $css_var => $setting_key ) {
			$raw     = $s[ $setting_key ] ?? null;
			$desktop = $this->resolve_responsive_value( $raw, 'desktop', 'px' );
			$tablet  = $this->resolve_responsive_value( $raw, 'tablet', 'px' );
			$mobile  = $this->resolve_responsive_value( $raw, 'mobile', 'px' );

			if ( '' !== $desktop || '' !== $tablet || '' !== $mobile ) {
				$vars[ $css_var ] = new Responsive_Var(
					$desktop,
					$tablet,
					$mobile,
				);
			}
		}

		// filter_panel_padding - responsive four-sided, drives the bar's
		// own internal padding via --fg-filter-panel-padding.
		$panel_padding = $s['filter_panel_padding'] ?? null;
		$desktop_panel = $this->resolve_four_sided_value( $panel_padding, 'desktop', 'px' );
		$tablet_panel  = $this->resolve_four_sided_value( $panel_padding, 'tablet', 'px' );
		$mobile_panel  = $this->resolve_four_sided_value( $panel_padding, 'mobile', 'px' );

		if ( '' !== $desktop_panel || '' !== $tablet_panel || '' !== $mobile_panel ) {
			$vars['--fg-filter-panel-padding'] = new Responsive_Var(
				$desktop_panel,
				$tablet_panel,
				$mobile_panel,
			);
		}

		// Filter panel surface: background colour + corner radius.
		$this->maybe_add_var( $vars, '--fg-filter-panel-bg', $s['filter_panel_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-panel-radius', $this->unit_val( $s['filter_panel_radius'] ?? null, 'px' ) );

		// ---- Button shape ----
		// filter_btn_padding is a responsive four-sided setting. Each
		// breakpoint resolves to a CSS shorthand string ("T R B L"),
		// emitted as a Responsive_Var so the per-breakpoint <style>
		// block can swap the value at runtime.
		$padding         = $s['filter_btn_padding'] ?? null;
		$desktop_padding = $this->resolve_four_sided_value( $padding, 'desktop', 'px' );
		$tablet_padding  = $this->resolve_four_sided_value( $padding, 'tablet', 'px' );
		$mobile_padding  = $this->resolve_four_sided_value( $padding, 'mobile', 'px' );

		if ( '' !== $desktop_padding || '' !== $tablet_padding || '' !== $mobile_padding ) {
			$vars['--fg-filter-btn-padding'] = new Responsive_Var(
				$desktop_padding,
				$tablet_padding,
				$mobile_padding,
			);
		}
		$this->maybe_add_var( $vars, '--fg-filter-btn-radius', $this->unit_val( $s['filter_btn_radius'] ?? null, 'px' ) );

		// filter_btn_font_size is a responsive_range with per-side units
		// (px / em / rem). resolve_responsive_value() reads the stored unit
		// off each breakpoint's {value, unit} object and falls back to px
		// when the user hasn't picked one.
		$font_size    = $s['filter_btn_font_size'] ?? null;
		$desktop_font = $this->resolve_responsive_value( $font_size, 'desktop', 'px' );
		$tablet_font  = $this->resolve_responsive_value( $font_size, 'tablet', 'px' );
		$mobile_font  = $this->resolve_responsive_value( $font_size, 'mobile', 'px' );

		if ( '' !== $desktop_font || '' !== $tablet_font || '' !== $mobile_font ) {
			$vars['--fg-filter-btn-font-size'] = new Responsive_Var(
				$desktop_font,
				$tablet_font,
				$mobile_font,
			);
		}

		// Button typography family/weight/style resolve through Font_Resolver.
		$btn_resolver    = Font_Resolver::instance();
		$btn_font_family = $btn_resolver->resolve_font_family( $s['filter_btn_font_family'] ?? null, $render_context );
		if ( '' !== $btn_font_family ) {
			$vars['--fg-filter-btn-font-family'] = $btn_font_family;
		}
		$btn_font_weight = $btn_resolver->resolve_font_weight( $s['filter_btn_font_weight'] ?? null, $render_context );
		if ( '' !== $btn_font_weight ) {
			$vars['--fg-filter-btn-font-weight'] = $btn_font_weight;
		}
		$btn_font_style = $btn_resolver->resolve_font_style( $s['filter_btn_font_style'] ?? null, $render_context );
		if ( '' !== $btn_font_style ) {
			$vars['--fg-filter-btn-font-style'] = $btn_font_style;
		}

		$this->add_text_spacing_vars( $vars, '--fg-filter-btn', $s, 'filter_btn_' );

		// ---- Button colors + borders ----
		// Each state (regular / hover / active) carries its own border colour
		// and width; the SCSS composes them into the final `border` shorthand.
		$this->maybe_add_var( $vars, '--fg-filter-btn-bg', $s['filter_btn_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-btn-color', $s['filter_btn_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-btn-border-color', $s['filter_btn_border_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-btn-border-width', $this->unit_val( $s['filter_btn_border_width'] ?? null, 'px' ) );

		$this->maybe_add_var( $vars, '--fg-filter-btn-hover-bg', $s['filter_btn_hover_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-btn-hover-color', $s['filter_btn_hover_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-btn-hover-border-color', $s['filter_btn_hover_border_color'] ?? null );

		$this->maybe_add_var( $vars, '--fg-filter-btn-active-bg', $s['filter_btn_active_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-btn-active-color', $s['filter_btn_active_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-btn-active-border-color', $s['filter_btn_active_border_color'] ?? null );

		// ---- Dropdown trigger ----
		// Padding is responsive four-sided, mirroring filter_btn_padding.
		$select_padding     = $s['filter_select_padding'] ?? null;
		$desktop_select_pad = $this->resolve_four_sided_value( $select_padding, 'desktop', 'px' );
		$tablet_select_pad  = $this->resolve_four_sided_value( $select_padding, 'tablet', 'px' );
		$mobile_select_pad  = $this->resolve_four_sided_value( $select_padding, 'mobile', 'px' );

		if ( '' !== $desktop_select_pad || '' !== $tablet_select_pad || '' !== $mobile_select_pad ) {
			$vars['--fg-filter-select-padding'] = new Responsive_Var(
				$desktop_select_pad,
				$tablet_select_pad,
				$mobile_select_pad,
			);
		}

		$this->maybe_add_var( $vars, '--fg-filter-select-radius', $this->unit_val( $s['filter_select_radius'] ?? null, 'px' ) );
		$this->maybe_add_var( $vars, '--fg-filter-select-border-width', $this->unit_val( $s['filter_select_border_width'] ?? null, 'px' ) );

		// Per-state trigger colours (Regular / Mouseover / Open).
		$this->maybe_add_var( $vars, '--fg-filter-select-bg', $s['filter_select_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-select-color', $s['filter_select_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-select-border-color', $s['filter_select_border_color'] ?? null );

		$this->maybe_add_var( $vars, '--fg-filter-select-hover-bg', $s['filter_select_hover_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-select-hover-color', $s['filter_select_hover_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-select-hover-border-color', $s['filter_select_hover_border_color'] ?? null );

		$this->maybe_add_var( $vars, '--fg-filter-select-open-bg', $s['filter_select_open_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-select-open-color', $s['filter_select_open_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-select-open-border-color', $s['filter_select_open_border_color'] ?? null );

		// Shared dropdown typography drives BOTH the trigger and the popover
		// option rows. Family/weight/style resolve through Font_Resolver so
		// theme stacks become real CSS; font_size is responsive_range.
		$dropdown_resolver    = Font_Resolver::instance();
		$dropdown_font_family = $dropdown_resolver->resolve_font_family( $s['filter_dropdown_font_family'] ?? null, $render_context );
		if ( '' !== $dropdown_font_family ) {
			$vars['--fg-filter-dropdown-font-family'] = $dropdown_font_family;
		}
		$dropdown_font_weight = $dropdown_resolver->resolve_font_weight( $s['filter_dropdown_font_weight'] ?? null, $render_context );
		if ( '' !== $dropdown_font_weight ) {
			$vars['--fg-filter-dropdown-font-weight'] = $dropdown_font_weight;
		}
		$dropdown_font_style = $dropdown_resolver->resolve_font_style( $s['filter_dropdown_font_style'] ?? null, $render_context );
		if ( '' !== $dropdown_font_style ) {
			$vars['--fg-filter-dropdown-font-style'] = $dropdown_font_style;
		}
		$dropdown_font_size  = $s['filter_dropdown_font_size'] ?? null;
		$dropdown_fs_desktop = $this->resolve_responsive_value( $dropdown_font_size, 'desktop', 'px' );
		$dropdown_fs_tablet  = $this->resolve_responsive_value( $dropdown_font_size, 'tablet', 'px' );
		$dropdown_fs_mobile  = $this->resolve_responsive_value( $dropdown_font_size, 'mobile', 'px' );
		if ( '' !== $dropdown_fs_desktop || '' !== $dropdown_fs_tablet || '' !== $dropdown_fs_mobile ) {
			$vars['--fg-filter-dropdown-font-size'] = new Responsive_Var(
				$dropdown_fs_desktop,
				$dropdown_fs_tablet,
				$dropdown_fs_mobile,
			);
		}

		$this->add_text_spacing_vars( $vars, '--fg-filter-dropdown', $s, 'filter_dropdown_' );

		// ---- Dropdown popover ----
		// Shared chrome on the popover panel: radius, border, separator
		// colour. Per-option-state vars only carry bg + text colour.
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-list-bg', $s['filter_dropdown_list_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-list-radius', $this->unit_val( $s['filter_dropdown_list_radius'] ?? null, 'px' ) );
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-list-border-color', $s['filter_dropdown_list_border_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-list-border-width', $this->unit_val( $s['filter_dropdown_list_border_width'] ?? null, 'px' ) );
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-option-separator-color', $s['filter_dropdown_option_separator_color'] ?? null );

		// Per-option state colours (Regular / Mouseover / Selected).
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-option-bg', $s['filter_dropdown_option_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-option-color', $s['filter_dropdown_option_color'] ?? null );

		$this->maybe_add_var( $vars, '--fg-filter-dropdown-option-hover-bg', $s['filter_dropdown_option_hover_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-option-hover-color', $s['filter_dropdown_option_hover_color'] ?? null );

		$this->maybe_add_var( $vars, '--fg-filter-dropdown-option-selected-bg', $s['filter_dropdown_option_selected_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-dropdown-option-selected-color', $s['filter_dropdown_option_selected_color'] ?? null );

		// ---- Checkbox shape ----
		$this->maybe_add_var( $vars, '--fg-filter-cb-size', $this->unit_val( $s['filter_cb_size'] ?? null, 'px' ) );
		$this->maybe_add_var( $vars, '--fg-filter-cb-radius', $this->unit_val( $s['filter_cb_radius'] ?? null, 'px' ) );
		$this->maybe_add_var( $vars, '--fg-filter-cb-gap', $this->unit_val( $s['filter_cb_gap'] ?? null, 'px' ) );

		// ---- Checkbox label typography ----
		$cb_resolver    = Font_Resolver::instance();
		$cb_font_family = $cb_resolver->resolve_font_family( $s['filter_cb_font_family'] ?? null, $render_context );
		if ( '' !== $cb_font_family ) {
			$vars['--fg-filter-cb-font-family'] = $cb_font_family;
		}
		$cb_font_weight = $cb_resolver->resolve_font_weight( $s['filter_cb_font_weight'] ?? null, $render_context );
		if ( '' !== $cb_font_weight ) {
			$vars['--fg-filter-cb-font-weight'] = $cb_font_weight;
		}
		$cb_font_style = $cb_resolver->resolve_font_style( $s['filter_cb_font_style'] ?? null, $render_context );
		if ( '' !== $cb_font_style ) {
			$vars['--fg-filter-cb-font-style'] = $cb_font_style;
		}
		$cb_font_size  = $s['filter_cb_font_size'] ?? null;
		$cb_fs_desktop = $this->resolve_responsive_value( $cb_font_size, 'desktop', 'px' );
		$cb_fs_tablet  = $this->resolve_responsive_value( $cb_font_size, 'tablet', 'px' );
		$cb_fs_mobile  = $this->resolve_responsive_value( $cb_font_size, 'mobile', 'px' );
		if ( '' !== $cb_fs_desktop || '' !== $cb_fs_tablet || '' !== $cb_fs_mobile ) {
			$vars['--fg-filter-cb-font-size'] = new Responsive_Var(
				$cb_fs_desktop,
				$cb_fs_tablet,
				$cb_fs_mobile,
			);
		}

		$this->add_text_spacing_vars( $vars, '--fg-filter-cb', $s, 'filter_cb_' );

		// ---- Checkbox colors ----
		// Shared border width + per-state checkbox colours. The SCSS
		// composes `border` from --fg-filter-cb-border-width + the
		// state's --fg-filter-cb[-checked]-border-color.
		$this->maybe_add_var( $vars, '--fg-filter-cb-border-width', $this->unit_val( $s['filter_cb_border_width'] ?? null, 'px' ) );

		// Unchecked - no checkmark renders, so no checkmark var.
		$this->maybe_add_var( $vars, '--fg-filter-cb-bg', $s['filter_cb_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-cb-border-color', $s['filter_cb_border_color'] ?? null );

		// Mouseover - shows a semi-transparent checkmark to preview the
		// checked state.
		$this->maybe_add_var( $vars, '--fg-filter-cb-hover-bg', $s['filter_cb_hover_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-cb-hover-border-color', $s['filter_cb_hover_border_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-cb-hover-checkmark-color', $s['filter_cb_hover_checkmark_color'] ?? null );

		// Checked - filled box + tick.
		$this->maybe_add_var( $vars, '--fg-filter-cb-checked-bg', $s['filter_cb_checked_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-cb-checked-border-color', $s['filter_cb_checked_border_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-cb-checked-checkmark-color', $s['filter_cb_checked_checkmark_color'] ?? null );

		// ---- Count badge ----
		// Per-state colours mirror the surrounding button so the badge
		// tracks the button's hover / active state. The SCSS scopes
		// .fg-filter-count under :hover and .fg-is-active.
		$this->maybe_add_var( $vars, '--fg-filter-count-bg', $s['filter_count_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-count-color', $s['filter_count_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-count-hover-bg', $s['filter_count_hover_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-count-hover-color', $s['filter_count_hover_color'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-count-active-bg', $s['filter_count_active_bg'] ?? null );
		$this->maybe_add_var( $vars, '--fg-filter-count-active-color', $s['filter_count_active_color'] ?? null );

		// filter_count_font_size is a responsive_range with per-side units
		// (px / em / rem). resolve_responsive_value() reads the stored unit
		// off each breakpoint's {value, unit} object and falls back to px
		// when the user hasn't picked one.
		$count_font         = $s['filter_count_font_size'] ?? null;
		$desktop_count_font = $this->resolve_responsive_value( $count_font, 'desktop', 'px' );
		$tablet_count_font  = $this->resolve_responsive_value( $count_font, 'tablet', 'px' );
		$mobile_count_font  = $this->resolve_responsive_value( $count_font, 'mobile', 'px' );

		if ( '' !== $desktop_count_font || '' !== $tablet_count_font || '' !== $mobile_count_font ) {
			$vars['--fg-filter-count-font-size'] = new Responsive_Var(
				$desktop_count_font,
				$tablet_count_font,
				$mobile_count_font,
			);
		}

		$this->maybe_add_var( $vars, '--fg-filter-count-radius', $this->unit_val( $s['filter_count_radius'] ?? null, 'px' ) );

		// filter_count_padding is a responsive four-sided setting. Same
		// shape as filter_btn_padding - resolves to a CSS shorthand string
		// per breakpoint, emitted as a Responsive_Var.
		$count_padding     = $s['filter_count_padding'] ?? null;
		$desktop_count_pad = $this->resolve_four_sided_value( $count_padding, 'desktop', 'px' );
		$tablet_count_pad  = $this->resolve_four_sided_value( $count_padding, 'tablet', 'px' );
		$mobile_count_pad  = $this->resolve_four_sided_value( $count_padding, 'mobile', 'px' );

		if ( '' !== $desktop_count_pad || '' !== $tablet_count_pad || '' !== $mobile_count_pad ) {
			$vars['--fg-filter-count-padding'] = new Responsive_Var(
				$desktop_count_pad,
				$tablet_count_pad,
				$mobile_count_pad,
			);
		}

		return $vars;
	}

	/**
	 * Declares the filter CSS and JS assets.
	 *
	 * @since  1.0.0
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-filter-ui' => new Asset_Decl(
					'../../assets/css/filter-ui-styles.css',
					array(),
					false,
				),
			),
			array(
				'fotogrids-filter-ui' => new Asset_Decl(
					'../../assets/js/filter-ui.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}

	/**
	 * Renders the "All" reset control (a button for buttons/checkboxes style,
	 * or a first <option> for dropdowns - emitted at the wrapper level since
	 * dropdowns have their own group-level "all" option).
	 *
	 * For the buttons and checkboxes styles an "All" button always appears
	 * first and is active by default. For dropdowns the "All" state is
	 * represented by "no option selected" - the select has no default option
	 * and the JS treats an empty value as "show all". We still render a
	 * standalone "All" reset button outside the groups for parity.
	 *
	 * @since  1.0.0
	 */
	/**
	 * Renders the "Filters" toggle button shown when filter_display_mode is
	 * 'toggle'. Clicking it expands/collapses the filter bar.
	 *
	 * The button lives outside .fotogrids-filters so it stays visible while
	 * the bar itself is hidden. JS wires the click handler in
	 * initializeFilters(); CSS hides .fotogrids-filters when it carries
	 * data-fg-filter-collapsed="true".
	 *
	 * @since 1.0.0
	 */
	private function render_toggle_button(): string {
		$label = esc_html__( 'Filters', 'fotogrids' );

		return sprintf(
			'<button class="fg-filter-toggle" type="button"'
			. ' data-fg-filter-toggle="true" aria-expanded="false"'
			. ' aria-label="%s">'
			. '<span class="fg-filter-toggle-label">%s</span>'
			. '<svg class="fg-filter-toggle-icon" width="12" height="12" viewBox="0 0 12 12"'
			. ' aria-hidden="true" focusable="false">'
			. '<path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"'
			. ' stroke-linecap="round" stroke-linejoin="round"/>'
			. '</svg>'
			. '</button>',
			esc_attr__( 'Toggle filters', 'fotogrids' ),
			$label
		);
	}

	private function render_all_control( string $style, string $all_label ): string {
		if ( 'dropdowns' === $style ) {
			// For dropdowns the "All" action is a standalone reset button that
			// clears all <select> elements back to their default state.
			return sprintf(
				'<button class="fg-filter-all fg-filter-reset" type="button" data-fg-filter-all="true" aria-pressed="true">%s</button>',
				esc_html( $all_label )
			);
		}

		// Buttons and checkboxes: standard "All" toggle button.
		return sprintf(
			'<button class="fg-filter-all fg-is-active" type="button" data-fg-filter-all="true" aria-pressed="true">%s</button>',
			esc_html( $all_label )
		);
	}

	/**
	 * Renders a button group for one filter source.
	 *
	 * @since  1.0.0
	 * @param  array<int, Filter_Option> $options
	 */
	private function render_buttons( array $options, bool $show_count ): string {
		$html = '<div class="fg-filter-buttons" role="group">';

		foreach ( $options as $option ) {
			$count_html = $show_count
				? sprintf( '<span class="fg-filter-count" aria-hidden="true">%d</span>', $option->count )
				: '';

			$html .= sprintf(
				'<button class="fg-filter-btn" type="button" data-fg-filter="%s" aria-pressed="false">%s%s</button>',
				esc_attr( $option->value ),
				esc_html( $option->label ),
				$count_html
			);
		}

		$html .= '</div>';

		return $html;
	}

	/**
	 * Renders a custom dropdown for one filter source.
	 *
	 * Uses a button trigger + popover list pattern. No native <select> - fully
	 * themeable and consistent across operating systems.
	 *
	 * @since  1.0.0
	 * @param  array<int, Filter_Option> $options
	 */
	private function render_dropdown( string $group_id, string $group_label, array $options, bool $show_count ): string {
		$trigger_id = $group_id . '-trigger';
		$list_id    = $group_id . '-list';
		$all_label  = esc_html__( 'All', 'fotogrids' );

		// Label
		$html = sprintf(
			'<span class="fg-filter-label" id="%s-label">%s</span>',
			esc_attr( $group_id ),
			esc_html( $group_label )
		);

		// Trigger button - shows the currently-selected value. The caret
		// SVG mirrors fg-filter-toggle-icon so the two chrome elements
		// look consistent; it rotates 180deg when aria-expanded is true.
		$html .= sprintf(
			'<div class="fg-filter-dropdown" data-fg-filter-dropdown="%s">'
			. '<button class="fg-filter-dropdown-trigger" type="button" id="%s"'
			. ' aria-haspopup="listbox" aria-expanded="false" aria-labelledby="%s-label %s">'
			. '<span class="fg-filter-dropdown-value">%s</span>'
			. '<svg class="fg-filter-dropdown-caret" width="12" height="12" viewBox="0 0 12 12"'
			. ' aria-hidden="true" focusable="false">'
			. '<path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"'
			. ' stroke-linecap="round" stroke-linejoin="round"/>'
			. '</svg>'
			. '</button>',
			esc_attr( $group_id ),
			esc_attr( $trigger_id ),
			esc_attr( $group_id ),
			esc_attr( $trigger_id ),
			$all_label
		);

		// Option list
		$html .= sprintf(
			'<ul class="fg-filter-dropdown-list" id="%s" role="listbox" aria-labelledby="%s-label" tabindex="-1">',
			esc_attr( $list_id ),
			esc_attr( $group_id )
		);

		// "All" option - value "" resets this source
		$html .= sprintf(
			'<li class="fg-filter-dropdown-option fg-is-active" role="option" aria-selected="true"'
			. ' data-fg-filter="" tabindex="0">%s</li>',
			$all_label
		);

		foreach ( $options as $option ) {
			$count_html = $show_count
				? sprintf( '<span class="fg-filter-count" aria-hidden="true">%d</span>', $option->count )
				: '';

			$html .= sprintf(
				'<li class="fg-filter-dropdown-option" role="option" aria-selected="false"'
				. ' data-fg-filter="%s" tabindex="0">%s%s</li>',
				esc_attr( $option->value ),
				esc_html( $option->label ),
				$count_html
			);
		}

		$html .= '</ul>'; // .fg-filter-dropdown-list
		$html .= '</div>'; // .fg-filter-dropdown

		return $html;
	}

	/**
	 * Renders a checkbox list for one filter source.
	 *
	 * @since  1.0.0
	 * @param  array<int, Filter_Option> $options
	 */
	private function render_checkboxes( string $group_id, string $group_label, array $options, bool $show_count ): string {
		$html = sprintf(
			'<fieldset class="fg-filter-fieldset"><legend class="fg-filter-legend">%s</legend>',
			esc_html( $group_label )
		);

		foreach ( $options as $index => $option ) {
			$input_id   = $group_id . '-' . $index;
			$count_html = $show_count
				? sprintf( '<span class="fg-filter-count" aria-hidden="true">%d</span>', $option->count )
				: '';

			$html .= sprintf(
				'<label class="fg-filter-checkbox-label" for="%s">'
				. '<input class="fg-filter-checkbox" id="%s" type="checkbox" value="%s" data-fg-filter="%s">'
				. '%s%s'
				. '</label>',
				esc_attr( $input_id ),
				esc_attr( $input_id ),
				esc_attr( $option->value ),
				esc_attr( $option->value ),
				esc_html( $option->label ),
				$count_html
			);
		}

		$html .= '</fieldset>';

		return $html;
	}

	private function resolve_style( Render_Context $render_context ): string {
		$style = $render_context->settings['filter_ui_style'] ?? 'buttons';

		return in_array( $style, self::ALLOWED_STYLES, true ) ? (string) $style : 'buttons';
	}

	private function resolve_position( Render_Context $render_context ): string {
		$position = $render_context->settings['filter_ui_position'] ?? 'top';

		return in_array( $position, self::ALLOWED_POSITIONS, true ) ? (string) $position : 'top';
	}

	private function resolve_sidebar_side( Render_Context $render_context ): string {
		$side = $render_context->settings['filter_sidebar_side'] ?? 'left';

		return in_array( $side, self::ALLOWED_SIDEBAR_SIDES, true ) ? (string) $side : 'left';
	}

	private function resolve_display_mode( Render_Context $render_context ): string {
		// Sidebar position has no room for a collapse/expand affordance and
		// the bar is meant to live alongside the gallery permanently - force
		// 'always' so the toggle UI is never rendered or referenced in that
		// layout, regardless of what filter_display_mode is set to.
		if ( $this->resolve_position( $render_context ) === 'sidebar' ) {
			return 'always';
		}

		$mode = $render_context->settings['filter_display_mode'] ?? 'toggle';

		return in_array( $mode, self::ALLOWED_DISPLAY_MODES, true ) ? (string) $mode : 'toggle';
	}

	/**
	 * Whether the visitor may select multiple options within a single source.
	 *
	 * Drives JS behaviour for the buttons and checkboxes styles - when false
	 * they act like a radio group (selecting a value replaces any previously
	 * active value for that source). Dropdowns are inherently single-select
	 * and ignore this setting.
	 *
	 * @since 1.0.0
	 */
	private function resolve_multiple( Render_Context $render_context ): bool {
		return (bool) ( $render_context->settings['filtering_multiple_enabled'] ?? true );
	}

	/**
	 * Where the reset button sits inside .fg-filter__wrapper. 'start'
	 * (default) places it before the groups; 'end' flips it to the
	 * far edge via flex order in SCSS.
	 *
	 * @since 1.0.0
	 */
	private function resolve_reset_position( Render_Context $render_context ): string {
		$position = $render_context->settings['filter_reset_btn_position'] ?? 'start';

		return in_array( $position, array( 'start', 'end' ), true ) ? (string) $position : 'start';
	}

	private function resolve_reset_label( Render_Context $render_context ): string {
		$label = $render_context->settings['filter_reset_btn_label'] ?? '';

		if ( is_string( $label ) && '' !== $label ) {
			return sanitize_text_field( $label );
		}

		return __( 'All', 'fotogrids' );
	}

	/**
	 * Adds a CSS variable to $vars only if the value is a non-empty string.
	 *
	 * @since  1.0.0
	 * @param  array<string, string> &$vars Reference to CSS vars array.
	 * @param  string                $key   Variable name (including -- prefix).
	 * @param  mixed                 $value Raw setting value.
	 */
	private function maybe_add_var( array &$vars, string $key, $value ): void {
		if ( is_string( $value ) && '' !== $value ) {
			$vars[ $key ] = $value;
		}
	}

	/**
	 * Converts a raw numeric-or-string setting value into a CSS value with a
	 * unit suffix, but only when the value is set and non-empty.
	 *
	 * - If $value is already a string that looks like it has a unit (contains
	 *   any non-digit character) it is returned as-is.
	 * - If $value is numeric (int, float, or a numeric string) the $unit is
	 *   appended.
	 * - Otherwise null is returned and maybe_add_var() will skip the variable.
	 *
	 * @since  1.0.0
	 * @param  mixed  $value Raw setting value from Render_Context::settings.
	 * @param  string $unit  Default unit to append (e.g. 'px', 'rem', 'em').
	 * @return string|null
	 */
	private function unit_val( $value, string $unit ): ?string {
		if ( null === $value || '' === $value ) {
			return null;
		}

		if ( is_numeric( $value ) ) {
			return $value . $unit;
		}

		if ( is_string( $value ) ) {
			// Already has a unit - return as-is.
			return $value;
		}

		return null;
	}
}
