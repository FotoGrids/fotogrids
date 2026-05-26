<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Sources\People;

use FotoGrids\Render\Api\Filter_Option;
use FotoGrids\Render\Api\Filter_Source;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * People filter source.
 *
 * Provides one Filter_Option per person tag that is assigned to at least one
 * item in the current gallery. Options are ordered alphabetically by name.
 *
 * Active when:
 *   - filtering_enabled is truthy
 *   - filter_by (token_select) contains 'people'
 *
 * @package FotoGrids\Render\Filters\Sources\People
 * @since   1.0.0
 */
final class People_Filter_Source implements Filter_Source {

    public function id(): string {
        return 'fotogrids/filter/people';
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
     * @since  1.0.0
     */
    public function supports( Render_Context $render_context ): bool {
        if ( ! ( $render_context->settings['filtering_enabled'] ?? false ) ) {
            return false;
        }

        $filter_by = $render_context->settings['filter_by'] ?? [];
        if ( is_string( $filter_by ) ) {
            $decoded   = json_decode( $filter_by, true );
            $filter_by = is_array( $decoded ) ? $decoded : [ $filter_by ];
        }

        return is_array( $filter_by ) && in_array( 'people', $filter_by, true );
    }

    /**
     * @since  1.0.0
     */
    public function group_label( Render_Context $render_context ): string {
        return __( 'People', 'fotogrids' );
    }

    /**
     * @since  1.0.0
     */
    public function item_data_attr_key(): string {
        return 'data-fg-people';
    }

    /**
     * Returns person options with item counts for the current gallery.
     *
     * @since  1.0.0
     */
    public function get_options( Render_Context $render_context ): array {
        $item_ids = array_map(
            static fn( $item ) => $item->id,
            $render_context->items
        );

        if ( empty( $item_ids ) ) {
            return [];
        }

        global $wpdb;

        $placeholders = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT t.name, t.slug, COUNT(DISTINCT im.attachment_id) AS item_count
                 FROM {$wpdb->prefix}fotogrids_item_metadata im
                 INNER JOIN {$wpdb->prefix}fotogrids_tags t
                     ON t.id = im.metadata_id AND t.type = 'person'
                 WHERE im.metadata_type = 'person'
                   AND im.attachment_id IN ($placeholders)
                 GROUP BY t.id, t.name, t.slug
                 HAVING item_count > 0
                 ORDER BY t.name ASC",
                ...$item_ids
            ),
            ARRAY_A
        );
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        if ( empty( $rows ) ) {
            return [];
        }

        $options = [];
        foreach ( $rows as $row ) {
            $options[] = new Filter_Option(
                value: (string) $row['slug'],
                label: (string) $row['name'],
                count: (int) $row['item_count'],
            );
        }

        return $options;
    }

    /**
     * @since  1.0.0
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets();
    }
}
