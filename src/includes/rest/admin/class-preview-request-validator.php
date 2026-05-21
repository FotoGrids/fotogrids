<?php
declare(strict_types=1);

namespace FotoGrids\REST\Admin;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Validates POST preview request payloads.
 *
 * @package FotoGrids\REST\Admin
 * @since   1.0.0
 */
final class Preview_Request_Validator {

    private const MAX_ITEM_ORDER = 1000;

    /**
     * Validate and sanitize a preview request.
     *
     * @since   1.0.0
     * @param   \WP_REST_Request $request Request object.
     * @return  array{settings: array<string,mixed>, item_order: array<int,int>, item_overrides: array<int|string,array<string,mixed>>, simulate_state: ?string, warnings: array<int,string>}|\WP_Error
     */
    public static function validate( \WP_REST_Request $request ) {
        $warnings = [];

        $version = absint( $request->get_param( 'version' ) ?: 2 );
        if ( $version !== 2 ) {
            return new \WP_Error(
                'fotogrids_preview_invalid_version',
                __( 'Unsupported preview request version.', 'fotogrids' ),
                [ 'status' => 400 ]
            );
        }

        $settings = $request->get_param( 'settings' );
        if ( ! is_array( $settings ) ) {
            $settings = [];
        }

        $item_order = $request->get_param( 'item_order' );
        if ( ! is_array( $item_order ) ) {
            $item_order = [];
        }
        $item_order = array_values( array_filter( array_map( 'absint', $item_order ) ) );

        if ( count( $item_order ) > self::MAX_ITEM_ORDER ) {
            return new \WP_Error(
                'fotogrids_preview_item_order_too_large',
                __( 'Preview item order exceeds the maximum supported size.', 'fotogrids' ),
                [ 'status' => 400 ]
            );
        }

        $item_overrides = $request->get_param( 'item_overrides' );
        if ( ! is_array( $item_overrides ) ) {
            $item_overrides = [];
        }

        $simulate_state = $request->get_param( 'simulate_state' );
        if ( $simulate_state !== null && $simulate_state !== '' ) {
            $simulate_state = sanitize_text_field( (string) $simulate_state );
            if ( ! in_array( $simulate_state, [ 'ok', 'password_required', 'expired', 'unauthorized' ], true ) ) {
                $warnings[] = sprintf( 'dropped unknown simulate_state: %s', $simulate_state );
                $simulate_state = null;
            }
        } else {
            $simulate_state = null;
        }

        return [
            'settings'       => $settings,
            'item_order'     => $item_order,
            'item_overrides' => $item_overrides,
            'simulate_state' => $simulate_state,
            'warnings'       => $warnings,
        ];
    }
}

