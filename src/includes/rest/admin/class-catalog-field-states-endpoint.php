<?php
declare(strict_types=1);

namespace FotoGrids\REST\Admin;

use FotoGrids\Catalog\Catalog_REST_Endpoint;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Handles catalog field-state refresh requests.
 *
 * @package FotoGrids\REST\Admin
 * @since   1.0.0
 */
final class Catalog_Field_States_Endpoint {

    /**
     * Allowed simulation states.
     *
     * @var array<int, string>
     */
    private const ALLOWED_SIMULATION_STATES = [ 'ok', 'password_required', 'expired', 'unauthorized' ];

    /**
     * Returns catalog field states with optional simulated license status.
     *
     * @since   1.0.0
     * @param   \WP_REST_Request $request Request object.
     * @return  \WP_REST_Response
     */
    public static function get_field_states( \WP_REST_Request $request ): \WP_REST_Response {
        $warnings = [];

        $simulate_state = $request->get_param( 'simulate_state' );
        if ( $simulate_state !== null && $simulate_state !== '' ) {
            $simulate_state = sanitize_text_field( (string) $simulate_state );

            if ( ! in_array( $simulate_state, self::ALLOWED_SIMULATION_STATES, true ) ) {
                $warnings[] = sprintf( 'dropped unknown simulate_state: %s', $simulate_state );
                $simulate_state = null;
            } elseif ( ! current_user_can( 'manage_fotogrids_settings' ) ) {
                $warnings[] = 'dropped simulate_state: insufficient permission';
                $simulate_state = null;
            }
        } else {
            $simulate_state = null;
        }

        return rest_ensure_response(
            Catalog_REST_Endpoint::build_field_states_payload( $simulate_state, $warnings )
        );
    }
}
