<?php
declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Catalog\Catalog;
use FotoGrids\Hooks\Filters_Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Filters incoming setting writes against the Catalog.
 *
 * The free plugin drops keys that are not in the Catalog and runs each field's
 * declared sanitiser. It applies NO tier or license gating - every setting the
 * free plugin ships is fully writable. The Pro add-on hooks the
 * 'fotogrids/settings/edit_gate' filter to re-apply its own per-plan write
 * enforcement.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */
final class Edit_Gate {

	/**
	 * Filters incoming settings: drops unknown keys, sanitises known ones.
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

			$sanitize_callback = $entry['sanitize'] ?? null;
			if ( is_callable( $sanitize_callback ) ) {
				$new_value = call_user_func( $sanitize_callback, $new_value );
			}

			$filtered_settings[ $field_id ] = $new_value;
		}

		foreach ( $existing as $field_id => $existing_value ) {
			if ( ! array_key_exists( $field_id, $filtered_settings ) ) {
				$filtered_settings[ $field_id ] = $existing_value;
			}
		}

		$result = array(
			'settings' => $filtered_settings,
			'gated'    => $gated_fields,
		);

		/**
		 * Filter the edit-gate result so the Pro add-on can apply its own
		 * per-plan write enforcement (reverting fields its license does not
		 * cover and adding them to the 'gated' list). Free registers no
		 * callback, so no tier or license gating runs here.
		 *
		 * @since 1.0.0
		 * @param array                $result   { settings: array, gated: array }.
		 * @param array<string, mixed> $incoming Incoming settings payload.
		 * @param array<string, mixed> $existing Existing saved settings.
		 */
		$result = apply_filters( Filters_Settings::EDIT_GATE, $result, $incoming, $existing );

		return is_array( $result ) && isset( $result['settings'], $result['gated'] )
			? $result
			: array(
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
