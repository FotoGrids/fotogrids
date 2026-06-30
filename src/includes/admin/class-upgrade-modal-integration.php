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

		$screen            = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$is_fotogrids_page = $screen && \FotoGrids\Admin\Admin_Screen::is_fotogrids( $screen );
		$is_pro            = \FotoGrids\License_Manager::has_pro();

		$bootstrap = 'window.fotogridsIsPro = ' . ( $is_pro ? 'true' : 'false' ) . ';';
		if ( ! $is_pro ) {
			$bootstrap .= 'window.fotogridsUpgradeModal = ' . wp_json_encode( \FotoGrids\Upgrade_Modal::get_modal_data() ) . ';';
		}
		if ( $is_fotogrids_page ) {
			$bootstrap .= 'window.fotogridsAdmin = window.fotogridsAdmin || {};';
			$bootstrap .= 'if ( window.fotogridsAdmin.isFotoGridsPage === undefined ) { window.fotogridsAdmin.isFotoGridsPage = true; }';
		}

		wp_add_inline_script( 'fotogrids-global-modal', $bootstrap, 'before' );
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

		$is_pro = \FotoGrids\License_Manager::has_pro();
		?>
		<div id="fotogrids-modal-root"></div>
		<?php if ( ! $is_pro ) : ?>
		<div id="fotogrids-upgrade-modal"></div>
		<?php endif; ?>
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
}
