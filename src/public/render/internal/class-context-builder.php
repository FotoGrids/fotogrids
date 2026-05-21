<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Image_Size_Manager;
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
 * Builds render contexts for public and preview renders.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Context_Builder {

    /**
     * @param callable|null $items_loader Callback for item hydration.
     */
    public function __construct(
        private readonly Instance_Id_Factory $instance_id_factory,
        private readonly mixed $items_loader = null,
    ) {}

    /**
     * Creates a context for public rendering.
     *
     * @since   1.0.0
     * @param   int                  $gallery_id Gallery identifier.
     * @param   array<string, mixed> $render_settings Normalized settings.
     * @param   array<int, mixed>    $collection_item_ids Item IDs.
     * @param   Request_Source       $source Request source.
     * @param   int|null             $album_id Album identifier.
     * @return  Render_Context
     */
    public function build_for_public(
        int $gallery_id,
        array $render_settings = [],
        array $collection_item_ids = [],
        Request_Source $source = Request_Source::SHORTCODE,
        ?int $album_id = null
    ): Render_Context {
        $render_meta = new Render_Meta(
            gallery_id: $gallery_id,
            album_id: $album_id,
            instance_id: $this->instance_id_factory->generate( $gallery_id ),
            source: $source,
            is_preview: false,
            mode: Render_Mode::INITIAL,
            schema_version: 2
        );

        [ $thumb_size, $full_size ] = $this->resolve_size_settings( $render_settings );

        return new Render_Context(
            meta: $render_meta,
            layout: $this->build_layout( $render_settings ),
            behavior: $this->build_behavior( $render_settings ),
            settings: $render_settings,
            items: $this->load_items( $collection_item_ids, $thumb_size, $full_size ),
            warnings: []
        );
    }

    /**
     * Creates a context for preview rendering.
     *
     * @since   1.0.0
     * @param   int                  $gallery_id Gallery identifier.
     * @param   array<string, mixed> $base_settings Base settings.
     * @param   array<string, mixed> $settings_overlay Overlay settings.
     * @param   array<int, mixed>    $collection_item_ids Ordered item IDs.
     * @param   array<int|string, array<string, mixed>> $item_overrides Per-item overrides keyed by attachment ID.
     * @param   string|null          $simulate_state Simulated gate state.
     * @return  Render_Context
     */
    public function build_for_preview(
        int $gallery_id,
        array $base_settings = [],
        array $settings_overlay = [],
        array $collection_item_ids = [],
        array $item_overrides = [],
        Request_Source $source = Request_Source::PREVIEW_UNSAVED,
        ?string $simulate_state = null
    ): Render_Context {
        $render_settings = array_replace_recursive( $base_settings, $settings_overlay );
        $warnings = [];
        [ $thumb_size, $full_size ] = $this->resolve_size_settings( $render_settings );
        $collection_items = $this->load_items( $collection_item_ids, $thumb_size, $full_size );
        if ( ! empty( $item_overrides ) ) {
            $collection_items = $this->apply_item_overrides( $collection_items, $item_overrides );
        }

        if ( $simulate_state !== null && ! in_array( $simulate_state, [ 'ok', 'password_required', 'expired', 'unauthorized' ], true ) ) {
            $warnings[] = sprintf( 'Unsupported simulate_state: %s', $simulate_state );
        }

        return new Render_Context(
            meta: new Render_Meta(
                gallery_id: $gallery_id,
                album_id: null,
                instance_id: $this->instance_id_factory->generate( $gallery_id ),
                source: $source,
                is_preview: true,
                mode: Render_Mode::AJAX,
                schema_version: 2
            ),
            layout: $this->build_layout( $render_settings ),
            behavior: $this->build_behavior( $render_settings ),
            settings: $render_settings,
            items: $collection_items,
            warnings: $warnings
        );
    }

    /**
     * Returns a request-scoped builder instance for public renders.
     *
     * @since   1.0.0
     * @return  self
     */
    public static function for_public(): self {
        static $instance = null;

        if ( $instance === null ) {
            $instance = new self( Instance_Id_Factory::instance() );
        }

        return $instance;
    }

    /**
     * Returns a request-scoped builder instance for preview renders.
     *
     * @since   1.0.0
     * @return  self
     */
    public static function for_preview(): self {
        return self::for_public();
    }

    /**
     * Builds normalized layout data from settings.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $render_settings Render settings.
     * @return  Render_Layout
     */
    private function build_layout( array $render_settings ): Render_Layout {
        $layout_id = is_string( $render_settings['layout'] ?? null ) ? $render_settings['layout'] : 'grid';
        $columns_mode_value = is_string( $render_settings['columns_mode'] ?? null ) ? $render_settings['columns_mode'] : 'fixed';
        $columns_mode = $columns_mode_value === Columns_Mode::AUTO->value ? Columns_Mode::AUTO : Columns_Mode::FIXED;

        return new Render_Layout(
            layout_id: $layout_id,
            columns_mode: $columns_mode,
            responsive_columns: is_array( $render_settings['columns'] ?? null ) ? $render_settings['columns'] : [ 'desktop' => 4, 'tablet' => 3, 'mobile' => 1 ],
            responsive_spacing: is_array( $render_settings['item_spacing'] ?? null ) ? $render_settings['item_spacing'] : [
                'desktop' => [ 'value' => 10, 'unit' => 'px' ],
                'tablet' => [ 'value' => 8, 'unit' => 'px' ],
                'mobile' => [ 'value' => 5, 'unit' => 'px' ],
            ],
            columns_auto_range: is_array( $render_settings['columns_auto_range'] ?? null ) ? $render_settings['columns_auto_range'] : []
        );
    }

    /**
     * Builds normalized behavior data from settings.
     *
     * @since   1.0.0
     * @param   array<string, mixed> $render_settings Render settings.
     * @return  Render_Behavior
     */
    private function build_behavior( array $render_settings ): Render_Behavior {
        return new Render_Behavior(
            // Admin saves as 'item_click_behavior'; fall back to legacy 'click_behavior' key.
            click_behavior: is_string( $render_settings['item_click_behavior'] ?? $render_settings['click_behavior'] ?? null ) ? ( $render_settings['item_click_behavior'] ?? $render_settings['click_behavior'] ) : 'lightbox',
            pagination_type: is_string( $render_settings['pagination_type'] ?? null ) ? $render_settings['pagination_type'] : 'show_all',
            pagination_method: is_string( $render_settings['pagination_method'] ?? null ) ? $render_settings['pagination_method'] : 'load_more',
            captions_enabled: (bool) ( $render_settings['captions'] ?? true ),
            hover_effect: is_string( $render_settings['hover_effect'] ?? null ) ? $render_settings['hover_effect'] : null
        );
    }

    /**
     * Loads item view data through the configured loader callback.
     *
     * When no custom loader is provided the method performs two queries:
     *  1. Standard WP attachment data (get_post + image URLs + alt).
     *  2. A single batch SELECT on fotogrids_item_meta to pull external_url and
     *     link_target for every item at once, keyed by attachment_id.
     *
     * Both external_url and link_target are stored in Item_View::meta so
     * decorators (Direct_Link, External_Link) can read them without coupling
     * to the DB themselves.
     *
     * @since   1.0.0
     * @param   array<int, mixed> $collection_item_ids Item identifiers.
     * @param   string            $thumb_size          Resolved WP size slug for thumbnails.
     * @param   string            $full_size           Resolved WP size slug for full/lightbox images.
     * @return  array<int, \FotoGrids\Render\Api\Item_View>
     */
    private function load_items( array $collection_item_ids, string $thumb_size = 'large', string $full_size = 'full' ): array {
        if ( ! is_callable( $this->items_loader ) ) {
            $loaded_items = [];

            // Normalise IDs first so we can batch-query once.
            $valid_ids = [];
            foreach ( $collection_item_ids as $raw_id ) {
                $id = (int) $raw_id;
                if ( $id > 0 ) {
                    $valid_ids[] = $id;
                }
            }

            // Batch-fetch external_url + link_target from fotogrids_item_meta.
            // Uses gallery_id = 0 rows (global item data written by the item edit modal).
            $item_link_meta = $this->batch_load_link_meta( $valid_ids );

            foreach ( $valid_ids as $attachment_id ) {
                $attachment_post = get_post( $attachment_id );
                if ( ! $attachment_post || $attachment_post->post_type !== 'attachment' ) {
                    continue;
                }

                $link_meta = $item_link_meta[ $attachment_id ] ?? [];

                // Resolve sizes per attachment — falls back gracefully if a derivative
                // does not exist on disk for this specific image.
                $resolved_thumb = Image_Size_Manager::resolve_size( $attachment_id, $thumb_size, 'thumbnail' );
                $resolved_full  = Image_Size_Manager::resolve_size( $attachment_id, $full_size,  'full' );

                $loaded_items[] = new Item_View(
                    id: $attachment_id,
                    thumb_url: (string) ( wp_get_attachment_image_url( $attachment_id, $resolved_thumb ) ?: '' ),
                    full_url: (string) ( wp_get_attachment_image_url( $attachment_id, $resolved_full ) ?: '' ),
                    alt: (string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
                    title: (string) $attachment_post->post_title,
                    caption: (string) $attachment_post->post_excerpt,
                    width: null,
                    height: null,
                    meta: $link_meta,
                    thumb_size: $resolved_thumb,
                );
            }

            return $loaded_items;
        }

        $loaded_items = call_user_func( $this->items_loader, $collection_item_ids );

        return is_array( $loaded_items ) ? $loaded_items : [];
    }

    /**
     * Extract and resolve image size slugs from render settings.
     *
     * Handles custom sizes by registering them on the fly if needed.
     * Returns a two-element array: [ $thumb_size_slug, $full_size_slug ].
     *
     * @since  1.0.0
     * @param  array<string, mixed> $render_settings
     * @return array{string, string}
     */
    private function resolve_size_settings( array $render_settings ): array {
        $raw_thumb = is_string( $render_settings['thumbnail_size'] ?? null )
            ? $render_settings['thumbnail_size']
            : Image_Size_Manager::SLUG_THUMBNAIL;

        $raw_full = is_string( $render_settings['full_image_size'] ?? null )
            ? $render_settings['full_image_size']
            : Image_Size_Manager::SLUG_FULL;

        // If custom thumbnail size, register it and get the deterministic slug
        $thumb_slug = $raw_thumb;
        if ( $raw_thumb === 'custom' ) {
            $w         = max( 1, (int) ( $render_settings['thumbnail_custom_size_width']  ?? 400 ) );
            $h         = max( 0, (int) ( $render_settings['thumbnail_custom_size_height'] ?? 300 ) );
            $crop      = (bool) ( $render_settings['thumbnail_custom_size_crop'] ?? true );
            $alignment = is_string( $render_settings['thumbnail_custom_size_crop_alignment'] ?? null )
                ? $render_settings['thumbnail_custom_size_crop_alignment']
                : 'center';
            $thumb_slug = Image_Size_Manager::register_custom_size( $w, $h, $crop, $alignment );
        }

        // If custom full size, register it similarly
        $full_slug = $raw_full;
        if ( $raw_full === 'custom' ) {
            $w         = max( 1, (int) ( $render_settings['full_image_custom_size_width']  ?? 1920 ) );
            $h         = max( 0, (int) ( $render_settings['full_image_custom_size_height'] ?? 0 ) );
            $crop      = (bool) ( $render_settings['full_image_custom_size_crop'] ?? false );
            $alignment = is_string( $render_settings['full_image_custom_size_crop_alignment'] ?? null )
                ? $render_settings['full_image_custom_size_crop_alignment']
                : 'center';
            $full_slug = Image_Size_Manager::register_custom_size( $w, $h, $crop, $alignment );
        }

        return [ $thumb_slug, $full_slug ];
    }

    /**
     * Batch-fetches external_url and link_target from fotogrids_item_meta.
     *
     * Queries gallery_id = 0 rows, which are the global per-item records written
     * by the item edit modal. Returns a map of attachment_id → meta array so the
     * caller can look up each item in O(1).
     *
     * @since   1.0.0
     * @param   array<int, int> $attachment_ids Attachment IDs to load.
     * @return  array<int, array{external_url: string, link_target: string}>
     */
    private function batch_load_link_meta( array $attachment_ids ): array {
        if ( empty( $attachment_ids ) ) {
            return [];
        }

        global $wpdb;

        $table        = $wpdb->prefix . 'fotogrids_item_meta';
        $placeholders = implode( ',', array_fill( 0, count( $attachment_ids ), '%d' ) );

        // Fetch global item rows (gallery_id = 0) only; these carry the
        // external_url / link_target set via the item edit modal.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $sql  = "SELECT attachment_id, external_url, link_target FROM {$table} WHERE gallery_id = 0 AND attachment_id IN ({$placeholders})";
        $rows = $wpdb->get_results(
            $wpdb->prepare( $sql, ...$attachment_ids ), // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
            ARRAY_A
        );

        $result = [];
        if ( is_array( $rows ) ) {
            foreach ( $rows as $row ) {
                $aid = (int) $row['attachment_id'];
                $result[ $aid ] = [
                    'external_url' => (string) ( $row['external_url'] ?? '' ),
                    'link_target'  => (string) ( $row['link_target'] ?? 'global' ),
                ];
            }
        }

        return $result;
    }

    /**
     * Merge preview overrides into item meta maps.
     *
     * @since   1.0.0
     * @param   array<int, Item_View>                        $collection_items Collection items.
     * @param   array<int|string, array<string, mixed>>      $item_overrides Item overrides by ID.
     * @return  array<int, Item_View>
     */
    private function apply_item_overrides( array $collection_items, array $item_overrides ): array {
        $overridden_items = [];

        foreach ( $collection_items as $item_view ) {
            $override_data = $item_overrides[ $item_view->id ] ?? null;
            if ( ! is_array( $override_data ) ) {
                $overridden_items[] = $item_view;
                continue;
            }

            $overridden_items[] = $item_view->with(
                [
                    'meta' => array_merge( $item_view->meta, $override_data ),
                ]
            );
        }

        return $overridden_items;
    }
}
