<?php
/**
 * Bricks builder sub-module.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Bricks
 * @since   1.2.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Bricks;

use FotoGrids\Hooks\Filters_Page_Builders;
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
	 * Global function the builder canvas calls with each element root.
	 *
	 * @var string
	 */
	public const CANVAS_INIT_FUNCTION = 'fotogridsBricksInit';

	/**
	 * Script handle of the builder canvas bundle.
	 *
	 * @var string
	 */
	public const CANVAS_SCRIPT_HANDLE = 'fotogrids-pb-bricks-canvas';

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
		add_filter( Filters_Page_Builders::HAS_CONTENT, array( self::class, 'detect_in_bricks' ), 10, 2 );
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

	/**
	 * Enqueue the builder canvas bundle.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public static function enqueue_canvas_assets(): void {
		if ( wp_script_is( self::CANVAS_SCRIPT_HANDLE, 'enqueued' ) ) {
			return;
		}

		wp_enqueue_script(
			self::CANVAS_SCRIPT_HANDLE,
			FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/Bricks/assets/canvas.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);

		wp_localize_script(
			self::CANVAS_SCRIPT_HANDLE,
			'fotogridsPbBricksCanvas',
			array(
				'restUrl'   => esc_url_raw( rest_url( 'fotogrids/v1/' ) ),
				'restNonce' => wp_create_nonce( 'wp_rest' ),
				'labels'    => array(
					'loading'      => __( 'Loading preview…', 'fotogrids' ),
					'error'        => __( 'The preview could not be loaded.', 'fotogrids' ),
					'noPermission' => __( 'You do not have permission to preview this collection.', 'fotogrids' ),
				),
			)
		);
	}

	/**
	 * Filter callback: detect FotoGrids elements in the Bricks data of the
	 * current request.
	 *
	 * Scans the active header, content and footer, active popups, nested
	 * templates and components, and matches the element names or the
	 * FotoGrids shortcodes.
	 *
	 * @since 1.2.0
	 * @param bool          $detected Previous detection result.
	 * @param \WP_Post|null $post     Current post.
	 * @return bool
	 */
	public static function detect_in_bricks( bool $detected, $post ): bool {
		unset( $post );

		if ( $detected ) {
			return true;
		}

		if ( ! class_exists( '\Bricks\Database' ) ) {
			return false;
		}

		$elements = array();
		foreach ( array( 'header', 'content', 'footer' ) as $area ) {
			$data = \Bricks\Database::get_template_data( $area );
			if ( is_array( $data ) ) {
				$elements = array_merge( $elements, $data );
			}
		}

		$popup_ids = \Bricks\Database::$active_templates['popup'] ?? array();
		foreach ( (array) $popup_ids as $popup_id ) {
			$data = \Bricks\Database::get_data( (int) $popup_id );
			if ( is_array( $data ) ) {
				$elements = array_merge( $elements, $data );
			}
		}

		if ( empty( $elements ) ) {
			return false;
		}

		$nested = \Bricks\Database::get_nested_template_data( $elements );
		if ( is_array( $nested ) ) {
			$elements = array_merge( $elements, $nested );
		}

		$elements = \Bricks\Database::get_component_data( $elements );
		$json     = (string) wp_json_encode( $elements );

		return false !== strpos( $json, '"name":"' . self::GALLERY_ELEMENT . '"' )
			|| false !== strpos( $json, '"name":"' . self::ALBUM_ELEMENT . '"' )
			|| false !== strpos( $json, '[fotogrids_' );
	}
}
