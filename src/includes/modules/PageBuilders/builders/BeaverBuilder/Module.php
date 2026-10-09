<?php
/**
 * Beaver Builder sub-module.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder;

use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules\Album_Module;
use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules\Gallery_Module;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Beaver Builder sub-module of Page Builders.
 *
 * Registers the FotoGrids gallery and album modules with Beaver Builder.
 * Rendering is delegated to the shortcode pipeline, as in the other builders.
 *
 * @since 1.3.0
 */
final class Module {

	/**
	 * Slug of the gallery module.
	 *
	 * @var string
	 */
	public const GALLERY_MODULE = 'fotogrids-gallery';

	/**
	 * Slug of the album module.
	 *
	 * @var string
	 */
	public const ALBUM_MODULE = 'fotogrids-album';

	/**
	 * Whether Beaver Builder is loaded.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public static function is_active(): bool {
		return class_exists( 'FLBuilder' ) && class_exists( 'FLBuilderModule' );
	}

	/**
	 * Boot the Beaver Builder sub-module.
	 *
	 * Runs from the `init:5` module dispatch, after Beaver Builder has loaded
	 * its own modules on `init:2`.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function init(): void {
		if ( ! self::is_active() ) {
			return;
		}

		self::register_modules();
	}

	/**
	 * Register the gallery and album modules with Beaver Builder.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function register_modules(): void {
		require_once __DIR__ . '/modules/class-module-base.php';
		require_once __DIR__ . '/modules/fotogrids-gallery/class-gallery-module.php';
		require_once __DIR__ . '/modules/fotogrids-album/class-album-module.php';

		\FLBuilder::register_module( Gallery_Module::class, Gallery_Module::get_form() );
		\FLBuilder::register_module( Album_Module::class, Album_Module::get_form() );
	}

	/**
	 * Label of the FotoGrids category in the module panel.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	public static function get_category_label(): string {
		return __( 'FotoGrids', 'fotogrids' );
	}
}
