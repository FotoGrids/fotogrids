<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Single source of truth for the filtered + sorted item sequence of a gallery.
 *
 * Both Context_Builder (which feeds the visible grid render) and
 * Lightbox_Slides_Data (which feeds the lightbox slide cache) route
 * through this so the sequence the user clicks in the grid matches the
 * sequence they navigate in the lightbox — exactly.
 *
 * The sequence is the ordered list of attachment IDs after:
 *   1. Sorter applied (Random, Date, Title, Filename, Manual, Pro sorters).
 *   2. Server-side filters applied (Tags, People, Location, Pro sources).
 *
 * Pagination slicing is NOT applied here — callers slice the result
 * themselves with whatever (offset, limit) they need.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Gallery_Item_Sequence {

    /**
     * Returns the filtered+sorted item ID list for a gallery.
     *
     * @since 1.0.0
     * @param int                                $gallery_id
     * @param array<string, mixed>               $settings        Resolved gallery settings.
     * @param int|null                           $random_seed     Seed for Random_Sorter; null = unseeded.
     * @param array<string, array<int, string>>  $active_filters  Filter REST arg map.
     * @return array<int, int>                                    Ordered attachment IDs.
     */
    public static function resolve(
        int $gallery_id,
        array $settings,
        ?int $random_seed = null,
        array $active_filters = []
    ): array {
        $raw_ids = self::raw_ids( $gallery_id );
        if ( empty( $raw_ids ) ) {
            return [];
        }

        $context = self::build_stub_context( $gallery_id, $settings, $random_seed, $active_filters, $raw_ids );

        // 1. Sort.
        $sorted_ids = self::apply_sorter( $raw_ids, $context );

        // 2. Filter.
        if ( empty( $active_filters ) ) {
            return $sorted_ids;
        }

        return self::apply_filters( $sorted_ids, $active_filters, $context );
    }

    /**
     * Returns the count of the filtered+sorted sequence — the number of
     * items the lightbox should advertise as `total`, and the count
     * `/gallery/render` reports as `total_pages * page_size`-roof.
     *
     * Sorting is a no-op for counts (count(filtered) === count(sorted+filtered)),
     * so this skips the sort step.
     *
     * @since 1.0.0
     * @param int                                $gallery_id
     * @param array<string, mixed>               $settings
     * @param array<string, array<int, string>>  $active_filters
     * @return int
     */
    public static function count(
        int $gallery_id,
        array $settings,
        array $active_filters = []
    ): int {
        $raw_ids = self::raw_ids( $gallery_id );
        if ( empty( $raw_ids ) ) {
            return 0;
        }

        if ( empty( $active_filters ) ) {
            return count( $raw_ids );
        }

        $context = self::build_stub_context( $gallery_id, $settings, null, $active_filters, $raw_ids );

        return count( self::apply_filters( $raw_ids, $active_filters, $context ) );
    }

    /**
     * @return array<int, int>
     */
    private static function raw_ids( int $gallery_id ): array {
        if ( ! class_exists( '\FotoGrids\Galleries\Gallery_Repository' ) ) {
            return [];
        }
        $raw = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
        return is_array( $raw ) ? array_values( array_map( 'absint', $raw ) ) : [];
    }

    /**
     * Builds a Render_Context shell suitable for sorter + filter_source
     * supports() / sort() / matches() calls. Items are stub Item_Views with
     * only the id field populated — none of the predicates we run need
     * image URLs or captions.
     *
     * @param array<int, int>                    $ids
     * @param array<string, array<int, string>>  $active_filters
     */
    private static function build_stub_context(
        int $gallery_id,
        array $settings,
        ?int $random_seed,
        array $active_filters,
        array $ids
    ): Render_Context {
        $stub_items = array_map(
            static function ( int $id ): Item_View {
                return new Item_View(
                    id:          $id,
                    thumb_url:   '',
                    full_url:    '',
                    alt:         '',
                    title:       '',
                    caption:     '',
                    description: '',
                    meta:        [],
                );
            },
            $ids
        );

        $meta = new Render_Meta(
            gallery_id:      $gallery_id,
            album_id:        null,
            instance_id:     'fg-' . $gallery_id . '-seq',
            source:          Request_Source::SHORTCODE,
            is_preview:      false,
            mode:            Render_Mode::INITIAL,
            schema_version:  2,
            collection_kind: Collection_Kind::GALLERY,
            random_seed:     $random_seed,
            active_filters:  $active_filters,
        );

        $layout = new Render_Layout(
            layout_id:          is_string( $settings['layout'] ?? null ) ? $settings['layout'] : 'grid',
            columns_mode:       Columns_Mode::FIXED,
            responsive_columns: [],
            responsive_spacing: [],
            columns_auto_range: []
        );

        $behavior = new Render_Behavior(
            click_behavior:    is_string( $settings['item_click_behavior'] ?? null ) ? $settings['item_click_behavior'] : 'lightbox',
            pagination_type:   is_string( $settings['pagination_type'] ?? null )     ? $settings['pagination_type']     : 'show_all',
            pagination_method: is_string( $settings['pagination_method'] ?? null )   ? $settings['pagination_method']   : 'load_more',
            hover_effect:      null
        );

        return new Render_Context(
            meta:     $meta,
            layout:   $layout,
            behavior: $behavior,
            settings: $settings,
            items:    $stub_items,
            warnings: []
        );
    }

    /**
     * Mirrors Context_Builder::apply_sorter. Picks the first active
     * sorter (registry returns them in origin-precedence order) and
     * runs sort() on the IDs. Falls back to input order when no sorter
     * is active.
     *
     * @param array<int, int>  $item_ids
     * @return array<int, int>
     */
    private static function apply_sorter( array $item_ids, Render_Context $context ): array {
        $active = Module_Registry::active_modules( 'sorters', $context );
        $sorter = $active[0] ?? null;
        if ( $sorter === null ) {
            return $item_ids;
        }
        $sorted = $sorter->sort( $item_ids, $context );
        return is_array( $sorted ) ? array_values( $sorted ) : $item_ids;
    }

    /**
     * Mirrors Context_Builder::apply_server_filters but at the ID level
     * (no Item_View hydration). AND across sources, OR within source.
     *
     * @param array<int, int>                    $ids
     * @param array<string, array<int, string>>  $active_filters
     * @return array<int, int>
     */
    private static function apply_filters( array $ids, array $active_filters, Render_Context $context ): array {
        $sources = Module_Registry::active_modules( 'filter_sources', $context );
        if ( empty( $sources ) ) {
            return $ids;
        }

        $source_predicates = [];
        foreach ( $sources as $source ) {
            $arg_key = $source->filter_arg_key();
            $values  = $active_filters[ $arg_key ] ?? null;
            if ( ! is_array( $values ) || empty( $values ) ) {
                continue;
            }
            $source_predicates[] = [
                'source' => $source,
                'values' => array_values( array_map( 'strval', $values ) ),
            ];
        }
        if ( empty( $source_predicates ) ) {
            return $ids;
        }

        $filtered = [];
        foreach ( $ids as $id ) {
            $passes = true;
            foreach ( $source_predicates as $entry ) {
                if ( ! $entry['source']->matches( $id, $entry['values'], $context ) ) {
                    $passes = false;
                    break;
                }
            }
            if ( $passes ) {
                $filtered[] = $id;
            }
        }
        return $filtered;
    }
}
