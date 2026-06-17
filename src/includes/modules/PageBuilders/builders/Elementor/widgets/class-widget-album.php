<?php
/**
 * FotoGrids Album Elementor widget.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Elementor\Widgets
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Elementor\Widgets;

use Elementor\Controls_Manager;
use Elementor\Widget_Base;
use FotoGrids\Modules\PageBuilders\Builders\Elementor\Controls\Album_Picker;
use FotoGrids\Modules\PageBuilders\Builders\Elementor\Module as Elementor_Module;
use FotoGrids\Modules\PageBuilders\Preview_Options;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Minimal v1 widget - picks a published album by ID and delegates to
 * Public_Render::album_shortcode(). Mirrors Widget_Gallery exactly except
 * for the post type queried.
 *
 * @since 1.0.0
 */
class Widget_Album extends Widget_Base {

	/**
	 * Tell Elementor this widget's HTML is dynamic - see
	 * {@see Widget_Gallery::$_has_template_content} for the full reason.
	 *
	 * @var bool
	 */
	protected $_has_template_content = false; // phpcs:ignore PSR2.Classes.PropertyDeclaration.Underscore

	/**
	 * No-op required by Elementor when `$_has_template_content` is false.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function render_plain_content(): void {
	}

	/**
	 * @inheritDoc
	 */
	public function get_name(): string {
		return 'fotogrids-album';
	}

	/**
	 * @inheritDoc
	 */
	public function get_title(): string {
		return __( 'FotoGrids Album', 'fotogrids' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_icon(): string {
		return 'eicon-image-rollover';
	}

	/**
	 * @inheritDoc
	 */
	public function get_categories(): array {
		return array( Elementor_Module::CATEGORY );
	}

	/**
	 * @inheritDoc
	 */
	public function get_keywords(): array {
		return array( 'fotogrids', 'album', 'gallery', 'photo' );
	}

	/**
	 * Define the widget's Elementor controls.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	protected function register_controls(): void {
		$this->start_controls_section(
			'fotogrids_content',
			array(
				'label' => __( 'Album', 'fotogrids' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'album_id',
			array(
				'label'       => __( 'Album', 'fotogrids' ),
				'type'        => Album_Picker::TYPE,
				'default'     => '',
				'label_block' => true,
			)
		);

		$this->end_controls_section();

		// Preview section - editor-only toggles, see Widget_Gallery for
		// the full reasoning. Same control names and defaults for parity.
		$this->start_controls_section(
			'fotogrids_preview',
			array(
				'label' => __( 'Preview', 'fotogrids' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$defaults = Preview_Options::defaults();

		$this->add_control(
			Preview_Options::ATTR_CLICK_BEHAVIOR,
			array(
				'label'        => __( 'Make items clickable', 'fotogrids' ),
				'description'  => __( 'When disabled, item clicks select the widget in the editor instead of opening the album action. Published pages are not affected.', 'fotogrids' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'On', 'fotogrids' ),
				'label_off'    => __( 'Off', 'fotogrids' ),
				'return_value' => 'yes',
				'default'      => $defaults[ Preview_Options::ATTR_CLICK_BEHAVIOR ] ? 'yes' : '',
			)
		);

		$this->add_control(
			Preview_Options::ATTR_PAGINATION,
			array(
				'label'        => __( 'Enable pagination controls', 'fotogrids' ),
				'description'  => __( 'When disabled, pagination controls stay visible but inactive in the editor. Published pages are not affected.', 'fotogrids' ),
				'type'         => Controls_Manager::SWITCHER,
				'label_on'     => __( 'On', 'fotogrids' ),
				'label_off'    => __( 'Off', 'fotogrids' ),
				'return_value' => 'yes',
				'default'      => $defaults[ Preview_Options::ATTR_PAGINATION ] ? 'yes' : '',
			)
		);

		$this->end_controls_section();
	}

	/**
	 * Render the widget on the frontend and in Elementor's preview iframe.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	protected function render(): void {
		$settings = $this->get_settings_for_display();
		$album_id = isset( $settings['album_id'] ) ? absint( $settings['album_id'] ) : 0;

		if ( $album_id <= 0 ) {
			if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				echo '<div class="fotogrids-elementor-empty">'
					. esc_html__( 'Select an album to display.', 'fotogrids' )
					. '</div>';
			}
			return;
		}

		if ( self::is_editor_render() ) {
			// Empty album → short-circuit to a friendly empty-state
			// panel (mirrors the gallery widget). Avoids rendering the
			// empty layout scaffolding + its asset chain in the editor.
			$child_count = class_exists( '\FotoGrids\Gallery_Album_Relations' )
				? count(
					(array) \FotoGrids\Gallery_Album_Relations::get_galleries_for_album(
						$album_id,
						array(
							'orderby' => 'position',
							'order'   => 'ASC',
						)
					)
				)
				: 0;

			if ( 0 === $child_count ) {
				echo '<div class="fg-pb-elementor-preview fg-pb-elementor-preview--empty">'
					. Preview_Renderer::render_empty_state_html( 'album', $album_id ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					. '</div>';
				return;
			}

			$preview_options = Preview_Options::normalise( $settings );
			$html            = Preview_Renderer::render_album_html( $album_id, $preview_options );

			$pagination_off = ( ! $preview_options['pagination'] ) ? ' is-fg-pb-pagination-frozen' : '';
			echo '<div class="fg-pb-elementor-preview' . esc_attr( $pagination_off ) . '">'
				. $html // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				. '</div>';
			return;
		}

		if ( ! method_exists( '\FotoGrids\Public_Render', 'album_shortcode' ) ) {
			return;
		}

		$shortcode_args = array(
			'id' => $album_id,
		);
		echo \FotoGrids\Public_Render::album_shortcode( $shortcode_args ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Mirror of Widget_Gallery::is_editor_render(). Could be lifted to a
	 * trait if a third widget appears.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	private static function is_editor_render(): bool {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}
		$plugin = \Elementor\Plugin::$instance;
		if ( isset( $plugin->editor ) && method_exists( $plugin->editor, 'is_edit_mode' ) && $plugin->editor->is_edit_mode() ) {
			return true;
		}
		if ( isset( $plugin->preview ) && method_exists( $plugin->preview, 'is_preview_mode' ) && $plugin->preview->is_preview_mode() ) {
			return true;
		}
		if ( wp_doing_ajax()
			&& isset( $_REQUEST['action'] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			&& str_starts_with( (string) sanitize_text_field( wp_unslash( $_REQUEST['action'] ) ), 'elementor' ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return true;
		}
		return false;
	}
}
