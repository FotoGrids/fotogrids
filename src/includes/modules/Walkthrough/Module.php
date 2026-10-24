<?php
/**
 * Walkthrough module.
 *
 * @package FotoGrids\Modules\Walkthrough
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\Walkthrough;

use FotoGrids\Hooks\Filters_Admin;
use FotoGrids\Hooks\Filters_Settings;
use FotoGrids\Modules\Abstract_Module;

if ( ! defined( 'WPINC' ) ) {
	die;
}

require_once __DIR__ . '/class-walkthrough-state.php';
require_once __DIR__ . '/class-walkthrough-screen.php';

/**
 * Module
 *
 * Guided tours of the gallery editor, the album editor and the Dashboard.
 * Each tour opens by itself for a first-time user and can be replayed.
 *
 * @package FotoGrids\Modules\Walkthrough
 * @since   1.3.0
 */
class Module extends Abstract_Module {

	const SCRIPT_HANDLE = 'fotogrids-module-walkthrough';

	/**
	 * {@inheritdoc}
	 */
	public function get_id(): string {
		return 'walkthrough';
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_name(): string {
		return __( 'Walkthrough', 'fotogrids' );
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_description(): string {
		return __( 'Guided tours of the gallery editor, the album editor and the Dashboard.', 'fotogrids' );
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_contexts(): array {
		return array( 'admin' );
	}

	/**
	 * {@inheritdoc}
	 */
	public function init(): void {
		add_filter( Filters_Admin::USER_PREFERENCES, array( Walkthrough_State::class, 'register_preferences' ) );
		add_filter( Filters_Settings::MODE_TIP_SHOW, array( $this, 'filter_mode_tip' ) );
	}

	/**
	 * Hide the Easy / Advanced upgrade tip on a load where a tour opens.
	 *
	 * @since  1.3.0
	 * @param  mixed $show Whether the tip shows.
	 * @return bool
	 */
	public function filter_mode_tip( $show ): bool {
		return (bool) $show && ! Walkthrough_Screen::opens_by_itself();
	}

	/**
	 * {@inheritdoc}
	 */
	public function enqueue_assets( string $hook ): void {
		$current = Walkthrough_Screen::current();
		if ( null === $current ) {
			return;
		}

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			$this->module_asset_url( 'assets/walkthrough.js' ),
			array( 'react', 'react-dom', 'wp-element', 'wp-i18n', 'fotogrids-global-modal' ),
			FOTOGRIDS_VERSION,
			true
		);
		wp_set_script_translations( self::SCRIPT_HANDLE, 'fotogrids', FOTOGRIDS_PLUGIN_DIR . 'languages' );

		wp_enqueue_style(
			self::SCRIPT_HANDLE,
			$this->module_asset_url( 'assets/walkthrough.css' ),
			array(),
			FOTOGRIDS_VERSION
		);

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'fotogridsWalkthrough',
			array(
				'tour'       => $current['tour'],
				'autoStart'  => $current['auto_start'] ? '1' : '',
				'resume'     => $current['resume'] ? '1' : '',
				'forced'     => $current['forced'] ? '1' : '',
				'state'      => Walkthrough_State::get( get_current_user_id(), $current['tour'] ),
				'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
				'nonce'      => wp_create_nonce( 'fotogrids_admin' ),
				'preference' => Walkthrough_State::PREFERENCE,
			)
		);
	}
}
