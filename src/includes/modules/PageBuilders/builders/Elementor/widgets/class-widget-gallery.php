<?php
/**
 * FotoGrids Gallery Elementor widget.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Elementor\Widgets
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Elementor\Widgets;

use Elementor\Controls_Manager;
use Elementor\Widget_Base;
use FotoGrids\Modules\PageBuilders\Builders\Elementor\Controls\Gallery_Picker;
use FotoGrids\Modules\PageBuilders\Builders\Elementor\Module as Elementor_Module;
use FotoGrids\Modules\PageBuilders\Preview_Options;
use FotoGrids\Modules\PageBuilders\Preview_Renderer;
use FotoGrids\Render\Api\Request_Source;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Minimal v1 widget. One picker control (rich Select2 + Browse-all
 * modal), everything else uses the gallery's own saved settings.
 * Render is delegated to `Public_Render::gallery_shortcode()` with
 * `_source = ELEMENTOR` so every decorator/feature/layout works
 * uniformly inside Elementor.
 *
 * @since 1.0.0
 */
class Widget_Gallery extends Widget_Base {

	/**
	 * Tell Elementor this widget's HTML is dynamic - do NOT cache it into
	 * the template-content store and serve the cached copy on later page
	 * loads. Our render is the entry point that populates Asset_Resolver
	 * with the per-render CSS/JS handles, so it must run on every request
	 * the widget appears on. Without this, the first save bakes the HTML
	 * into the page cache and subsequent frontend hits ship stale HTML
	 * with no FotoGrids assets.
	 *
	 * @var bool
	 */
	protected $_has_template_content = false; // phpcs:ignore PSR2.Classes.PropertyDeclaration.Underscore

	/**
	 * Required companion to `$_has_template_content = false`. Elementor's
	 * cache layer calls this when building the cached representation; we
	 * return nothing so nothing gets cached. The real markup is produced
	 * by `render()` on each request.
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
		return 'fotogrids-gallery';
	}

	/**
	 * @inheritDoc
	 */
	public function get_title(): string {
		return __( 'FotoGrids Gallery', 'fotogrids' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_icon(): string {
		return 'fg-eicon-gallery';
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
		return array( 'fotogrids', 'gallery', 'photo', 'image', 'grid' );
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
				'label' => __( 'Gallery', 'fotogrids' ),
				'tab'   => Controls_Manager::TAB_CONTENT,
			)
		);

		$this->add_control(
			'gallery_id',
			array(
				'label'       => __( 'Gallery', 'fotogrids' ),
				'type'        => Gallery_Picker::TYPE,
				'default'     => '',
				'label_block' => true,
			)
		);

		$this->end_controls_section();

		// ---------------------------------------------------------------------
		// Preview section - editor-only toggles. These affect only how the
		// gallery looks INSIDE Elementor's editor preview; the published page
		// is never affected. Persisted as widget settings under the canonical
		// {@see Preview_Options::ATTR_*} keys so the same names work across
		// every page-builder host.
		// ---------------------------------------------------------------------
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
				'description'  => __( 'When disabled, item clicks select the widget in the editor instead of opening the gallery action. Published pages are not affected.', 'fotogrids' ),
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
	 * Delegates to the existing shortcode renderer so the public-page
	 * pipeline stays a single code path. Every decorator, feature and
	 * layout module works inside Elementor without further glue.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	protected function render(): void {
		$settings   = $this->get_settings_for_display();
		$gallery_id = isset( $settings['gallery_id'] ) ? absint( $settings['gallery_id'] ) : 0;

		if ( $gallery_id <= 0 ) {
			if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				echo '<div class="fotogrids-elementor-empty">'
					. esc_html__( 'Select a gallery to display.', 'fotogrids' )
					. '</div>';
			}
			return;
		}

		// Editor & preview iframe go through the shared preview renderer
		// so the click-behavior / pagination toggles take effect. The
		// public frontend stays on the shortcode path for cache
		// friendliness - Preview_Options is editor-only by design.
		if ( self::is_editor_render() ) {
			// Empty gallery → skip the layout pipeline (which would
			// emit an empty scaffold plus several CSS/JS asset enqueues)
			// and render a friendly empty-state panel with a deep-link
			// back to the gallery edit screen.
			$item_count = class_exists( '\FotoGrids\Galleries\Gallery_Repository' )
				? count( (array) \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id ) )
				: 0;

			if ( 0 === $item_count ) {
				echo '<div class="fg-pb-elementor-preview fg-pb-elementor-preview--empty">'
					. Preview_Renderer::render_empty_state_html( 'gallery', $gallery_id ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					. '</div>';
				return;
			}

			$preview_options = Preview_Options::normalise( $settings );
			$html            = Preview_Renderer::render_gallery_html( $gallery_id, $preview_options );

			// Wrap so the editor.js capture-phase pagination guard has a
			// stable hook to bind to; the class signals "this output
			// honours preview_pagination=false" to the JS side.
			$pagination_off = ( ! $preview_options['pagination'] ) ? ' is-fg-pb-pagination-frozen' : '';
			echo '<div class="fg-pb-elementor-preview' . esc_attr( $pagination_off ) . '">'
				. $html // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				. '</div>';
			return;
		}

		if ( ! method_exists( '\FotoGrids\Public_Render', 'gallery_shortcode' ) ) {
			return;
		}

		$shortcode_args = array(
			'id'      => $gallery_id,
			'_source' => Request_Source::ELEMENTOR,
		);
		echo \FotoGrids\Public_Render::gallery_shortcode( $shortcode_args ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * True when Elementor is rendering the widget for the editor canvas
	 * or the preview iframe, false on the published frontend.
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
