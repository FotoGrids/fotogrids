<?php
/**
 * Native Divi 5 - FotoGrids Gallery module (PHP render side).
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
 * PHP half of the native Divi 5 FotoGrids Gallery module.
 *
 * Implements Divi 5's `DependencyInterface` so it can be added to the
 * module dependency tree. `load()` registers the block + render callback
 * via `ModuleRegistration::register_module()`, pointing at the compiled
 * `module.json` shipped alongside the VB bundle.
 *
 * The render callback resolves the picked gallery ID from the block
 * attributes and delegates to the existing shortcode pipeline
 * (`Public_Render::gallery_shortcode()`) stamped `Request_Source::DIVI`.
 * Every decorator / feature / layout module therefore works unchanged -
 * the native Divi module is just another front door onto the same render
 * path used by shortcodes, Gutenberg and Elementor.
 *
 * Note on `implements`: we declare the interface by its fully-qualified
 * name via a class_alias-free `\ET\...` reference at registration time
 * rather than a `use` + `implements` clause, because this file is only
 * ever required when Divi 5 is active (guarded by the parent Module's
 * `is_active()`), and we don't want a hard compile-time dependency on a
 * Divi interface that wouldn't exist on a non-Divi site. See the parent
 * `Module::register_native_modules()` - it only requires this file when
 * the Divi 5 framework is present.
 *
 * @since 1.0.0
 */
class Gallery_Module implements \ET\Builder\Framework\DependencyManagement\Interfaces\DependencyInterface {

	/**
	 * Register the block + render callback on `init`.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function load(): void {
		$json_folder = dirname( __DIR__ ) . '/modules-json/gallery';

		$register = static function () use ( $json_folder ) {
			if ( ! class_exists( '\ET\Builder\Packages\ModuleLibrary\ModuleRegistration' ) ) {
				return;
			}

			require_once __DIR__ . '/class-collection-options.php';

			$args = array(
				'render_callback' => array( self::class, 'render_callback' ),
			);

			// Populate the native select with the site's published
			// galleries. Args win the merge over the JSON metadata,
			// so this overrides the empty `options: {}` shipped in
			// module.json.
			$attributes = Collection_Options::attributes_with_options(
				$json_folder . '/module.json',
				'gallery',
				'galleryId',
				'gallery'
			);
			if ( ! empty( $attributes ) ) {
				$args['attributes'] = $attributes;
			}

			\ET\Builder\Packages\ModuleLibrary\ModuleRegistration::register_module(
				$json_folder,
				$args
			);
		};

		// Divi calls load() from FrontEnd/Admin construction, which runs
		// synchronously inside `et_setup_builder_5` on `init:0` - Divi 5
		// (and ModuleRegistration) is fully loaded at this point. So we
		// register immediately rather than deferring to a nested `init`
		// callback (which would be re-entrant and fragile).
		$register();
	}

	/**
	 * Front-end render callback.
	 *
	 * @since 1.0.0
	 * @param array       $attrs    Block attributes saved by the VB.
	 * @param string      $content  Block inner content (unused).
	 * @param \WP_Block   $block    Parsed block instance.
	 * @param mixed       $elements Divi ModuleElements instance (unused - we
	 *                              delegate the whole render to the shortcode
	 *                              pipeline rather than composing Divi
	 *                              elements).
	 * @return string
	 */
	public static function render_callback( $attrs, $content, $block, $elements ): string {
		$gallery_id = self::resolve_id( $attrs );

		if ( $gallery_id <= 0 ) {
			return '';
		}

		if ( ! class_exists( '\FotoGrids\Public_Render' )
			|| ! method_exists( '\FotoGrids\Public_Render', 'gallery_shortcode' ) ) {
			return '';
		}

		return \FotoGrids\Public_Render::gallery_shortcode(
			array(
				'id'      => $gallery_id,
				'_source' => Request_Source::DIVI,
			)
		);
	}

	/**
	 * Pull the gallery ID out of the multi-breakpoint/state attribute
	 * shape Divi 5 saves (`gallery.innerContent.desktop.value.galleryId`).
	 *
	 * @since 1.0.0
	 * @param array $attrs Block attributes.
	 * @return int
	 */
	private static function resolve_id( array $attrs ): int {
		$raw = $attrs['gallery']['innerContent']['desktop']['value']['galleryId'] ?? 0;
		return absint( $raw );
	}
}
