<?php
/**
 * License_Provider interface.
 *
 * @package FotoGrids\Licensing
 * @since   1.0.0
 */

namespace FotoGrids\Licensing;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Contract for a licensing backend.
 *
 * Implementations answer entitlement and license-management questions for
 * the rest of the codebase. Call sites should reach providers through
 * License_Manager rather than instantiating providers directly.
 *
 * @since 1.0.0
 */
interface License_Provider {

    /**
     * Whether Pro features are available on this site.
     *
     * @since  1.0.0
     * @return bool
     */
    public function is_pro_active(): bool;

    /**
     * Whether the current user can use a specific Pro feature.
     *
     * @since  1.0.0
     * @param  string $feature_id Stable feature identifier (snake_case).
     * @return bool
     */
    public function can_use( string $feature_id ): bool;

    /**
     * Whether the current site is on a given plan or higher.
     *
     * @since  1.0.0
     * @param  string $plan Plan slug.
     * @return bool
     */
    public function is_on_plan( string $plan ): bool;

    /**
     * Current plan slug, or null when no plan is active.
     *
     * @since  1.0.0
     * @return string|null
     */
    public function get_plan(): ?string;

    /**
     * Stored license key, or null when not applicable.
     *
     * @since  1.0.0
     * @return string|null
     */
    public function get_license_key(): ?string;

    /**
     * License expiry as a Unix timestamp, or null when unknown / lifetime.
     *
     * @since  1.0.0
     * @return int|null
     */
    public function get_expiry(): ?int;

    /**
     * Stable provider identifier (e.g. 'freemius', 'local', 'null').
     *
     * @since  1.0.0
     * @return string
     */
    public function get_id(): string;

    /**
     * Extra licensing details (activations, quota, cancelled flag, account
     * email). Returns an associative array; missing keys map to null.
     *
     * @since  1.0.0
     * @return array<string,mixed>
     */
    public function get_details(): array;

    /**
     * Whether the current site is opted in to the licensing backend's
     * usage-tracking flow.
     *
     * @since  1.0.0
     * @return bool
     */
    public function is_opted_in(): bool;

    /**
     * Activate a license key against the provider.
     *
     * @since  1.0.0
     * @param  string $license_key
     * @return true|\WP_Error
     */
    public function activate_license( string $license_key );

    /**
     * Deactivate the current site's license.
     *
     * @since  1.0.0
     * @return true|\WP_Error
     */
    public function deactivate_license();
}
