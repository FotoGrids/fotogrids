<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Sharing;

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
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return bool
     */
    public function supports( Render_Context $render_context ): bool {
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

    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets();
    }
}
