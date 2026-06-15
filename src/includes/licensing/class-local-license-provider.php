<?php
/**
 * Local license provider.
 *
 * @package FotoGrids\Licensing
 * @since   1.0.0
 */

namespace FotoGrids\Licensing;

use FotoGrids\License_Manager;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * License provider backed by the in-house License_Manager class.
 *
 * Used as a transitional provider when no other licensing backend is loaded.
 * Read-only - write methods return WP_Error.
 *
 * @since 1.0.0
 */
class Local_License_Provider implements License_Provider {

	public function is_pro_active(): bool {
		return License_Manager::is_pro_active();
	}

	public function can_use( string $feature_id ): bool {
		return License_Manager::feature_enabled( $feature_id );
	}

	public function is_on_plan( string $plan ): bool {
		return $this->is_pro_active();
	}

	public function get_plan(): ?string {
		if ( ! $this->is_pro_active() ) {
			return null;
		}

		$data = License_Manager::get_license_data();

		return isset( $data['plan'] ) && is_string( $data['plan'] )
			? $data['plan']
			: 'pro';
	}

	public function get_license_key(): ?string {
		$key = License_Manager::get_license_key();

		return false === $key ? null : $key;
	}

	public function get_expiry(): ?int {
		$status = License_Manager::get_license_status();

		if ( empty( $status['expires'] ) ) {
			return null;
		}

		$ts = is_numeric( $status['expires'] )
			? (int) $status['expires']
			: strtotime( (string) $status['expires'] );

		return $ts ? $ts : null;
	}

	public function get_id(): string {
		return 'local';
	}

	public function get_details(): array {
		return array();
	}

	public function is_opted_in(): bool {
		return false;
	}

	public function activate_license( string $license_key ) {
		return new \WP_Error(
			'fotogrids_local_activation_unavailable',
			__( 'License activation is unavailable. Make sure FotoGrids Pro is installed and active, then try again.', 'fotogrids' )
		);
	}

	public function deactivate_license() {
		return new \WP_Error(
			'fotogrids_local_deactivation_unavailable',
			__( 'License deactivation is unavailable. Make sure FotoGrids Pro is installed and active, then try again.', 'fotogrids' )
		);
	}
}
