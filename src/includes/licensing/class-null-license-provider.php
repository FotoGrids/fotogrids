<?php
/**
 * Null license provider.
 *
 * @package FotoGrids\Licensing
 * @since   1.0.0
 */

namespace FotoGrids\Licensing;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Fallback provider used when no licensing backend is configured.
 *
 * Always answers "no Pro, no features, no plan". Implements the null-object
 * pattern so call sites never have to null-check.
 *
 * @since 1.0.0
 */
class Null_License_Provider implements License_Provider {

    public function is_pro_active(): bool {
        return false;
    }

    public function can_use( string $feature_id ): bool {
        return false;
    }

    public function is_on_plan( string $plan ): bool {
        return false;
    }

    public function get_plan(): ?string {
        return null;
    }

    public function get_license_key(): ?string {
        return null;
    }

    public function get_expiry(): ?int {
        return null;
    }

    public function get_id(): string {
        return 'null';
    }

    public function get_details(): array {
        return [];
    }

    public function is_opted_in(): bool {
        return false;
    }

    public function activate_license( string $license_key ) {
        return new \WP_Error(
            'fotogrids_no_provider',
            __( 'License activation is not configured.', 'fotogrids' )
        );
    }

    public function deactivate_license() {
        return new \WP_Error(
            'fotogrids_no_provider',
            __( 'No license is active.', 'fotogrids' )
        );
    }
}
