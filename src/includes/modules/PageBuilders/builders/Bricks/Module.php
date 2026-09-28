<?php
/**
 * Bricks builder sub-module.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Bricks
 * @since   1.2.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Bricks;

use FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements\Element_Album;
use FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements\Element_Gallery;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Bricks sub-module of Page Builders.
 *
 * Registers the FotoGrids gallery and album elements with Bricks. Rendering
 * is delegated to the shortcode pipeline, as in the other builders.
 *
 * @since 1.2.0
 */
final class Module {

	/**
	 * Bricks element category key.
	 *
	 * @var string
	 */
	public const CATEGORY = 'fotogrids';

	/**
	 * Bricks element name of the gallery element.
	 *
	 * @var string
	 */
	public const GALLERY_ELEMENT = 'fotogrids-gallery';

	/**
	 * Bricks element name of the album element.
	 *
	 * @var string
	 */
	public const ALBUM_ELEMENT = 'fotogrids-album';

	/**
	 * Whether the Bricks theme is loaded.
	 *
	 * @since 1.2.0
	 * @return bool
	 */
	public static function is_active(): bool {
		return defined( 'BRICKS_VERSION' );
	}

	/**
	 * Boot the Bricks sub-module.
	 *
	 * `\Bricks\Element` is declared by Bricks on `init` priority 10, after any
	 * plugin callback at the same priority, so elements register on 11.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public static function init(): void {
		if ( ! self::is_active() ) {
			return;
		}

		add_action( 'init', array( self::class, 'register_elements' ), 11 );
		add_filter( 'bricks/builder/i18n', array( self::class, 'add_category_label' ) );
	}

	/**
	 * Register the gallery and album elements with Bricks.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public static function register_elements(): void {
		if ( ! class_exists( '\Bricks\Elements' ) || ! class_exists( '\Bricks\Element' ) ) {
			return;
		}

		require_once __DIR__ . '/elements/class-element-base.php';

		\Bricks\Elements::register_element( __DIR__ . '/elements/class-element-gallery.php', self::GALLERY_ELEMENT, Element_Gallery::class );
		\Bricks\Elements::register_element( __DIR__ . '/elements/class-element-album.php', self::ALBUM_ELEMENT, Element_Album::class );
	}

	/**
	 * Filter callback: label the FotoGrids element category in the builder panel.
	 *
	 * @since 1.2.0
	 * @param array<string,string> $i18n Builder strings keyed by identifier.
	 * @return array<string,string>
	 */
	public static function add_category_label( $i18n ): array {
		$i18n                   = (array) $i18n;
		$i18n[ self::CATEGORY ] = esc_html__( 'FotoGrids', 'fotogrids' );

		return $i18n;
	}
}
