<?php
/**
 * Licensing toasts.
 *
 * @package FotoGrids\Licensing
 * @since   1.0.0
 */

namespace FotoGrids\Licensing;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Pushes one-shot FotoGrids-styled toast notifications for licensing events.
 *
 * On the page load where the event happens we set a per-user flag; on the
 * next FotoGrids admin page load the flag is read, the toast is queued, and
 * the flag is cleared.
 *
 * @since 1.0.0
 */
class Licensing_Toasts {

	private const META_KEY = 'fotogrids_pending_license_toast';

	/**
	 * Wire the listeners.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function init(): void {
		add_action( 'fs_after_init_plugin_registered_fotogrids', array( __CLASS__, 'mark_just_opted_in' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'maybe_enqueue_pending_toast' ), 99 );
	}

	/**
	 * Set the flag indicating the user just opted in.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function mark_just_opted_in(): void {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return;
		}
		update_user_meta( $user_id, self::META_KEY, 'opted_in' );
	}

	/**
	 * If a pending toast is queued for the current user and we're on a
	 * FotoGrids admin page, push it via the shared toast system and clear
	 * the flag.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function maybe_enqueue_pending_toast(): void {
		if ( ! is_admin() ) {
			return;
		}

		if ( ! \FotoGrids\Admin\Admin_Screen::is_fotogrids() ) {
			return;
		}

		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return;
		}

		$pending = get_user_meta( $user_id, self::META_KEY, true );
		if ( empty( $pending ) ) {
			return;
		}

		delete_user_meta( $user_id, self::META_KEY );

		$message = self::message_for( (string) $pending );
		if ( null === $message ) {
			return;
		}

		wp_add_inline_script(
			'fotogrids-toast-init',
			sprintf(
				'window.fotogridsToast && window.fotogridsToast.success(%s);',
				wp_json_encode( $message )
			)
		);
	}

	/**
	 * Resolve a toast message string for a given pending flag value.
	 *
	 * @since  1.0.0
	 * @param  string $event
	 * @return string|null
	 */
	private static function message_for( string $event ): ?string {
		switch ( $event ) {
			case 'opted_in':
				return __( 'You\'re opted in. Thanks for helping make FotoGrids better.', 'fotogrids' );
			default:
				return null;
		}
	}
}
