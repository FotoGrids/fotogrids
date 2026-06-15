<?php
/**
 * Native Divi 5 — FotoGrids Album module (PHP render side).
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Divi\Native
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Divi\Native;

use FotoGrids\Render\Api\Request_Source;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * PHP half of the native Divi 5 FotoGrids Album module.
 *
 * Mirrors {@see Gallery_Module} exactly except for the collection type:
 * registers `fotogrids/fotogrids-album` and delegates rendering to
 * `Public_Render::album_shortcode()`.
 *
 * @since 1.0.0
 */
class Album_Module implements \ET\Builder\Framework\DependencyManagement\Interfaces\DependencyInterface {

	/**
	 * Register the block + render callback on `init`.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function load(): void {
		$json_folder = dirname( __DIR__ ) . '/modules-json/album';

		$register = static function () use ( $json_folder ) {
			if ( ! class_exists( '\ET\Builder\Packages\ModuleLibrary\ModuleRegistration' ) ) {
				return;
			}

			require_once __DIR__ . '/class-collection-options.php';

			$args = array(
				'render_callback' => array( self::class, 'render_callback' ),
			);

			$attributes = Collection_Options::attributes_with_options(
				$json_folder . '/module.json',
				'album',
				'albumId',
				'album'
			);
			if ( ! empty( $attributes ) ) {
				$args['attributes'] = $attributes;
			}

			\ET\Builder\Packages\ModuleLibrary\ModuleRegistration::register_module(
				$json_folder,
				$args
			);
		};

		// See Gallery_Module::load() — Divi calls this synchronously inside
		// its `init:0` bootstrap, so register immediately.
		$register();
	}

	/**
	 * Front-end render callback.
	 *
	 * @since 1.0.0
	 * @param array     $attrs    Block attributes saved by the VB.
	 * @param string    $content  Block inner content (unused).
	 * @param \WP_Block $block    Parsed block instance.
	 * @param mixed     $elements Divi ModuleElements instance (unused).
	 * @return string
	 */
	public static function render_callback( $attrs, $content, $block, $elements ): string {
		$album_id = self::resolve_id( $attrs );

		if ( $album_id <= 0 ) {
			return '';
		}

		if ( ! class_exists( '\FotoGrids\Public_Render' )
			|| ! method_exists( '\FotoGrids\Public_Render', 'album_shortcode' ) ) {
			return '';
		}

		return \FotoGrids\Public_Render::album_shortcode(
			array(
				'id'      => $album_id,
				'_source' => Request_Source::DIVI,
			)
		);
	}

	/**
	 * Pull the album ID out of the Divi 5 attribute shape
	 * (`album.innerContent.desktop.value.albumId`).
	 *
	 * @since 1.0.0
	 * @param array $attrs Block attributes.
	 * @return int
	 */
	private static function resolve_id( array $attrs ): int {
		$raw = $attrs['album']['innerContent']['desktop']['value']['albumId'] ?? 0;
		return absint( $raw );
	}
}
