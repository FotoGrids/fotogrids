<?php
/**
 * Deactivation feedback popup wiring for the Plugins screen.
 *
 * @package FotoGrids\Admin
 * @since   1.0.0
 */

namespace FotoGrids\Admin;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders a FotoGrids-branded feedback popup when the user deactivates the
 * Free plugin, and forwards the chosen reason to Freemius so it appears in
 * the developer dashboard.
 *
 * The stock Freemius deactivation dialog is suppressed; this feature reuses
 * the always-on FotoGrids admin modal (window.FotoGridsAdmin.modal) which is
 * present on every admin page, including plugins.php.
 *
 * @since 1.0.0
 */
class Deactivation_Feedback {

	/**
	 * Freemius AJAX tag whose handler stores the uninstall reason.
	 *
	 * @var string
	 */
	private const FREEMIUS_TAG = 'submit_uninstall_reason';

	/**
	 * Snooze length applied when the user picks "temporary deactivation",
	 * in seconds. Mirrors a Freemius-offered period (24 hours).
	 *
	 * @var int
	 */
	private const SNOOZE_PERIOD = DAY_IN_SECONDS;

	/**
	 * Register hooks.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function init(): void {
		self::suppress_stock_form();
		// Priority 20: after the global modal script (priority 10) has registered
		// so the dependency resolves.
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 20 );
	}

	/**
	 * Hide the stock Freemius deactivation dialog so the Deactivate link stays
	 * a plain link this feature can intercept.
	 *
	 * The Freemius filter is evaluated on `admin_footer`, so registering it
	 * during `plugins_loaded` (when this runs) is in time.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function suppress_stock_form(): void {
		$fs = self::freemius();
		if ( null !== $fs ) {
			$fs->add_filter( 'show_deactivation_feedback_form', '__return_false' );
		}
	}

	/**
	 * Enqueue the popup script on the Plugins screen only.
	 *
	 * Skips enqueuing while deactivation feedback is snoozed, so the Deactivate
	 * link deactivates immediately without a popup - matching Freemius's own
	 * snooze behaviour.
	 *
	 * @since 1.0.0
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public static function enqueue_assets( string $hook ): void {
		if ( 'plugins.php' !== $hook ) {
			return;
		}

		$fs = self::freemius();
		if ( null === $fs ) {
			return;
		}

		if ( class_exists( '\Freemius' ) && \Freemius::is_deactivation_snoozed() ) {
			return;
		}

		$deps = array( 'react', 'react-dom', 'wp-element', 'wp-components', 'wp-i18n' );
		if ( wp_script_is( 'fotogrids-global-modal', 'registered' ) ) {
			$deps[] = 'fotogrids-global-modal';
		}

		wp_enqueue_script(
			'fotogrids-deactivation-feedback',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/deactivation-feedback.js',
			$deps,
			FOTOGRIDS_VERSION,
			true
		);

		// The full FotoGrids admin stylesheet only loads on FotoGrids screens,
		// so the modal styles are enqueued standalone here for the Plugins page.
		wp_enqueue_style(
			'fotogrids-fg-modal',
			FOTOGRIDS_PLUGIN_URL . 'assets/css/fg-modal-styles.css',
			array( 'wp-components' ),
			FOTOGRIDS_VERSION
		);

		wp_set_script_translations( 'fotogrids-deactivation-feedback', 'fotogrids', FOTOGRIDS_PLUGIN_DIR . 'languages' );

		wp_localize_script(
			'fotogrids-deactivation-feedback',
			'fotogridsDeactivation',
			array(
				'pluginBasename' => defined( 'FOTOGRIDS_PLUGIN_BASENAME' ) ? FOTOGRIDS_PLUGIN_BASENAME : '',
				'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
				'action'         => $fs->get_ajax_action( self::FREEMIUS_TAG ),
				'security'       => $fs->get_ajax_security( self::FREEMIUS_TAG ),
				'snoozePeriod'   => self::SNOOZE_PERIOD,
				'reasons'        => self::reasons(),
				'i18n'           => array(
					'title'        => __( 'Quick question before you go', 'fotogrids' ),
					'intro'        => __( 'If you have a moment, please let us know why you are deactivating FotoGrids. It helps us improve.', 'fotogrids' ),
					'submitLabel'  => __( 'Submit & Deactivate', 'fotogrids' ),
					'skipLabel'    => __( 'Skip & Deactivate', 'fotogrids' ),
					'cancelLabel'  => __( 'Cancel', 'fotogrids' ),
					'detailsLabel' => __( 'Tell us more', 'fotogrids' ),
				),
			)
		);
	}

	/**
	 * The reason list, mirroring Freemius's long-term-user taxonomy so the
	 * dashboard buckets responses correctly. The `id` values are Freemius
	 * REASON_* constant values.
	 *
	 * @since 1.0.0
	 * @return array<int,array<string,mixed>>
	 */
	private static function reasons(): array {
		return array(
			array(
				'id'   => 1,
				'text' => __( 'I no longer need the plugin', 'fotogrids' ),
			),
			array(
				'id'          => 2,
				'text'        => __( 'I found a better plugin', 'fotogrids' ),
				'placeholder' => __( "What's the plugin's name?", 'fotogrids' ),
			),
			array(
				'id'   => 3,
				'text' => __( 'I only needed the plugin for a short period', 'fotogrids' ),
			),
			array(
				'id'   => 4,
				'text' => __( 'The plugin broke my site', 'fotogrids' ),
			),
			array(
				'id'   => 5,
				'text' => __( 'The plugin suddenly stopped working', 'fotogrids' ),
			),
			array(
				'id'     => 15,
				'text'   => __( "It's a temporary deactivation - I'm troubleshooting an issue", 'fotogrids' ),
				'snooze' => true,
			),
			array(
				'id'          => 7,
				'text'        => __( 'Other', 'fotogrids' ),
				'placeholder' => __( 'Please share the reason', 'fotogrids' ),
			),
		);
	}

	/**
	 * Resolve the Freemius SDK instance for the Free plugin.
	 *
	 * @since  1.0.0
	 * @return \Freemius|null
	 */
	private static function freemius(): ?\Freemius {
		if ( ! function_exists( 'freemius' ) ) {
			return null;
		}

		$instance = freemius( 'fotogrids' );

		return $instance instanceof \Freemius ? $instance : null;
	}
}
