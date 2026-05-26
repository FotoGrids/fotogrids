<?php
/**
 * Freemius license provider.
 *
 * @package FotoGrids\Licensing
 * @since   1.0.0
 */

namespace FotoGrids\Licensing;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * License provider backed by the Freemius SDK.
 *
 * Active when the Freemius SDK is loaded. Per-feature gating goes through
 * the `fotogrids/licensing/feature_plan_map` filter so plan slugs aren't
 * hard-coded at call sites.
 *
 * @since 1.0.0
 */
class Freemius_License_Provider implements License_Provider {

    /**
     * Per-request cache of the feature -> plan map.
     *
     * @var array<string,string>|null
     */
    private ?array $feature_plan_map = null;

    /**
     * Resolve the Freemius SDK instance for this product.
     *
     * @since  1.0.0
     * @return \Freemius|null
     */
    private function fs(): ?\Freemius {
        if ( ! function_exists( 'freemius' ) ) {
            return null;
        }

        $instance = freemius( 'fotogrids' );

        return $instance instanceof \Freemius ? $instance : null;
    }

    public function is_pro_active(): bool {
        $fs = $this->fs();
        if ( ! $fs ) {
            return false;
        }

        return $fs->can_use_premium_code();
    }

    public function can_use( string $feature_id ): bool {
        $fs = $this->fs();
        if ( ! $fs ) {
            return false;
        }

        $map = $this->get_feature_plan_map();
        if ( isset( $map[ $feature_id ] ) ) {
            return $this->is_on_plan( $map[ $feature_id ] );
        }

        return $fs->can_use_premium_code();
    }

    public function is_on_plan( string $plan ): bool {
        if ( $plan === 'free' ) {
            return true;
        }

        $fs = $this->fs();
        if ( ! $fs ) {
            \FotoGrids\Debug_Log::write( 'license', sprintf( 'Freemius unavailable for plan check: %s', $plan ) );
            return false;
        }

        $freemius_slugs = $this->resolve_freemius_slugs_for_tier( $plan );

        $matched_slug = null;
        foreach ( $freemius_slugs as $freemius_slug ) {
            if ( $fs->is_plan_or_trial( $freemius_slug ) ) {
                $matched_slug = $freemius_slug;
                break;
            }
        }

        $result = $matched_slug !== null;
        $this->debug_log_plan_check( $plan, $freemius_slugs, $matched_slug, $result );

        return $result;
    }

    /**
     * Resolve the list of Freemius plan slugs that satisfy a FotoGrids tier.
     *
     * A FotoGrids tier (e.g. "pro_starter") can be satisfied by any of several
     * Freemius plan slugs (e.g. "pro_starter_01", "pro_starter_02"). This lets
     * us introduce new pricing/feature variants over time without renaming
     * existing plans (Freemius locks slugs once they have activations).
     *
     * Extend via the `fotogrids/licensing/tier_to_freemius_plan` filter.
     *
     * @since  1.0.0
     * @param  string $tier FotoGrids canonical tier slug.
     * @return array<int, string>
     */
    private function resolve_freemius_slugs_for_tier( string $tier ): array {
        $tier_to_freemius_plans = apply_filters(
            'fotogrids/licensing/tier_to_freemius_plan',
            [
                'pro_starter' => [ 'pro_starter_01' ],
                'pro_plus'    => [ 'pro_plus_01' ],
                'agency'      => [ 'pro_agency_01' ],
            ]
        );

        $slugs = $tier_to_freemius_plans[ $tier ] ?? [ $tier ];

        // Defensive coercion: allow filter callers to return a single string.
        if ( is_string( $slugs ) ) {
            $slugs = [ $slugs ];
        }

        if ( ! is_array( $slugs ) ) {
            return [ $tier ];
        }

        return array_values( array_unique( array_filter( $slugs, 'is_string' ) ) );
    }

    /**
     * Emit a single, structured debug line per non-trivial plan check.
     *
     * Deduplicates within a single request to avoid hundreds of identical
     * lines when one field is resolved many times during a render.
     *
     * @since  1.0.0
     * @param  string             $tier FotoGrids tier slug.
     * @param  array<int, string> $candidate_slugs Candidate Freemius slugs.
     * @param  string|null        $matched_slug Matched slug, if any.
     * @param  bool               $result Whether the tier was satisfied.
     * @return void
     */
    private function debug_log_plan_check(
        string $tier,
        array $candidate_slugs,
        ?string $matched_slug,
        bool $result
    ): void {
        // Cheap gate first so non-debug requests never touch the dedup table.
        if ( ! \FotoGrids\Debug_Log::should_log( 'license' ) ) {
            return;
        }

        static $already_logged = [];

        $signature = $tier . '|' . implode( ',', $candidate_slugs ) . '|' . ( $result ? '1' : '0' );
        if ( isset( $already_logged[ $signature ] ) ) {
            return;
        }
        $already_logged[ $signature ] = true;

        \FotoGrids\Debug_Log::write( 'license', sprintf(
            'tier=%s candidates=[%s] matched=%s result=%s',
            $tier,
            implode( ',', $candidate_slugs ),
            $matched_slug ?? '-',
            $result ? 'yes' : 'no'
        ) );
    }

    public function get_plan(): ?string {
        $license = $this->resolve_license();
        if ( $license !== null && ! empty( $license->parent_plan_title ) ) {
            return (string) $license->parent_plan_title;
        }

        $fs = $this->fs();
        if ( $fs && method_exists( $fs, 'get_plan' ) ) {
            $plan = $fs->get_plan();
            if ( is_object( $plan ) ) {
                if ( ! empty( $plan->title ) ) {
                    return (string) $plan->title;
                }
                if ( ! empty( $plan->name ) ) {
                    return (string) $plan->name;
                }
            }
        }

        return null;
    }

    public function get_license_key(): ?string {
        $license = $this->resolve_license();
        if ( $license !== null && ! empty( $license->secret_key ) ) {
            return (string) $license->secret_key;
        }

        return null;
    }

    public function get_expiry(): ?int {
        $license = $this->resolve_license();
        if ( $license === null || empty( $license->expiration ) ) {
            return null;
        }

        $ts = is_numeric( $license->expiration )
            ? (int) $license->expiration
            : strtotime( (string) $license->expiration );

        return $ts ?: null;
    }

    /**
     * Resolve the active FS_Plugin_License for this site, or null when
     * unavailable.
     *
     * @since  1.0.0
     * @return \FS_Plugin_License|null
     */
    private function resolve_license() {
        $fs = $this->fs();
        if ( ! $fs || ! method_exists( $fs, '_get_license' ) ) {
            return null;
        }

        $license = $fs->_get_license();

        return is_object( $license ) ? $license : null;
    }

    public function get_id(): string {
        return 'freemius';
    }

    public function is_opted_in(): bool {
        $fs = $this->fs();
        if ( ! $fs ) {
            return false;
        }

        return method_exists( $fs, 'is_tracking_allowed' )
            ? (bool) $fs->is_tracking_allowed()
            : (bool) $fs->is_registered();
    }

    public function get_details(): array {
        $license = $this->resolve_license();
        $details = [
            'activations'   => null,
            'quota'         => null,
            'is_cancelled'  => false,
            'account_email' => null,
        ];

        if ( $license !== null ) {
            $production            = isset( $license->activated ) ? (int) $license->activated : 0;
            $localhost             = isset( $license->activated_local ) ? (int) $license->activated_local : 0;
            $details['activations']  = $production + $localhost;
            $details['quota']        = isset( $license->quota ) ? (int) $license->quota : null;
            $details['is_cancelled'] = ! empty( $license->is_cancelled );
        }

        $fs = $this->fs();
        if ( $fs && method_exists( $fs, 'get_user' ) ) {
            $user = $fs->get_user();
            if ( is_object( $user ) && ! empty( $user->email ) ) {
                $details['account_email'] = (string) $user->email;
            }
        }

        $details['needs_pro_install'] = $this->is_pro_active() && ! defined( 'FOTOGRIDS_PRO_VERSION' );
        $details['pro_download_url']  = ( $details['needs_pro_install'] && $fs && method_exists( $fs, 'get_account_url' ) )
            ? $fs->get_account_url( 'download_latest' )
            : null;

        return $details;
    }

    public function activate_license( string $license_key ) {
        $fs = $this->fs();
        if ( ! $fs ) {
            return new \WP_Error(
                'fotogrids_freemius_unavailable',
                __( 'Licensing service is not loaded yet. Refresh the page and try again.', 'fotogrids' )
            );
        }

        $license_key = trim( $license_key );
        if ( $license_key === '' ) {
            return new \WP_Error(
                'fotogrids_empty_license_key',
                __( 'Please enter a license key.', 'fotogrids' )
            );
        }

        try {
            $result = $fs->opt_in(
                false,
                false,
                false,
                $license_key,
                false,
                false,
                false,
                null,
                array(),
                false
            );
        } catch ( \Throwable $e ) {
            return new \WP_Error(
                'fotogrids_activation_threw',
                $e->getMessage() ?: __( 'License activation failed.', 'fotogrids' )
            );
        }

        if ( is_object( $result ) && isset( $result->error ) ) {
            $msg = is_object( $result->error ) && isset( $result->error->message )
                ? (string) $result->error->message
                : __( 'License activation failed.', 'fotogrids' );
            return new \WP_Error( 'fotogrids_activation_failed', $msg );
        }

        if ( $result instanceof \WP_Error ) {
            return $result;
        }

        if ( is_string( $result ) ) {
            return new \WP_Error( 'fotogrids_activation_failed', $result );
        }

        return true;
    }

    public function deactivate_license() {
        $fs = $this->fs();
        if ( ! $fs ) {
            return new \WP_Error(
                'fotogrids_freemius_unavailable',
                __( 'Licensing service is not loaded yet. Refresh the page and try again.', 'fotogrids' )
            );
        }

        try {
            $reflection = new \ReflectionClass( $fs );
            if ( ! $reflection->hasMethod( '_deactivate_license' ) ) {
                return new \WP_Error(
                    'fotogrids_deactivate_unavailable',
                    __( 'License deactivation is not available in this version of the licensing SDK.', 'fotogrids' )
                );
            }
            $method = $reflection->getMethod( '_deactivate_license' );
            $method->setAccessible( true );
            $method->invoke( $fs, false );
        } catch ( \Throwable $e ) {
            return new \WP_Error(
                'fotogrids_deactivate_threw',
                $e->getMessage() ?: __( 'License deactivation failed.', 'fotogrids' )
            );
        }

        return true;
    }

    /**
     * Resolve the feature -> plan map.
     *
     * Plan slugs must match the slugs configured in the Freemius dashboard.
     * Pro modules can register their own gates via the
     * `fotogrids/licensing/feature_plan_map` filter.
     *
     * @since  1.0.0
     * @return array<string,string>
     */
    private function get_feature_plan_map(): array {
        if ( $this->feature_plan_map !== null ) {
            return $this->feature_plan_map;
        }

        $defaults = [];

        /**
         * Filter the feature -> plan map.
         *
         * @since 1.0.0
         * @param array<string,string> $map
         */
        $this->feature_plan_map = (array) apply_filters( 'fotogrids/licensing/feature_plan_map', $defaults );

        return $this->feature_plan_map;
    }

}
