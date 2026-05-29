<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Features\Ui;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Filter_Option;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
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

    /** @var array<string, string> Allowed filter_ui_style values. */
    private const ALLOWED_STYLES = [ 'buttons', 'dropdowns', 'checkboxes' ];

    /** @var array<string, string> Allowed filter_ui_position values. */
    private const ALLOWED_POSITIONS = [ 'top', 'sidebar' ];

    /** @var array<string, string> Allowed filter_sidebar_side values. */
    private const ALLOWED_SIDEBAR_SIDES = [ 'left', 'right' ];

    /** @var array<string, string> Allowed filter_display_mode values. */
    private const ALLOWED_DISPLAY_MODES = [ 'always', 'toggle' ];

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
        // galleries, not attachments — none of the filter sources have
        // anything to filter by.
        if ( $render_context->meta->collection_kind === Collection_Kind::ALBUM ) {
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

        $style        = $this->resolve_style( $render_context );
        $position     = $this->resolve_position( $render_context );
        $display_mode = $this->resolve_display_mode( $render_context );
        $all_label    = $this->resolve_all_label( $render_context );
        $show_count   = (bool) ( $render_context->settings['show_filter_count'] ?? true );

        // When toggle mode is active, the filter bar starts collapsed. The
        // toggle button lives inside .fotogrids-filters as its first child so
        // it stays visible while every other child is hidden via CSS.
        $collapsed_attr = '';
        if ( $display_mode === 'toggle' ) {
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

        if ( $display_mode === 'toggle' ) {
            $html .= $this->render_toggle_button();
        }

        // "All" control - resets all active filters.
        $html .= $this->render_all_control( $style, $all_label );

        foreach ( $sources as $source ) {
            $options = $source->get_options( $render_context );
            if ( empty( $options ) ) {
                continue;
            }

            $group_id  = 'fg-filter-group-' . esc_attr( sanitize_html_class( $source->id() ) );
            $attr_key  = esc_attr( $source->item_data_attr_key() );
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
        $attrs = [
            'data-fg-filter-ui'       => 'true',
            'data-fg-filter-style'    => $this->resolve_style( $render_context ),
            'data-fg-filter-position' => $this->resolve_position( $render_context ),
            'data-fg-filter-display'  => $this->resolve_display_mode( $render_context ),
        ];

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

        $vars = [];

        // ---- Spacing ----
        $this->maybe_add_var( $vars, '--fg-filter-wrapper-gap',    $this->unit_val( $s['filter_wrapper_gap'] ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-bar-gap',        $this->unit_val( $s['filter_bar_gap']     ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-gap',            $this->unit_val( $s['filter_gap']         ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-sidebar-width',  $this->unit_val( $s['filter_sidebar_width'] ?? null, 'px' ) );

        // ---- Button shape ----
        $this->maybe_add_var( $vars, '--fg-filter-btn-padding',   $s['filter_btn_padding']   ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-btn-radius',    $this->unit_val( $s['filter_btn_radius']   ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-btn-font-size', $this->unit_val( $s['filter_btn_font_size'] ?? null, 'rem' ) );

        // ---- Button colors ----
        $this->maybe_add_var( $vars, '--fg-filter-btn-bg',           $s['filter_btn_bg']           ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-btn-color',        $s['filter_btn_color']        ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-btn-border',       $s['filter_btn_border']       ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-btn-active-bg',    $s['filter_btn_active_bg']    ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-btn-active-color', $s['filter_btn_active_color'] ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-btn-hover-bg',     $s['filter_btn_hover_bg']     ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-btn-hover-color',  $s['filter_btn_hover_color']  ?? null );

        // ---- Dropdown trigger ----
        $this->maybe_add_var( $vars, '--fg-filter-select-padding', $s['filter_select_padding'] ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-select-radius',  $this->unit_val( $s['filter_select_radius'] ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-select-bg',      $s['filter_select_bg']      ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-select-color',   $s['filter_select_color']   ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-select-border',  $s['filter_select_border']  ?? null );

        // ---- Dropdown popover overrides (share select vars; these map 1-to-1) ----
        // filter_dropdown_list_bg   → --fg-filter-select-bg is already set above from the same var;
        // separate overrides if the user sets popover-specific values.
        $this->maybe_add_var( $vars, '--fg-filter-dropdown-list-bg',     $s['filter_dropdown_list_bg']     ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-dropdown-list-border',  $s['filter_dropdown_list_border']  ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-dropdown-list-radius',  $this->unit_val( $s['filter_dropdown_list_radius'] ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-dropdown-option-hover-bg',     $s['filter_dropdown_option_hover_bg']     ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-dropdown-option-active-color', $s['filter_dropdown_option_active_color'] ?? null );

        // ---- Checkbox shape ----
        $this->maybe_add_var( $vars, '--fg-filter-cb-size',   $this->unit_val( $s['filter_cb_size']   ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-cb-radius', $this->unit_val( $s['filter_cb_radius'] ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-cb-gap',    $this->unit_val( $s['filter_cb_gap']    ?? null, 'px' ) );

        // ---- Checkbox colors ----
        $this->maybe_add_var( $vars, '--fg-filter-cb-border',               $s['filter_cb_border']               ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-cb-bg',                   $s['filter_cb_bg']                   ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-cb-checked-bg',           $s['filter_cb_checked_bg']           ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-cb-checked-border-color', $s['filter_cb_checked_border_color'] ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-cb-checkmark-color',      $s['filter_cb_checkmark_color']      ?? null );

        // ---- Count badge ----
        $this->maybe_add_var( $vars, '--fg-filter-count-color',     $s['filter_count_color']     ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-count-font-size', $this->unit_val( $s['filter_count_font_size'] ?? null, 'em' ) );
        $this->maybe_add_var( $vars, '--fg-filter-count-bg',        $s['filter_count_bg']        ?? null );
        $this->maybe_add_var( $vars, '--fg-filter-count-radius',    $this->unit_val( $s['filter_count_radius']    ?? null, 'px' ) );
        $this->maybe_add_var( $vars, '--fg-filter-count-padding',   $s['filter_count_padding']   ?? null );

        return $vars;
    }

    /**
     * Declares the filter CSS and JS assets.
     *
     * @since  1.0.0
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                'fotogrids-filter-ui' => new Asset_Decl(
                    path:      '../../assets/css/filter-ui-styles.css',
                    in_footer: false,
                ),
            ],
            js: [
                'fotogrids-filter-ui' => new Asset_Decl(
                    path:      '../../assets/js/filter-ui.js',
                    deps:      [ 'fotogrids-runtime' ],
                    in_footer: true,
                ),
            ]
        );
    }

    // -------------------------------------------------------------------------
    // Render helpers
    // -------------------------------------------------------------------------

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
        if ( $style === 'dropdowns' ) {
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
        $trigger_id  = $group_id . '-trigger';
        $list_id     = $group_id . '-list';
        $all_label   = esc_html__( 'All', 'fotogrids' );

        // Label
        $html = sprintf(
            '<span class="fg-filter-label" id="%s-label">%s</span>',
            esc_attr( $group_id ),
            esc_html( $group_label )
        );

        // Trigger button - shows the currently-selected value
        $html .= sprintf(
            '<div class="fg-filter-dropdown" data-fg-filter-dropdown="%s">'
            . '<button class="fg-filter-dropdown-trigger" type="button" id="%s"'
            . ' aria-haspopup="listbox" aria-expanded="false" aria-labelledby="%s-label %s">'
            . '<span class="fg-filter-dropdown-value">%s</span>'
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
        $html  = sprintf(
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

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

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
        $mode = $render_context->settings['filter_display_mode'] ?? 'toggle';

        return in_array( $mode, self::ALLOWED_DISPLAY_MODES, true ) ? (string) $mode : 'toggle';
    }

    private function resolve_all_label( Render_Context $render_context ): string {
        $label = $render_context->settings['filter_all_label'] ?? '';

        if ( is_string( $label ) && $label !== '' ) {
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
    private function maybe_add_var( array &$vars, string $key, mixed $value ): void {
        if ( is_string( $value ) && $value !== '' ) {
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
    private function unit_val( mixed $value, string $unit ): ?string {
        if ( $value === null || $value === '' ) {
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
