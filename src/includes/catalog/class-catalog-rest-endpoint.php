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
	 * @return  \WP_REST_Response
	 */
	public static function get_field_states(): \WP_REST_Response {
		return rest_ensure_response( self::build_field_states_payload() );
	}

	/**
	 * Builds field-state response payload (states derived statically from tier).
	 *
	 * @since   1.0.0
	 * @return  array<string, mixed>
	 */
	public static function build_field_states_payload(): array {
		$field_states           = array();
		$field_states_by_option = array();

		foreach ( Catalog::all() as $field_id => $entry ) {
			$field_states[ $field_id ] = State_Resolver::resolve( $field_id );

			$options = $entry['options'] ?? null;
			if ( ! is_array( $options ) ) {
				continue;
			}

			foreach ( array_keys( $options ) as $option_value ) {
				$option_value_key = (string) $option_value;
				$field_states_by_option[ $field_id . '.' . $option_value_key ] = State_Resolver::resolve(
					$field_id,
					$option_value_key
				);
			}
		}

		return array(
			'field_states'           => $field_states,
			'field_states_by_option' => $field_states_by_option,
		);
	}
}
