<?php
declare(strict_types=1);

namespace FotoGrids\Render\Filters\Sources;

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Filter_Option;
use FotoGrids\Render\Api\Filter_Source;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Shared base for filter sources that key off `fotogrids_item_metadata`
 * + `fotogrids_tags` joined by `metadata_type` / `tags.type`.
 *
 * All three core sources (Tags, People, Location) share the same query
 * shape and predicate logic — only the metadata_type discriminator,
 * arg key, label, and item data attribute differ. Subclasses just
 * declare those constants; everything else lives here.
 *
 * Pro filter sources that don't fit this schema (e.g. EXIF-based filters
 * with custom storage) should implement Filter_Source directly instead
 * of extending this base.
 *
 * @package FotoGrids\Render\Filters\Sources
 * @since   1.0.0
 */
abstract class Metadata_Filter_Source implements Filter_Source {

    /**
     * Value the source contributes to the `filter_by` setting (e.g. 'tags',
     * 'people', 'location'). The Filter_UI feature exposes a token-select
     * with these values, and supports() only activates when this value is
     * present in the saved setting.
     */
    abstract protected function filter_by_token(): string;

    /**
     * Value stored in the `metadata_type` column of
     * fotogrids_item_metadata AND the `type` column of fotogrids_tags
     * for rows belonging to this source. Singular: 'tag', 'person',
     * 'location'.
     */
    abstract protected function metadata_type(): string;

    /**
     * Translated group label shown above this source's controls.
     */
    abstract protected function group_label_string(): string;

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

        return is_array( $filter_by ) && in_array( $this->filter_by_token(), $filter_by, true );
    }

    public function group_label( Render_Context $render_context ): string {
        return $this->group_label_string();
    }

    public function get_options( Render_Context $render_context ): array {
        // Query against the FULL gallery's item set, not the (possibly
        // sliced) $render_context->items. Otherwise the filter bar only
        // shows tags found on page 1, hiding tags that live on later
        // pages and giving wrong item counts.
        //
        // The unsliced IDs come from Gallery_Repository::get_item_ids().
        // For album-as-collection renders we'd want a different lookup,
        // but supports() in this base bails on albums anyway.
        $gallery_id = (int) $render_context->meta->gallery_id;
        $all_ids    = $gallery_id > 0 && class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
            ? \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id )
            : [];

        $item_ids = is_array( $all_ids )
            ? array_map( 'intval', $all_ids )
            : array_map( static fn( $item ) => (int) $item->id, $render_context->items );

        if ( empty( $item_ids ) ) {
            return [];
        }

        global $wpdb;
        $placeholders   = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );
        $metadata_type  = $this->metadata_type();

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT t.name, t.slug, COUNT(DISTINCT im.attachment_id) AS item_count
                 FROM {$wpdb->prefix}fotogrids_item_metadata im
                 INNER JOIN {$wpdb->prefix}fotogrids_tags t
                     ON t.id = im.metadata_id AND t.type = %s
                 WHERE im.metadata_type = %s
                   AND im.attachment_id IN ($placeholders)
                 GROUP BY t.id, t.name, t.slug
                 HAVING item_count > 0
                 ORDER BY t.name ASC",
                $metadata_type,
                $metadata_type,
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

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets();
    }

    public function matches( int $item_id, array $values, Render_Context $render_context ): bool {
        if ( empty( $values ) ) {
            return true;
        }

        $map   = $this->ensure_slug_map( $render_context );
        $slugs = $map[ $item_id ] ?? [];
        if ( empty( $slugs ) ) {
            return false;
        }
        foreach ( $values as $v ) {
            if ( in_array( $v, $slugs, true ) ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Per-(instance, source) cache of attachment_id → [slug, …].
     * Two different sources can be active for the same gallery, so we
     * key by both source id and instance id.
     *
     * @return array<int, array<int, string>>
     */
    private function ensure_slug_map( Render_Context $render_context ): array {
        static $cache = [];
        $cache_key = $this->id() . '@' . $render_context->meta->instance_id;

        if ( isset( $cache[ $cache_key ] ) ) {
            return $cache[ $cache_key ];
        }

        $item_ids = array_map(
            static fn( $item ) => (int) $item->id,
            $render_context->items
        );
        if ( empty( $item_ids ) ) {
            $cache[ $cache_key ] = [];
            return [];
        }

        global $wpdb;
        $placeholders  = implode( ',', array_fill( 0, count( $item_ids ), '%d' ) );
        $metadata_type = $this->metadata_type();

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT im.attachment_id, t.slug
                 FROM {$wpdb->prefix}fotogrids_item_metadata im
                 INNER JOIN {$wpdb->prefix}fotogrids_tags t
                     ON t.id = im.metadata_id AND t.type = %s
                 WHERE im.metadata_type = %s
                   AND im.attachment_id IN ($placeholders)",
                $metadata_type,
                $metadata_type,
                ...$item_ids
            ),
            ARRAY_A
        );
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        $map = [];
        if ( is_array( $rows ) ) {
            foreach ( $rows as $row ) {
                $aid = (int) $row['attachment_id'];
                $map[ $aid ][] = sanitize_html_class( (string) $row['slug'] );
            }
        }
        $cache[ $cache_key ] = $map;
        return $map;
    }
}
