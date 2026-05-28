<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Stats;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Stats feature module.
 *
 * Reads `enable_statistics` from the collection settings (default true).
 * When active, exposes the REST URL and a per-render nonce to the
 * client, and ships stats.js which:
 *
 *   • subscribes to FotoGrids.onGallery to fire a view ping per gallery
 *   • listens for the fotogrids:share event (dispatched by the Sharing
 *     module) and posts a share ping
 *
 * Activation is per-render: a gallery with enable_statistics=false on
 * a page that also renders a gallery with enable_statistics=true will
 * not get the JS attached because Asset_Resolver only enqueues assets
 * for modules whose supports() returned true. The client-side guard is
 * a data attribute the module's wrapper_data_attrs() writes.
 *
 * @package FotoGrids\Render\Features\Stats
 * @since   1.0.0
 */
final class Stats implements Feature {

    public function id(): string {
        return 'fotogrids/stats';
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
     * Active when the collection has enable_statistics set true
     * (default). Admin previews never fire stats.
     *
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return bool
     */
    public function supports( Render_Context $render_context ): bool {
        if ( $render_context->meta->is_preview ) {
            return false;
        }
        $setting = $render_context->settings['enable_statistics'] ?? true;
        return (bool) $setting;
    }

    public function html_before( Render_Context $render_context ): string {
        return '';
    }

    public function html_appendix( Render_Context $render_context ): string {
        return '';
    }

    public function html_after( Render_Context $render_context ): string {
        return '';
    }

    /**
     * Writes the per-collection stats config onto the wrapper element.
     *
     * Includes the explicit object_type/object_id so the JS doesn't have
     * to figure out whether this is an album or a gallery — it just reads
     * the values and POSTs them. The object_id is the *album's* post ID
     * on album renders, the gallery's post ID on gallery renders.
     *
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return array<string, string>
     */
    public function wrapper_data_attrs( Render_Context $render_context ): array {
        $is_album = $render_context->meta->collection_kind === Collection_Kind::ALBUM;

        $payload = [
            'enabled'    => true,
            'restUrl'    => rest_url( 'fotogrids/v1/' ),
            'nonce'      => wp_create_nonce( 'wp_rest' ),
            'objectType' => $is_album ? 'album' : 'gallery',
            'objectId'   => $is_album
                ? (int) $render_context->meta->album_id
                : (int) $render_context->meta->gallery_id,
        ];
        return [ 'data-fg-stats' => wp_json_encode( $payload ) ];
    }

    public function style_vars( Render_Context $render_context ): array {
        return [];
    }

    /**
     * Stats client JS — fires view and share pings to the REST API.
     *
     * @since 1.0.0
     * @param Render_Context $render_context Render context.
     * @return Module_Assets
     */
    public function assets( Render_Context $render_context ): Module_Assets {
        return new Module_Assets(
            js: [
                'fotogrids-stats' => new Asset_Decl(
                    path:      '../../assets/js/stats.js',
                    deps:      [ 'fotogrids-runtime' ],
                    in_footer: true,
                ),
            ]
        );
    }
}
