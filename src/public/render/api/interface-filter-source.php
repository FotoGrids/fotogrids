<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Contract for filter source modules.
 *
 * A filter source contributes one set of filterable options (e.g. "Tags",
 * "Date", "People") to the filter bar. The Filter_UI feature reads all active
 * filter sources and renders one filter group per source.
 *
 * Each source is responsible for:
 *  - declaring which data attribute it stamps on items (via item_data_attr_key)
 *  - returning the ordered list of Filter_Option values for a given gallery
 *  - declaring any JS/CSS assets it requires (usually none for Free sources)
 *
 * Registration:
 *   Module_Registry::register( 'filter_sources', My_Source::class );
 *
 * Pro sources follow the same pattern and use origin() = 'fotogrids-pro' for
 * precedence. Use replaces() to displace a Free source with a Pro upgrade.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Filter_Source {

    /**
     * Unique stable identifier for this source.
     *
     * @since   1.0.0
     * @return  string  E.g. 'fotogrids/filter/tags'
     */
    public function id(): string;

    /**
     * Origin slug used for precedence ranking in the module registry.
     *
     * @since   1.0.0
     * @return  string  'fotogrids' | 'fotogrids-pro' | vendor slug
     */
    public function origin(): string;

    /**
     * ID of another filter source this module should displace, or null.
     *
     * @since   1.0.0
     * @return  string|null
     */
    public function replaces(): ?string;

    /**
     * ID of a filter source this module augments (without replacing), or null.
     *
     * @since   1.0.0
     * @return  string|null
     */
    public function extends_id(): ?string;

    /**
     * Returns true when this source should be active for the given context.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function supports( Render_Context $render_context ): bool;

    /**
     * Human-readable label for the filter group heading.
     *
     * Used as the dropdown trigger label or the group heading in buttons/
     * checkboxes mode. Already translated - do not pass through __() again.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  string
     */
    public function group_label( Render_Context $render_context ): string;

    /**
     * The data-* attribute key stamped on each item element by the decorator.
     *
     * Must be in the form 'data-fg-<something>' and match exactly what the
     * corresponding decorator writes onto Item_View::data_attrs.
     *
     * The JS filter engine reads this key to retrieve the item's space-separated
     * token list and test it against the active filter value.
     *
     * @since   1.0.0
     * @return  string  E.g. 'data-fg-tags'
     */
    public function item_data_attr_key(): string;

    /**
     * Returns the ordered list of filter options for items in this gallery.
     *
     * Called once by Filter_UI during html_before() generation. The source must
     * only return options for items that actually exist in the current gallery
     * (i.e. intersect with the IDs in $render_context->items). Options with
     * count === 0 should be omitted.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  array<int, Filter_Option>
     */
    public function get_options( Render_Context $render_context ): array;

    /**
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets;
}
