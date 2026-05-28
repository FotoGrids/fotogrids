<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Sharing;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Exposes the resolved sharing configuration to the frontend.
 *
 * Writes the effective sharing config (enabled networks, placements, button
 * style/size) as a JSON data attribute on the gallery wrapper. The frontend
 * reads it and renders share bars on thumbnails / full images for the
 * placements that apply. Active whenever sharing is enabled for the collection.
 *
 * @package FotoGrids\Render\Decorators\Sharing
 * @since   1.0.0
 */
final class Sharing_Decorator implements Decorator {

    public function id(): string {
        return 'fotogrids/sharing';
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
     * Active when sharing resolves to enabled for this collection.
     *
     * Opts out of album-as-collection renders. The item-level share
     * placements (thumbnail, lightbox) don't apply to album thumbnails
     * (which navigate into a gallery, not into a lightbox), and the
     * view_footer placement is rendered by the View Page shell — not by
     * the gallery wrapper inside it.
     *
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return bool
     */
    public function supports( Render_Context $render_context ): bool {
        if ( $render_context->meta->collection_kind === Collection_Kind::ALBUM ) {
            return false;
        }
        $resolved = fotogrids_get_resolved_sharing( $render_context->meta->gallery_id );
        return ! empty( $resolved['enabled'] );
    }

    /**
     * Sharing adds no per-item wrappers; the frontend draws the bars.
     *
     * @since 1.0.0
     * @param array<int, Item_View> $collection_items Collection items.
     * @param Render_Context        $render_context   Render context.
     * @return array<int, Item_View>
     */
    public function decorate_items( array $collection_items, Render_Context $render_context ): array {
        return $collection_items;
    }

    /**
     * Write the resolved sharing config onto the gallery wrapper.
     *
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        $resolved = fotogrids_get_resolved_sharing( $render_context->meta->gallery_id );

        $payload = array(
            'enabled'      => (bool) $resolved['enabled'],
            'networks'     => $resolved['networks'],
            'placements'   => $resolved['placements'],
            'button_style' => $resolved['button_style'],
            'button_size'  => $resolved['button_size'],
        );

        return array( 'data-fg-sharing' => wp_json_encode( $payload ) );
    }

    public function style_vars( Render_Context $render_context ): array {
        return array();
    }

    /**
     * Sharing's own JS and CSS. Both ship from the module folder via the
     * webpack entries `sharing` (JS, copied to assets/js) and the inline
     * CSS file (copied verbatim by CopyWebpackPlugin's public/render/**
     * rule).
     *
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            css: [
                // fg-tooltip first so its handle is registered before any
                // module that depends on it (sharing's share-bar buttons
                // bind tooltips via window.FgTooltip).
                'fotogrids-fg-tooltip' => new Asset_Decl(
                    path:      '../../assets/css/fg-tooltip.css',
                    in_footer: false,
                ),
                'fotogrids-sharing' => new Asset_Decl(
                    path:      'decorators/sharing/sharing.css',
                    in_footer: false,
                ),
            ],
            js: [
                'fotogrids-fg-tooltip' => new Asset_Decl(
                    path:      '../../assets/js/fg-tooltip.js',
                    deps:      [],
                    in_footer: true,
                ),
                // deep-linking only makes sense when sharing is active —
                // it interprets ?fg-item / #fg-<g>-<i> URLs that come
                // from shared links. The View Page enqueues it directly
                // because those URLs arrive there even with sharing off.
                'fotogrids-deep-linking' => new Asset_Decl(
                    path:      '../../assets/js/deep-linking.js',
                    deps:      [ 'fotogrids-runtime' ],
                    in_footer: true,
                ),
                'fotogrids-sharing' => new Asset_Decl(
                    path:      '../../assets/js/sharing.js',
                    deps:      [ 'fotogrids-runtime', 'fotogrids-fg-tooltip' ],
                    in_footer: true,
                ),
            ],
        );
    }
}
