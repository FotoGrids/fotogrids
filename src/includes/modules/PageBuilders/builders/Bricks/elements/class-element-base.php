<?php
/**
 * Shared base for the FotoGrids Bricks elements.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements
 * @since   1.2.0
 */

namespace FotoGrids\Modules\PageBuilders\Builders\Bricks\Elements;

use FotoGrids\Modules\PageBuilders\Builders\Bricks\Module as Bricks_Module;
use FotoGrids\Modules\PageBuilders\Preview_Options;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Base Bricks element for a FotoGrids collection.
 *
 * Holds the collection ID in a text control and renders the collection
 * through the shortcode pipeline on the front end.
 *
 * @since 1.2.0
 */
abstract class Element_Base extends \Bricks\Element {

	/**
	 * Setting key holding the collection ID.
	 *
	 * @var string
	 */
	public const SETTING_ID = 'fgCollectionId';

	/**
	 * Control key of the picker placeholder.
	 *
	 * @var string
	 */
	public const PICKER_CONTROL = 'fgPicker';

	/**
	 * Setting key of the collection source (picker or dynamic).
	 *
	 * @var string
	 */
	public const SOURCE_SETTING = 'fgCollectionSource';

	/**
	 * Setting key of the dynamic collection ID.
	 *
	 * @var string
	 */
	public const DYNAMIC_SETTING = 'fgCollectionIdDynamic';

	/**
	 * Control key of the standalone create button shown in dynamic mode.
	 *
	 * @var string
	 */
	public const CREATE_CONTROL = 'fgCreateNew';

	/**
	 * Control group of the builder-only preview toggles.
	 *
	 * @var string
	 */
	public const PREVIEW_GROUP = 'fgPreview';

	/**
	 * Builder panel category.
	 *
	 * @var string
	 */
	public $category = Bricks_Module::CATEGORY;

	/**
	 * Canvas functions Bricks calls with the element root after each render.
	 *
	 * @var array<int,string>
	 */
	public $scripts = array( Bricks_Module::CANVAS_INIT_FUNCTION );

	/**
	 * Collection kind rendered by the element.
	 *
	 * @since 1.2.0
	 * @return string 'gallery' or 'album'.
	 */
	abstract protected function get_kind(): string;

	/**
	 * Number of items (gallery) or child galleries (album) in the collection.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Collection post ID.
	 * @return int
	 */
	abstract protected function get_item_count( int $collection_id ): int;

	/**
	 * Label of the collection ID control.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	abstract protected function get_id_label(): string;

	/**
	 * Builder placeholder title shown before a collection is chosen.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	abstract protected function get_empty_title(): string;

	/**
	 * Builder placeholder title shown for a chosen collection.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Collection post ID.
	 * @return string
	 */
	abstract protected function get_selected_title( int $collection_id ): string;

	/**
	 * Render the collection markup for the front end.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Collection post ID.
	 * @return string
	 */
	abstract protected function render_collection( int $collection_id ): string;

	/**
	 * Whether the collection ID can come from dynamic data.
	 *
	 * @since 1.2.0
	 * @return bool
	 */
	protected function has_dynamic_source(): bool {
		return false;
	}

	/**
	 * Label of the source option that uses the picker.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_picker_source_label(): string {
		return '';
	}

	/**
	 * Search keywords for the builder panel.
	 *
	 * @since 1.2.0
	 * @return array<int,string>
	 */
	public function get_keywords() {
		return array( 'fotogrids', 'gallery', 'album', 'photo', 'image' );
	}

	/**
	 * Register the element control groups.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public function set_control_groups() {
		$this->control_groups[ self::PREVIEW_GROUP ] = array(
			'title' => esc_html__( 'Preview', 'fotogrids' ),
			'tab'   => 'content',
		);
	}

	/**
	 * Register the element controls.
	 *
	 * Keys are prefixed or use the canonical preview keys: Bricks scans the
	 * page settings JSON for generic quoted keys such as `"lightbox"`.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public function set_controls() {
		$picker_only = array();

		if ( $this->has_dynamic_source() ) {
			$this->controls[ self::SOURCE_SETTING ] = array(
				'tab'       => 'content',
				'type'      => 'select',
				'label'     => esc_html__( 'Source', 'fotogrids' ),
				'options'   => array(
					'picker'  => $this->get_picker_source_label(),
					'dynamic' => esc_html__( 'Dynamic', 'fotogrids' ),
				),
				'default'   => 'picker',
				'inline'    => true,
				'clearable' => false,
				'rerender'  => true,
			);

			$picker_only = array( 'required' => array( self::SOURCE_SETTING, '!=', 'dynamic' ) );
		}

		$this->controls[ self::PICKER_CONTROL ] = array(
			'tab'     => 'content',
			'type'    => 'info',
			'content' => $this->picker_placeholder( 'picker' ),
		) + $picker_only;

		$this->controls[ self::SETTING_ID ] = array(
			'tab'            => 'content',
			'type'           => 'text',
			'label'          => $this->get_id_label(),
			'hasDynamicData' => false,
			'rerender'       => true,
		) + $picker_only;

		if ( $this->has_dynamic_source() ) {
			$dynamic_only = array( 'required' => array( self::SOURCE_SETTING, '=', 'dynamic' ) );

			$this->controls[ self::DYNAMIC_SETTING ] = array(
				'tab'            => 'content',
				'type'           => 'text',
				'label'          => $this->get_dynamic_id_label(),
				'description'    => $this->get_dynamic_id_description(),
				'hasDynamicData' => 'text',
				'rerender'       => true,
			) + $dynamic_only;

			$this->controls[ self::CREATE_CONTROL ] = array(
				'tab'     => 'content',
				'type'    => 'info',
				'content' => $this->picker_placeholder( 'create' ),
			) + $dynamic_only;
		}

		$this->controls[ Preview_Options::ATTR_CLICK_BEHAVIOR ] = array(
			'tab'         => 'content',
			'group'       => self::PREVIEW_GROUP,
			'type'        => 'checkbox',
			'label'       => esc_html__( 'Make items clickable', 'fotogrids' ),
			'description' => esc_html__( 'When disabled, item clicks select the element in the builder instead of opening the gallery action. Published pages are not affected.', 'fotogrids' ),
			'rerender'    => true,
		);

		$this->controls[ Preview_Options::ATTR_PAGINATION ] = array(
			'tab'         => 'content',
			'group'       => self::PREVIEW_GROUP,
			'type'        => 'checkbox',
			'label'       => esc_html__( 'Enable pagination controls', 'fotogrids' ),
			'description' => esc_html__( 'When disabled, pagination controls stay visible but inactive in the builder. Published pages are not affected.', 'fotogrids' ),
			'rerender'    => true,
		);
	}

	/**
	 * Label of the dynamic collection ID control.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_dynamic_id_label(): string {
		return '';
	}

	/**
	 * Description of the dynamic collection ID control.
	 *
	 * @since 1.2.0
	 * @return string
	 */
	protected function get_dynamic_id_description(): string {
		return '';
	}

	/**
	 * Placeholder the panel bundle mounts the picker card into.
	 *
	 * @since 1.2.0
	 * @param string $mode 'picker' for the full card, 'create' for the create button only.
	 * @return string
	 */
	private function picker_placeholder( string $mode ): string {
		return sprintf(
			'<div class="fg-pb-bricks-picker" data-fg-picker-kind="%1$s" data-fg-picker-mode="%2$s"></div>',
			esc_attr( $this->get_kind() ),
			esc_attr( $mode )
		);
	}

	/**
	 * Collection ID from the picker or, in dynamic mode, from resolved dynamic data.
	 *
	 * @since 1.2.0
	 * @return int
	 */
	private function get_collection_id(): int {
		if ( $this->has_dynamic_source() && 'dynamic' === ( $this->settings[ self::SOURCE_SETTING ] ?? '' ) ) {
			return absint( $this->render_dynamic_data( (string) ( $this->settings[ self::DYNAMIC_SETTING ] ?? '' ) ) );
		}

		return absint( $this->settings[ self::SETTING_ID ] ?? 0 );
	}

	/**
	 * Enqueue the canvas preview script in the builder canvas.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public function enqueue_scripts() {
		if ( function_exists( 'bricks_is_builder_iframe' ) && bricks_is_builder_iframe() ) {
			Bricks_Module::enqueue_canvas_assets();
		}
	}

	/**
	 * Render the element.
	 *
	 * @since 1.2.0
	 * @return void
	 */
	public function render() {
		$collection_id = $this->get_collection_id();

		if ( ! $this->is_frontend ) {
			$this->render_canvas_markup( $collection_id );
			return;
		}

		if ( ! $collection_id ) {
			return;
		}

		$markup = $this->render_collection( $collection_id );
		if ( '' === $markup ) {
			return;
		}

		$this->print_root( $markup );
	}

	/**
	 * Render the builder canvas markup.
	 *
	 * The collection itself is fetched from the preview REST route by the
	 * canvas script, which Bricks runs after every render.
	 *
	 * @since 1.2.0
	 * @param int $collection_id Collection post ID.
	 * @return void
	 */
	private function render_canvas_markup( int $collection_id ): void {
		if ( ! $collection_id ) {
			$this->render_element_placeholder( array( 'title' => $this->get_empty_title() ) );
			return;
		}

		$kind = $this->get_kind();

		if ( 0 === $this->get_item_count( $collection_id ) ) {
			$this->print_root(
				'<div class="fg-pb-bricks-preview fg-pb-bricks-preview--empty">' . Preview_Renderer::render_empty_state_html( $kind, $collection_id ) . '</div>',
				array( 'style' => array() )
			);
			return;
		}

		$preview_options = Preview_Options::normalise( $this->settings );

		$this->print_root(
			sprintf(
				'<div class="fg-pb-bricks-preview%1$s" data-fg-bricks-kind="%2$s" data-fg-bricks-id="%3$d" data-fg-bricks-click="%4$s" data-fg-bricks-pagination="%5$s"><div class="fg-pb-bricks-preview__status">%6$s</div></div>',
				$preview_options['pagination'] ? '' : ' is-fg-pb-pagination-frozen',
				esc_attr( $kind ),
				$collection_id,
				$preview_options['click_behavior'] ? '1' : '0',
				$preview_options['pagination'] ? '1' : '0',
				esc_html( $this->get_selected_title( $collection_id ) )
			)
		);
	}

	/**
	 * Print markup inside the element's root tag.
	 *
	 * @since 1.2.0
	 * @param string                           $markup      Inner markup.
	 * @param array<string,array<string,bool>> $extra_tags  Tags allowed in addition to the FotoGrids rules.
	 * @return void
	 */
	private function print_root( string $markup, array $extra_tags = array() ): void {
		echo '<div ' . $this->render_attributes( '_root' ) . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Bricks escapes each attribute value in render_attributes().
		echo wp_kses( $markup, array_merge( \FotoGrids\Kses::rules( $markup ), $extra_tags ) );
		echo '</div>';
	}
}
