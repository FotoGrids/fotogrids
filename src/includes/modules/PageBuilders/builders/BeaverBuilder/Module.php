<?php
/**
 * Beaver Builder sub-module.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder;

use FotoGrids\Hooks\Filters_Page_Builders;
use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules\Album_Module;
use FotoGrids\Modules\PageBuilders\Builders\BeaverBuilder\Modules\Gallery_Module;
use FotoGrids\Render\Internal\Inline_Asset_Emitter;

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
	 * Type of the gallery and album picker field.
	 *
	 * @var string
	 */
	public const FIELD_TYPE = 'fotogrids-collection';

	/**
	 * Script and style handle of the settings-form bundle.
	 *
	 * @var string
	 */
	public const EDITOR_HANDLE = 'fotogrids-pb-beaver-builder-editor';

	/**
	 * Shortcode Beaver Builder uses to insert a saved layout.
	 *
	 * @var string
	 */
	public const INSERT_LAYOUT_SHORTCODE = 'fl_builder_insert_layout';

	/**
	 * How many levels of inserted layouts detection follows.
	 *
	 * @var int
	 */
	private const MAX_INSERT_DEPTH = 3;

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

		add_filter( 'fl_builder_custom_fields', array( self::class, 'register_field' ) );
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue_builder_assets' ) );
		add_action( 'fl_builder_ui_enqueue_scripts', array( self::class, 'enqueue_editor_assets' ) );
		add_filter( 'fl_builder_ajax_layout_response', array( self::class, 'add_ajax_inline_css' ) );
		add_filter( Filters_Page_Builders::HAS_CONTENT, array( self::class, 'detect_in_beaver_builder' ), 10, 2 );
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
	 * Filter callback: register the gallery and album picker field type.
	 *
	 * @since 1.3.0
	 * @param array<string,string> $fields Field templates keyed by field type.
	 * @return array<string,string>
	 */
	public static function register_field( $fields ): array {
		$fields                     = (array) $fields;
		$fields[ self::FIELD_TYPE ] = __DIR__ . '/fields/fotogrids-collection.php';

		return $fields;
	}

	/**
	 * Enqueue the builder stylesheet in every builder document, and the
	 * settings-form bundle when the builder runs without its iframe UI.
	 *
	 * Beaver Builder's iframe UI renders settings forms in the top-level
	 * document and empties that document's script queue after
	 * `wp_enqueue_scripts`, so the bundle reaches it through
	 * `fl_builder_ui_enqueue_scripts` instead.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function enqueue_builder_assets(): void {
		if ( ! class_exists( 'FLBuilderModel' ) || ! \FLBuilderModel::is_builder_active() ) {
			return;
		}

		wp_enqueue_style(
			self::EDITOR_HANDLE,
			self::assets_url() . 'editor.css',
			array(),
			FOTOGRIDS_VERSION
		);

		if ( ! self::uses_iframe_ui() ) {
			self::enqueue_editor_assets();
		}
	}

	/**
	 * Enqueue the settings-form bundle in the document that renders settings forms.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function enqueue_editor_assets(): void {
		wp_enqueue_style( 'wp-components' );
		wp_enqueue_style( \FotoGrids\Modules\PageBuilders\Module::FG_SHARED_STYLE_HANDLE );

		wp_enqueue_script(
			self::EDITOR_HANDLE,
			self::assets_url() . 'editor.js',
			array( 'wp-element', 'wp-components', 'wp-i18n', \FotoGrids\Modules\PageBuilders\Module::FG_ICONS_SCRIPT_HANDLE ),
			FOTOGRIDS_VERSION,
			true
		);
		wp_set_script_translations( self::EDITOR_HANDLE, 'fotogrids', FOTOGRIDS_PLUGIN_DIR . 'languages' );

		wp_localize_script(
			self::EDITOR_HANDLE,
			'fotogridsPbBeaverBuilder',
			array(
				'restUrl'          => esc_url_raw( rest_url( 'fotogrids/v1/' ) ),
				'restNonce'        => wp_create_nonce( 'wp_rest' ),
				'galleryCreateUrl' => admin_url( 'post-new.php?post_type=fotogrids_gallery' ),
				'albumCreateUrl'   => admin_url( 'post-new.php?post_type=fotogrids_album' ),
				'galleryEditBase'  => admin_url( 'post.php?action=edit&post=' ),
				'albumEditBase'    => admin_url( 'post.php?action=edit&post=' ),
			)
		);
	}

	/**
	 * Filter callback: detect FotoGrids modules, or FotoGrids shortcodes inside
	 * any module, in the Beaver Builder layout of the current post, and in the
	 * saved layouts it inserts with `[fl_builder_insert_layout]`.
	 *
	 * Reads the draft layout while the builder is open and the published
	 * layout otherwise. A post that does not use the builder is checked for
	 * inserted layouts in its content.
	 *
	 * @since 1.3.0
	 * @param bool          $detected Previous detection result.
	 * @param \WP_Post|null $post     Current post.
	 * @return bool
	 */
	public static function detect_in_beaver_builder( bool $detected, $post ): bool {
		if ( $detected ) {
			return true;
		}

		if ( ! $post instanceof \WP_Post || ! class_exists( 'FLBuilderModel' ) ) {
			return false;
		}

		if ( ! get_post_meta( $post->ID, '_fl_builder_enabled', true ) ) {
			return self::inserted_layouts_have_fotogrids_content( (string) $post->post_content, 0 );
		}

		$status = \FLBuilderModel::is_builder_active() ? 'draft' : 'published';

		return self::layout_has_fotogrids_content( \FLBuilderModel::get_layout_data( $status, $post->ID ) );
	}

	/**
	 * Whether Beaver Builder layout data holds a FotoGrids module or shortcode,
	 * directly or in a saved layout it inserts.
	 *
	 * @since 1.3.0
	 * @param mixed $layout_data Layout nodes keyed by node ID.
	 * @param int   $depth       Levels of inserted layouts above this one.
	 * @return bool
	 */
	public static function layout_has_fotogrids_content( $layout_data, int $depth = 0 ): bool {
		if ( empty( $layout_data ) ) {
			return false;
		}

		$json = (string) wp_json_encode( $layout_data );

		if ( false !== strpos( $json, '"type":"' . self::GALLERY_MODULE . '"' )
			|| false !== strpos( $json, '"type":"' . self::ALBUM_MODULE . '"' )
			|| false !== strpos( $json, '[fotogrids_' )
		) {
			return true;
		}

		$needle = '[' . self::INSERT_LAYOUT_SHORTCODE;
		if ( false === strpos( $json, $needle ) ) {
			return false;
		}

		$settings = json_decode( $json, true );
		$contents = array();
		if ( is_array( $settings ) ) {
			array_walk_recursive(
				$settings,
				static function ( $value ) use ( $needle, &$contents ) {
					if ( is_string( $value ) && false !== strpos( $value, $needle ) ) {
						$contents[] = $value;
					}
				}
			);
		}

		foreach ( $contents as $content ) {
			if ( self::inserted_layouts_have_fotogrids_content( $content, $depth ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * IDs of the posts whose layouts `[fl_builder_insert_layout]` shortcodes
	 * in the given content insert, by their `id` or `slug` attribute.
	 *
	 * @since 1.3.0
	 * @param string $content Content that may hold the shortcode.
	 * @return int[]
	 */
	public static function inserted_layout_ids( string $content ): array {
		if ( false === strpos( $content, '[' . self::INSERT_LAYOUT_SHORTCODE ) ) {
			return array();
		}

		$pattern = '/' . get_shortcode_regex( array( self::INSERT_LAYOUT_SHORTCODE ) ) . '/';
		if ( ! preg_match_all( $pattern, $content, $matches, PREG_SET_ORDER ) ) {
			return array();
		}

		$ids = array();
		foreach ( $matches as $match ) {
			if ( '[' === $match[1] && ']' === $match[6] ) {
				continue;
			}

			$atts = shortcode_parse_atts( $match[3] );
			if ( ! is_array( $atts ) ) {
				continue;
			}

			if ( isset( $atts['id'] ) ) {
				$ids = array_merge( $ids, wp_parse_id_list( $atts['id'] ) );
			} elseif ( ! empty( $atts['slug'] ) ) {
				$ids = array_merge(
					$ids,
					get_posts(
						array(
							'name'           => (string) $atts['slug'],
							'post_type'      => isset( $atts['type'] ) ? (string) $atts['type'] : get_post_types(),
							'posts_per_page' => 10,
							'fields'         => 'ids',
							'no_found_rows'  => true,
						)
					)
				);
			}
		}

		return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
	}

	/**
	 * Whether a saved layout inserted by the given content holds FotoGrids
	 * content.
	 *
	 * @param string $content Content that may hold `[fl_builder_insert_layout]`.
	 * @param int    $depth   Levels of inserted layouts above the content.
	 * @return bool
	 */
	private static function inserted_layouts_have_fotogrids_content( string $content, int $depth ): bool {
		if ( $depth >= self::MAX_INSERT_DEPTH || ! class_exists( 'FLBuilderModel' ) ) {
			return false;
		}

		foreach ( self::inserted_layout_ids( $content ) as $layout_id ) {
			if ( self::layout_has_fotogrids_content( \FLBuilderModel::get_layout_data( 'published', $layout_id ), $depth + 1 ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Filter callback: ship the per-render inline CSS of a builder AJAX render
	 * with the response.
	 *
	 * Beaver Builder re-renders layout parts over AJAX and adds the response's
	 * `scriptsStyles` markup to the page, so the CSS held by the emitter goes
	 * there. Covers the FotoGrids modules and FotoGrids shortcodes in any module.
	 *
	 * @since 1.3.0
	 * @param array<string,mixed> $response Beaver Builder layout response.
	 * @return array<string,mixed>
	 */
	public static function add_ajax_inline_css( $response ) {
		$css = Inline_Asset_Emitter::take_ajax_inline_css();
		if ( '' === $css || ! is_array( $response ) ) {
			return $response;
		}

		$scripts_styles            = isset( $response['scriptsStyles'] ) && is_string( $response['scriptsStyles'] ) ? $response['scriptsStyles'] : '';
		$response['scriptsStyles'] = $scripts_styles . '<style class="fotogrids-inline-css">' . str_replace( '</', '<\\/', $css ) . '</style>';

		return $response;
	}

	/**
	 * Whether the current request belongs to Beaver Builder's iframe UI, either
	 * its top-level document or the layout iframe.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	private static function uses_iframe_ui(): bool {
		return class_exists( 'FLBuilderUIIFrame' )
			&& ( \FLBuilderUIIFrame::is_ui_request() || \FLBuilderUIIFrame::is_iframe_request() );
	}

	/**
	 * URL of the sub-module's built assets.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	private static function assets_url(): string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/BeaverBuilder/assets/';
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
