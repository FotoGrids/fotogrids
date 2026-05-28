<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Album_To_View_Page;

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Item_Wrapper;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Album → View Page click behaviour.
 *
 * Wraps each album item (a child gallery summary) in an <a href="{view-page}">
 * that takes the visitor to the gallery's standalone View Page. Active on
 * album-as-collection renders when use_ajax_from_album is false.
 *
 * Pair: Album_To_Gallery_Ajax handles the AJAX-in-place case.
 *
 * @package FotoGrids\Render\Decorators\Album_To_View_Page
 * @since   1.0.0
 */
final class Album_To_View_Page implements Decorator {

    public function id(): string {
        return 'fotogrids/album-to-view-page';
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
     * Active on album renders where the AJAX-album setting is off (or
     * unset).
     *
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return bool
     */
    public function supports( Render_Context $render_context ): bool {
        if ( $render_context->meta->collection_kind !== Collection_Kind::ALBUM ) {
            return false;
        }
        // Default to view-page navigation if the setting is missing.
        return empty( $render_context->settings['use_ajax_from_album'] );
    }

    /**
     * Wrap each item's figure (media + caption) in an <a> linking to the
     * child gallery's permalink. The gallery's View Page is just its
     * permalink — the ViewCollections module flips fotogrids_gallery to
     * publicly_queryable on init.
     *
     * @since 1.0.0
     * @param array<int, Item_View> $collection_items Collection items.
     * @param Render_Context        $render_context   Render context.
     * @return array<int, Item_View>
     */
    public function decorate_items( array $collection_items, Render_Context $render_context ): array {
        $decorated = [];

        // Visit-context: the album we're rendering IS the gallery's
        // referring parent. Append fg_via=<album_id> to the link so the
        // destination View Page can build a breadcrumb / back button that
        // points back at *this* album, not the gallery's other albums (if any).
        $via_album_id = $render_context->meta->album_id;

        foreach ( $collection_items as $item_view ) {
            $gallery_id = $item_view->id;
            $permalink  = get_permalink( $gallery_id );

            // Fallback to '#' if the gallery has no permalink (draft, private,
            // or the ViewCollections module hasn't set publicly_queryable).
            // The link still renders so the click-affordance is consistent;
            // it just doesn't navigate anywhere useful.
            $href = is_string( $permalink ) && $permalink !== ''
                ? $permalink
                : '#';

            if ( $href !== '#' && $via_album_id !== null && $via_album_id > 0 ) {
                $href = add_query_arg( 'fg_via', (int) $via_album_id, $href );
            }

            $figure_wrapper = new Item_Wrapper(
                tag:   'a',
                attrs: [
                    'href'                 => esc_url( $href ),
                    'data-fg-album-target' => 'view-page',
                    'data-fg-gallery-id'   => (string) $gallery_id,
                ],
            );

            $decorated[] = $item_view->with( [
                'figure_wrappers' => array_merge( $item_view->figure_wrappers, [ $figure_wrapper ] ),
            ] );
        }

        return $decorated;
    }

    public function wrapper_data_attrs( Render_Context $render_context ): array {
        return [ 'data-fg-album-click' => 'view-page' ];
    }

    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    public function assets( Render_Context $render_context ): Module_Assets {
        // No JS — the <a> navigates natively. CSS rules for albums live in
        // the layout/decorator stylesheets already loaded for the gallery
        // class.
        return new Module_Assets();
    }
}
