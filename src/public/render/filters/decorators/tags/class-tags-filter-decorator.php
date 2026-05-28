<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Decorators\Tags;

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Tags filter decorator.
 *
 * Stamps a space-separated list of tag slugs onto each item as the
 * `data-fg-tags` attribute. The JS filter engine reads this attribute to
 * determine which items match an active tag filter.
 *
 * Active when:
 *   - filtering_enabled is truthy
 *   - filter_by (token_select) contains 'tags'
 *
 * Uses a single batch SELECT against fotogrids_item_metadata + fotogrids_tags
 * for all items in the gallery - no N+1.
 *
 * @package FotoGrids\Render\Filters\Decorators\Tags
 * @since   1.0.0
 */
final class Tags_Filter_Decorator implements Decorator {

    public function id(): string {
        return 'fotogrids/decorator/filter-tags';
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
     * Active when filtering is enabled and 'tags' is selected in filter_by.
     *
     * @since  1.0.0
     */
    public function supports( Render_Context $render_context ): bool {
        // Albums filter galleries, not attachments — tag metadata
        // doesn't apply.
        if ( $render_context->meta->collection_kind === Collection_Kind::ALBUM ) {
            return false;
        }
        if ( ! ( $render_context->settings['filtering_enabled'] ?? false ) ) {
            return false;
        }

        $filter_by = $render_context->settings['filter_by'] ?? [];
        if ( is_string( $filter_by ) ) {
            $decoded   = json_decode( $filter_by, true );
            $filter_by = is_array( $decoded ) ? $decoded : [ $filter_by ];
        }

        return is_array( $filter_by ) && in_array( 'tags', $filter_by, true );
    }

    /**
     * Stamps data-fg-tags onto each item with its space-separated tag slugs.
     *
     * Items with no tags receive data-fg-tags="", which the JS engine treats as
     * "no tags" (never matches a tag filter, but is shown when "All" is active).
     *
     * @since  1.0.0
     * @param  array<int, Item_View> $collection_items Item values.
     * @param  Render_Context        $render_context   Render context.
     * @return array<int, Item_View>
     */
    public function decorate_items( array $collection_items, Render_Context $render_context ): array {
        if ( empty( $collection_items ) ) {
            return $collection_items;
        }

        $item_ids = array_map( static fn( Item_View $item ) => $item->id, $collection_items );
        $tag_map  = $this->batch_fetch_tags( $item_ids );

        return array_map(
            static function ( Item_View $item ) use ( $tag_map ): Item_View {
                $slugs     = $tag_map[ $item->id ] ?? [];
                $tag_value = implode( ' ', $slugs );

                return $item->with( [
                    'data_attrs' => array_merge(
                        $item->data_attrs,
                        [ 'data-fg-tags' => $tag_value ]
                    ),
                ] );
            },
            $collection_items
        );
    }

    /**
     * No wrapper-level data attributes needed.
     *
     * @since  1.0.0
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [];
    }

    /**
     * No CSS variables needed.
     *
     * @since  1.0.0
     */
    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    /**
     * No additional assets required.
     *
     * @since  1.0.0
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Fetches tag slugs for all given attachment IDs in a single query.
     *
     * @since  1.0.0
     * @param  array<int, int> $item_ids Attachment IDs.
     * @return array<int, array<int, string>> Map of attachment_id → [ slug, … ]
     */
    private function batch_fetch_tags( array $item_ids ): array {
        if ( empty( $item_ids ) ) {
            return [];
        }

        global $wpdb;

        $placeholders = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT im.attachment_id, t.slug
                 FROM {$wpdb->prefix}fotogrids_item_metadata im
                 INNER JOIN {$wpdb->prefix}fotogrids_tags t
                     ON t.id = im.metadata_id AND t.type = 'tag'
                 WHERE im.metadata_type = 'tag'
                   AND im.attachment_id IN ($placeholders)
                 ORDER BY t.name ASC",
                ...$item_ids
            ),
            ARRAY_A
        );
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        if ( empty( $rows ) ) {
            return [];
        }

        $tag_map = [];
        foreach ( $rows as $row ) {
            $attachment_id              = (int) $row['attachment_id'];
            $tag_map[ $attachment_id ][] = sanitize_html_class( (string) $row['slug'] );
        }

        return $tag_map;
    }
}
