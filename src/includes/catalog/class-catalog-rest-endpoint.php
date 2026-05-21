<?php
declare(strict_types=1);

namespace FotoGrids\Catalog;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * REST endpoint callbacks for catalog field-state refresh.
 *
 * @package FotoGrids\Catalog
 * @since   1.0.0
 */
final class Catalog_REST_Endpoint {

    /**
     * Returns field states and option-level states for current license status.
     *
     * @since   1.0.0
     * @param   string|null       $simulate_state Optional simulated license state.
     * @param   array<int, string> $warnings Additional warnings.
     * @return  \WP_REST_Response
     */
    public static function get_field_states( ?string $simulate_state = null, array $warnings = [] ): \WP_REST_Response {
        return rest_ensure_response( self::build_field_states_payload( $simulate_state, $warnings ) );
    }

    /**
     * Builds field-state response payload.
     *
     * @since   1.0.0
     * @param   string|null        $simulate_state Optional simulated license state.
     * @param   array<int, string> $warnings Additional warnings.
     * @return  array<string, mixed>
     */
    public static function build_field_states_payload( ?string $simulate_state = null, array $warnings = [] ): array {
        $field_states           = [];
        $field_states_by_option = [];

        foreach ( Catalog::all() as $field_id => $entry ) {
            $field_states[ $field_id ] = State_Resolver::resolve( $field_id, null, $simulate_state )->value;

            $options = $entry['options'] ?? null;
            if ( ! is_array( $options ) ) {
                continue;
            }

            foreach ( array_keys( $options ) as $option_value ) {
                $option_value_key = (string) $option_value;
                $field_states_by_option[ $field_id . '.' . $option_value_key ] = State_Resolver::resolve(
                    $field_id,
                    $option_value_key,
                    $simulate_state
                )->value;
            }
        }

        return [
            'field_states'           => $field_states,
            'field_states_by_option' => $field_states_by_option,
            'simulate_state'         => $simulate_state,
            'warnings'               => $warnings,
        ];
    }
}
