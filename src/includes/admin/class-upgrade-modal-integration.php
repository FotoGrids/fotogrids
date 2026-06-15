<?php
/**
 * FotoGrids Upgrade Modal Integration
 *
 * Handles integration of the upgrade modal into the admin interface
 */

namespace FotoGrids\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


class Upgrade_Modal_Integration {

	/**
	 * Initialize the upgrade modal integration
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'admin_footer', array( __CLASS__, 'render_modal_data' ) );
	}

	/**
	 * Enqueue modal assets on admin pages.
	 *
	 * The global modal init script always enqueues so the Modal imperative
	 * API (window.FotoGridsAdmin.modal) is available on every admin page,
	 * including for Pro users. The upgrade modal stylesheet only enqueues
	 * for non-Pro users since they're the only ones who see it.
	 *
	 * @param string $hook Current admin page hook
	 */
	public static function enqueue_assets( $hook ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		if ( ! is_admin() ) {
			return;
		}

		wp_enqueue_script(
			'fotogrids-global-modal',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/global-modal-init.js',
			array( 'wp-element', 'wp-i18n', 'react', 'react-dom' ),
			FOTOGRIDS_VERSION,
			true
		);

		wp_localize_script(
			'fotogrids-global-modal',
			'fotogridsGlobalSettings',
			array(
				'isPro'     => \FotoGrids\License_Manager::has_pro(),
				'debugMode' => defined( 'WP_DEBUG' ) && WP_DEBUG,
			)
		);

		if ( ! \FotoGrids\License_Manager::has_pro() ) {
			wp_enqueue_style(
				'fotogrids-upgrade-modal',
				FOTOGRIDS_PLUGIN_URL . 'assets/css/upgrade-modal.css',
				array(),
				FOTOGRIDS_VERSION
			);
		}
	}

	/**
	 * Render modal containers and bootstrap data in the admin footer. The
	 * modal-root container always renders so imperative modals can mount;
	 * the upgrade-modal container only renders for non-Pro users.
	 */
	public static function render_modal_data() {
		if ( ! is_admin() ) {
			return;
		}

		$screen            = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$is_fotogrids_page = $screen && \FotoGrids\Admin\Admin_Screen::is_fotogrids( $screen );
		$is_pro            = \FotoGrids\License_Manager::has_pro();
		?>
		<div id="fotogrids-modal-root"></div>
		<?php if ( ! $is_pro ) : ?>
		<div id="fotogrids-upgrade-modal"></div>
		<?php endif; ?>
		<script type="text/javascript">
			window.fotogridsIsPro = <?php echo $is_pro ? 'true' : 'false'; ?>;
			<?php if ( ! $is_pro ) : ?>
			window.fotogridsUpgradeModal = <?php echo wp_json_encode( \FotoGrids\Upgrade_Modal::get_modal_data() ); ?>;
			<?php endif; ?>
			<?php if ( $is_fotogrids_page ) : ?>
			if ( ! window.fotogridsAdmin ) {
				window.fotogridsAdmin = {};
			}
			if ( window.fotogridsAdmin.isFotoGridsPage === undefined ) {
				window.fotogridsAdmin.isFotoGridsPage = true;
			}
			<?php endif; ?>
		</script>
		<?php
	}

	/**
	 * Check if current page is a FotoGrids admin page
	 *
	 * @param string $hook Current admin page hook
	 * @return bool
	 */
	private static function is_fotogrids_admin_page( $hook ) {
		return \FotoGrids\Admin\Admin_Screen::is_fotogrids( $hook );
	}

	/**
	 * Check if modal should be shown (not for Pro users)
	 *
	 * @return bool
	 */
	private static function should_show_modal() {
		// Don't show for Pro users
		if ( \FotoGrids\License_Manager::has_pro() ) {
			return false;
		}

		// Only show on FotoGrids admin pages
		$screen = get_current_screen();
		if ( ! $screen ) {
			return false;
		}

		return self::is_fotogrids_admin_page( $screen->id );
	}

	/**
	 * Add pro feature indicators to admin UI
	 */
	public static function add_pro_indicators() {
		if ( \FotoGrids\License_Manager::has_pro() ) {
			return;
		}

		// Add CSS for pro badges
		?>
		<style>
			.fotogrids-pro-feature-btn {
				position: relative;
			}

			.fotogrids-pro-feature-btn .pro-badge {
				background: linear-gradient(135deg, #6366f1, #8b5cf6);
				color: white;
				font-size: 10px;
				font-weight: 600;
				padding: 2px 6px;
				border-radius: 4px;
				margin-left: 8px;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.fotogrids-pro-feature-btn:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}

			.gallery-limit-notice {
				background: #f3f4f6;
				border: 1px solid #e5e7eb;
				border-radius: 8px;
				padding: 20px;
				margin: 20px 0;
				text-align: center;
			}

			.gallery-limit-notice p {
				margin: 0 0 15px 0;
				color: #6b7280;
			}

			.upgrade-btn {
				background: linear-gradient(135deg, #6366f1, #8b5cf6);
				color: white;
				border: none;
				padding: 12px 24px;
				border-radius: 6px;
				font-weight: 600;
				cursor: pointer;
				transition: transform 0.2s ease;
			}

			.upgrade-btn:hover {
				transform: translateY(-1px);
			}
		</style>
		<?php
	}

	/**
	 * Create upgrade button HTML
	 *
	 * @param string $feature Feature key
	 * @param string $text Button text
	 * @param array $args Additional arguments
	 * @return string Button HTML
	 */
	public static function create_upgrade_button( $feature, $text, $args = array() ) {
		if ( \FotoGrids\License_Manager::has_pro() ) {
			return '';
		}

		$defaults = array(
			'class'      => 'button button-secondary',
			'show_badge' => true,
			'onclick'    => "window.FotoGridsUpgrade && window.FotoGridsUpgrade.launch('{$feature}')",
		);

		$args = wp_parse_args( $args, $defaults );

		$badge = $args['show_badge'] ? '<span class="pro-badge">PRO</span>' : '';

		return sprintf(
			'<button class="fotogrids-pro-feature-btn %s" onclick="%s">%s%s</button>',
			esc_attr( $args['class'] ),
			esc_attr( $args['onclick'] ),
			esc_html( $text ),
			$badge
		);
	}
}
