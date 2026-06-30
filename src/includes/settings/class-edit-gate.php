<?php
declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Catalog\Catalog;
use FotoGrids\Catalog\State_Resolver;
use FotoGrids\Render\Api\Field_State;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Filters incoming setting writes against Catalog and license state.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */
final class Edit_Gate {

	/**
	 * Filters incoming settings against editable field states.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $incoming Incoming settings payload.
	 * @param   array<string, mixed> $existing Existing saved settings.
	 * @return  array{settings: array<string, mixed>, gated: array<int, array<string, mixed>>}
	 */
	public static function filter( array $incoming, array $existing ): array {
		$filtered_settings = array();
		$gated_fields      = array();

		foreach ( $incoming as $field_id => $new_value ) {
			if ( ! is_string( $field_id ) || '' === $field_id ) {
				continue;
			}

			$entry = Catalog::get( $field_id );
			if ( null === $entry ) {
				$gated_fields[] = array(
					'field'  => $field_id,
					'reason' => 'not_in_catalog',
				);
				self::dev_log( sprintf( 'Dropped unknown setting key: %s', $field_id ) );
				continue;
			}

			$existing_value = $existing[ $field_id ] ?? null;
			$field_state    = State_Resolver::resolve( $field_id );
			if ( Field_State::EDITABLE !== $field_state ) {
				$filtered_settings[ $field_id ] = $existing_value;
				$gated_fields[]                 = array(
					'field'  => $field_id,
					'reason' => $field_state,
				);
				continue;
			}

			if ( ! empty( $entry['options'] ) && is_array( $entry['options'] ) && is_string( $new_value ) ) {
				$option_state = State_Resolver::resolve( $field_id, $new_value );
				if ( Field_State::EDITABLE !== $option_state ) {
					$filtered_settings[ $field_id ] = $existing_value;
					$gated_fields[]                 = array(
						'field'  => $field_id,
						'reason' => $option_state,
						'option' => $new_value,
					);
					continue;
				}
			}

			$sanitize_callback = $entry['sanitize'] ?? null;
			if ( is_string( $sanitize_callback ) && is_callable( $sanitize_callback ) ) {
				$new_value = call_user_func( $sanitize_callback, $new_value );
			} elseif ( is_callable( $sanitize_callback ) ) {
				$new_value = call_user_func( $sanitize_callback, $new_value );
			}

			$filtered_settings[ $field_id ] = $new_value;
		}

		foreach ( $existing as $field_id => $existing_value ) {
			if ( ! array_key_exists( $field_id, $filtered_settings ) ) {
				$filtered_settings[ $field_id ] = $existing_value;
			}
		}

		return array(
			'settings' => $filtered_settings,
			'gated'    => $gated_fields,
		);
	}

	/**
	 * Logs debug-only gate warnings.
	 *
	 * @since   1.0.0
	 * @param   string $message Warning message.
	 * @return  void
	 */
	private static function dev_log( string $message ): void {
		\FotoGrids\Debug_Log::write( 'edit_gate', $message );
	}
}
