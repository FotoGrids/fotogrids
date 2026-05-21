<?php
declare(strict_types=1);

use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Hooks;

if ( ! defined( 'WPINC' ) ) {
    die;
}

if ( ! function_exists( 'fotogrids_render_autoload' ) ) {
    /**
     * Autoloads render namespace classes.
     *
     * @since 1.0.0
     * @param string $class_name Class name.
     * @return void
     */
    function fotogrids_render_autoload( string $class_name ): void {
        $namespace_prefix = 'FotoGrids\\Render\\';
        if ( strncmp( $class_name, $namespace_prefix, strlen( $namespace_prefix ) ) !== 0 ) {
            return;
        }

        $relative_class = substr( $class_name, strlen( $namespace_prefix ) );
        if ( $relative_class === false || $relative_class === '' ) {
            return;
        }

        $relative_parts = explode( '\\', $relative_class );
        $symbol_name = array_pop( $relative_parts );
        $directory_path = implode(
            '/',
            array_map(
                static fn( string $part ): string => strtolower( str_replace( '_', '-', $part ) ),
                $relative_parts
            )
        );
        $symbol_slug = strtolower( str_replace( '_', '-', $symbol_name ) );

        $base_path = FOTOGRIDS_PLUGIN_DIR . 'public/render/';
        $candidate_paths = [
            $base_path . ( $directory_path !== '' ? $directory_path . '/' : '' ) . 'class-' . $symbol_slug . '.php',
            $base_path . ( $directory_path !== '' ? $directory_path . '/' : '' ) . 'interface-' . $symbol_slug . '.php',
            $base_path . ( $directory_path !== '' ? $directory_path . '/' : '' ) . 'enum-' . $symbol_slug . '.php',
            $base_path . ( $directory_path !== '' ? $directory_path . '/' : '' ) . 'trait-' . $symbol_slug . '.php',
        ];

        foreach ( $candidate_paths as $candidate_path ) {
            if ( file_exists( $candidate_path ) ) {
                require_once $candidate_path;
                return;
            }
        }
    }
}

spl_autoload_register( 'fotogrids_render_autoload' );

add_action(
    'plugins_loaded',
    static function (): void {
        Asset_Resolver::register_plugin( 'fotogrids', FOTOGRIDS_PLUGIN_URL, FOTOGRIDS_VERSION );
    },
    5
);

add_action(
    'wp_loaded',
    static function (): void {
        do_action( Hooks::HOOK_REGISTER_MODULES );
    },
    5
);

add_action(
    Hooks::HOOK_REGISTER_MODULES,
    static function (): void {
        if ( ! class_exists( \FotoGrids\Render\Internal\Module_Registry::class ) ) {
            return;
        }
        \FotoGrids\Render\Internal\Module_Registry::register( 'gates', \FotoGrids\Render\Gates\Collection_Permissions\Collection_Permissions::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'gates', \FotoGrids\Render\Gates\Password\Password_Gate::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Grid::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Masonry::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'layouts', \FotoGrids\Render\Layouts\Layout_Justified::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Captions\Captions::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Image_Filters\Image_Filters::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Border_Radius\Border_Radius::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Border\Border::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Shadow\Shadow::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Effects\Hover_Effects::class );
        // Click-behavior decorators must run after all visual decorators so the
        // <a> wraps the fully-decorated item media. Only one of these will be
        // active at a time (each checks click_behavior in supports()).
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Lightbox\Lightbox_Decorator::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\Direct_Link\Direct_Link_Decorator::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'decorators', \FotoGrids\Render\Decorators\External_Link\External_Link_Decorator::class );
        // Loading Icon must be registered before Lightbox so its <symbol> block
        // is emitted inside html_appendix() before the lightbox reads the global.
        \FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Loading_Icon\Loading_Icon::class );
        // Loaded Effect drives the image reveal animation once state="loaded".
        // Registered immediately after Loading Icon so the CSS loads in order.
        \FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Loaded_Effect\Loaded_Effect::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Custom_Code\Custom_Css::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Custom_Code\Custom_Js::class );
        \FotoGrids\Render\Internal\Module_Registry::register( 'features', \FotoGrids\Render\Features\Lightbox\Lightbox::class );
    },
    10
);

add_action(
    'wp_footer',
    static function (): void {
        Asset_Resolver::instance()->flush();
    },
    9
);

add_action(
    'admin_footer',
    static function (): void {
        Asset_Resolver::instance()->flush();
    },
    9
);
