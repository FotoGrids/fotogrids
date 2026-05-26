<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Contract for render sorter modules.
 *
 * A sorter reorders the list of attachment IDs before items are hydrated.
 * Working at the ID level keeps the sorter decoupled from Item_View and
 * lets implementations issue whatever DB queries they need (wp_posts,
 * fotogrids_item_metadata, external APIs, etc.) without affecting hydration.
 *
 * Only one sorter is active per render (the registry picks the highest-
 * precedence module whose supports() returns true). Pro sorters can displace
 * a Free one by returning the Free sorter's id() from replaces().
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Sorter {

    /**
     * Unique sorter identifier, e.g. 'fotogrids/sort/date'.
     *
     * @since   1.0.0
     * @return  string
     */
    public function id(): string;

    /**
     * Plugin origin slug, e.g. 'fotogrids' or 'fotogrids-pro'.
     *
     * Used by Module_Registry to establish precedence order.
     *
     * @since   1.0.0
     * @return  string
     */
    public function origin(): string;

    /**
     * ID of a Free sorter this module displaces, or null.
     *
     * When set, the named sorter is removed from the active list even if its
     * own supports() returns true. This is the standard Pro-replaces-Free
     * extension mechanism shared across all module types.
     *
     * @since   1.0.0
     * @return  string|null
     */
    public function replaces(): ?string;

    /**
     * ID of the sorter this module logically extends, or null.
     *
     * Informational only - used by tooling and the admin UI to group related
     * sorters. Has no effect on pipeline execution.
     *
     * @since   1.0.0
     * @return  string|null
     */
    public function extends_id(): ?string;

    /**
     * Returns true when this sorter should be active for the given context.
     *
     * Typically checks $render_context->settings['default_sort_order'] (and
     * sub-settings) to decide whether to activate. For preview renders
     * (is_preview = true) most sorters should return false so the admin live
     * preview always shows the manually arranged order.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  bool
     */
    public function supports( Render_Context $render_context ): bool;

    /**
     * Reorder the attachment IDs and return the sorted list.
     *
     * The method receives the gallery's manually arranged IDs. It may issue
     * its own DB queries, call external services, or apply any logic needed.
     * It must return the same IDs (values), possibly in a different order.
     * Keys should be reset (array_values).
     *
     * @since   1.0.0
     * @param   array<int, int> $item_ids       Attachment IDs in manual order.
     * @param   Render_Context  $render_context Full render context (settings, meta, etc.).
     * @return  array<int, int>                 Sorted attachment IDs, keys reset.
     */
    public function sort( array $item_ids, Render_Context $render_context ): array;

    /**
     * Assets (CSS/JS) this sorter needs enqueued on the page.
     *
     * Most sorters return an empty Module_Assets. Frontend sort-controls
     * (a Pro feature) would return JS here.
     *
     * @since   1.0.0
     * @param   Render_Context $render_context Render context.
     * @return  Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets;
}
