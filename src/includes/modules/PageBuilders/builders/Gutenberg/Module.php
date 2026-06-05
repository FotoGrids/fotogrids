<?php
/**
 * Gutenberg builder sub-module.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Gutenberg
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Gutenberg;

use FotoGrids\Hooks\Filters_Page_Builders;
use FotoGrids\License_Manager;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Gutenberg sub-module of Page Builders.
 *
 * Registers the FotoGrids Gutenberg blocks (gallery and album) plus the
 * single shared editor script bundle they use. Both blocks share the same
 * editor script and stylesheet - the per-block `Edit` component is a thin
 * shell over the shared PageBuilders core components (picker, live-preview,
 * inspector primitives), so there is no compile-time reason to ship two
 * separate bundles.
 *
 * This sub-module does not register itself with `Module_Registry`. The
 * parent PageBuilders module owns the registry slot and dispatches `init()`
 * and `enqueue_assets()` to each builder.
 *
 * @since 1.0.0
 */
final class Module {

    /**
     * Script handle for the gallery block editor bundle.
     *
     * Used both for the script enqueue and as the `editorScript` value in
     * `block.json` (handle form, no `file:` prefix).
     *
     * @var string
     */
    public const SCRIPT_HANDLE_GALLERY = 'fotogrids-pb-gutenberg-gallery';

    /**
     * Script handle for the album block editor bundle.
     *
     * @var string
     */
    public const SCRIPT_HANDLE_ALBUM = 'fotogrids-pb-gutenberg-album';

    /**
     * Style handle for the shared "collection" styles used by every
     * FotoGrids block (picker modal, live-preview frame, inspector
     * primitives, placeholder/skeleton). Loaded once per editor; both
     * per-block stylesheets declare it as a dep.
     *
     * @var string
     */
    public const STYLE_HANDLE_COLLECTION = 'fotogrids-pb-collection';

    /**
     * Whether to register the Gutenberg blocks. Always true on WordPress
     * 5.0+, which is below our minimum. Method exists for symmetry with
     * future builders whose activation depends on host-plugin presence.
     *
     * @since 1.0.0
     * @return bool
     */
    public static function is_active(): bool {
        return function_exists( 'register_block_type' );
    }

    /**
     * Boot the Gutenberg sub-module.
     *
     * The parent PageBuilders module dispatches init() from inside the
     * 'init' action (priority 5 - that's when Module_Registry::boot()
     * fires). We need to defer the actual asset + block registration to
     * priority 20 so:
     *   - wp_register_script() runs after WordPress' default-scripts
     *     bootstrapping (which is fine at any priority, but consistent).
     *   - register_block_type() runs at the same priority WordPress core
     *     uses for its own blocks, which removes any "registered too
     *     early" surprises around the block-type store.
     *
     * Because WordPress allows add_action() during the same action firing
     * for LATER priorities, this works even when init() is called from
     * inside the init:5 dispatcher.
     *
     * @since 1.0.0
     * @return void
     */
    public static function init(): void {
        if ( ! self::is_active() ) {
            return;
        }

        add_action( 'init', [ self::class, 'register_block_assets' ], 15 );
        add_action( 'init', [ self::class, 'register_blocks' ], 20 );

        // Belt-and-braces: also enqueue the editor scripts directly on
        // enqueue_block_editor_assets so the bundles land on the page even
        // if WordPress' block.json -> editorScript pathway fails to enqueue
        // them (e.g. when the handle isn't registered yet at the moment
        // register_block_type runs).
        add_action( 'enqueue_block_editor_assets', [ self::class, 'force_enqueue_editor_assets' ] );

        // Opt every Gutenberg-built page that contains a FotoGrids block
        // into the page-global asset bootstrap (runtime localize + errors
        // stylesheet). Mirrors the Elementor sub-module's hook into the
        // same filter; keeps Public_Render free of per-builder branches.
        add_filter( Filters_Page_Builders::HAS_CONTENT, [ self::class, 'detect_in_gutenberg' ], 10, 2 );
    }

    /**
     * Filter callback: detect FotoGrids blocks in a post's serialized
     * block tree.
     *
     * @since 1.0.0
     * @param bool          $detected Previous detection result.
     * @param \WP_Post|null $post     Current post (may be null on theme
     *                                builder parts / FSE template parts).
     * @return bool
     */
    public static function detect_in_gutenberg( bool $detected, $post ): bool {
        if ( $detected ) {
            return true;
        }
        if ( ! function_exists( 'has_block' ) || ! $post instanceof \WP_Post ) {
            return $detected;
        }
        if ( has_block( 'fotogrids/gallery', $post )
            || has_block( 'fotogrids/album', $post ) ) {
            return true;
        }
        return $detected;
    }

    /**
     * Register the editor script + style handles before the blocks
     * register, so `block.json`'s `editorScript` lookup resolves.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register_block_assets(): void {
        $base_url       = FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/Gutenberg/assets/';
        $collection_url = FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/assets/collection.css';

        $editor_deps = [
            'wp-blocks',
            'wp-block-editor',
            'wp-components',
            'wp-element',
            'wp-i18n',
            'wp-api-fetch',
            'wp-hooks',
            // `window.FotoGridsIcons` payload — required by the shared
            // <Icon /> component, which Button uses for icon-only and
            // leading-icon variants. Registered once by the parent
            // PageBuilders module on every enqueue cycle.
            \FotoGrids\Modules\PageBuilders\Module::FG_ICONS_SCRIPT_HANDLE,
        ];

        // Shared collection styles (picker / preview / inspector /
        // placeholder). Loaded once per editor; both block stylesheets
        // declare it as a dep below so WordPress dedupes the handle.
        // The aggregated `fotogrids-fg-shared` stylesheet is a hard dep
        // because PickerModal / Button / FormField are used inside
        // the picker — without it the picker has no chrome. Registered
        // once by the parent PageBuilders module; the dep chain ensures
        // it ships exactly once per editor page regardless of which /
        // how many blocks load.
        wp_register_style(
            self::STYLE_HANDLE_COLLECTION,
            $collection_url,
            [ 'wp-components', \FotoGrids\Modules\PageBuilders\Module::FG_SHARED_STYLE_HANDLE ],
            FOTOGRIDS_VERSION
        );

        wp_register_script(
            self::SCRIPT_HANDLE_GALLERY,
            $base_url . 'gallery.js',
            $editor_deps,
            FOTOGRIDS_VERSION,
            true
        );

        wp_register_style(
            self::SCRIPT_HANDLE_GALLERY,
            $base_url . 'gallery.css',
            [ self::STYLE_HANDLE_COLLECTION ],
            FOTOGRIDS_VERSION
        );

        // Album block - same bundle pattern.
        wp_register_script(
            self::SCRIPT_HANDLE_ALBUM,
            $base_url . 'album.js',
            $editor_deps,
            FOTOGRIDS_VERSION,
            true
        );

        wp_register_style(
            self::SCRIPT_HANDLE_ALBUM,
            $base_url . 'album.css',
            [ self::STYLE_HANDLE_COLLECTION ],
            FOTOGRIDS_VERSION
        );

        // Both bundles read window.fotogridsPageBuilders for their config.
        $payload = self::build_localize_payload();
        wp_localize_script( self::SCRIPT_HANDLE_GALLERY, 'fotogridsPageBuilders', $payload );
        wp_localize_script( self::SCRIPT_HANDLE_ALBUM,   'fotogridsPageBuilders', $payload );
    }

    /**
     * Register both blocks from their `block.json` directories.
     *
     * `register_block_type()` reads the JSON, pairs it with the
     * server-side `render.php` (because each block.json sits next to a
     * `render.php` named exactly that), and respects our pre-registered
     * `editorScript` / `editorStyle` handles.
     *
     * @since 1.0.0
     * @return void
     */
    public static function register_blocks(): void {
        $blocks_dir = FOTOGRIDS_PLUGIN_DIR . 'includes/modules/PageBuilders/builders/Gutenberg/blocks/';

        foreach ( [ 'gallery', 'album' ] as $block_name ) {
            $block_path = $blocks_dir . $block_name;
            if ( ! is_dir( $block_path ) || ! file_exists( $block_path . '/block.json' ) ) {
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    error_log( sprintf(
                        '[FotoGrids PageBuilders/Gutenberg] block.json missing at %s',
                        $block_path . '/block.json'
                    ) );
                }
                continue;
            }

            try {
                $result = register_block_type( $block_path );
                if ( ! $result && defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    error_log( sprintf(
                        '[FotoGrids PageBuilders/Gutenberg] register_block_type() failed for %s',
                        $block_name
                    ) );
                }
            } catch ( \Throwable $e ) {
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    error_log( sprintf(
                        '[FotoGrids PageBuilders/Gutenberg] exception registering %s: %s',
                        $block_name,
                        $e->getMessage()
                    ) );
                }
            }
        }
    }

    /**
     * No-op. Block scripts are enqueued automatically by
     * `register_block_type()` from the `block.json` `editorScript`
     * registration - we don't need to enqueue from the module's
     * `enqueue_assets()`.
     *
     * @since 1.0.0
     * @param string $hook Current admin page hook suffix.
     * @return void
     */
    public static function enqueue_assets( string $hook ): void {
        unset( $hook );
    }

    /**
     * Force-enqueue both block editor bundles on every block-editor screen.
     *
     * `register_block_type()` is supposed to auto-enqueue the script
     * referenced by `block.json`'s `editorScript`, but only if the handle
     * is registered at the moment WordPress hits the editor. Belt-and-
     * braces enqueue here guarantees the bundles ship regardless of that
     * registration-timing edge case.
     *
     * @since 1.0.0
     * @return void
     */
    public static function force_enqueue_editor_assets(): void {
        if ( ! wp_script_is( self::SCRIPT_HANDLE_GALLERY, 'registered' ) ) {
            self::register_block_assets();
        }
        wp_enqueue_script( self::SCRIPT_HANDLE_GALLERY );
        wp_enqueue_style( self::SCRIPT_HANDLE_GALLERY );
        wp_enqueue_script( self::SCRIPT_HANDLE_ALBUM );
        wp_enqueue_style( self::SCRIPT_HANDLE_ALBUM );
    }

    /**
     * Build the `window.fotogridsPageBuilders` localize payload.
     *
     * Carries the REST root, the WP nonce, the URLs to create / edit
     * galleries and albums, and the current license state in the
     * 'active' | 'lapsed' | 'none' vocabulary the JS pro-guard uses.
     *
     * @since 1.0.0
     * @return array<string, mixed>
     */
    private static function build_localize_payload(): array {
        return [
            'restUrl'         => esc_url_raw( rest_url( 'fotogrids/v1/' ) ),
            'restNonce'       => wp_create_nonce( 'wp_rest' ),
            'licenseState'    => self::current_license_state(),
            'galleryCreateUrl' => admin_url( 'post-new.php?post_type=fotogrids_gallery' ),
            'albumCreateUrl'   => admin_url( 'post-new.php?post_type=fotogrids_album' ),
            'galleryEditBase'  => admin_url( 'post.php?action=edit&post=' ),
            'albumEditBase'    => admin_url( 'post.php?action=edit&post=' ),
        ];
    }

    /**
     * Resolve the current user's license state.
     *
     * Mirrors `Preview_Data::current_license_state()`. Duplicated here so
     * the Gutenberg sub-module is self-sufficient at script-enqueue time
     * (which fires earlier than the REST routes are hit).
     *
     * @since 1.0.0
     * @return string 'active' | 'lapsed' | 'none'
     */
    private static function current_license_state(): string {
        if ( ! class_exists( License_Manager::class ) ) {
            return 'none';
        }
        if ( License_Manager::is_pro_active() ) {
            return 'active';
        }
        global $wpdb;
        $table    = $wpdb->prefix . 'fotogrids_licenses';
        $previous = $wpdb->suppress_errors( true );
        $count    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
        $wpdb->suppress_errors( $previous );
        return $count > 0 ? 'lapsed' : 'none';
    }
}
