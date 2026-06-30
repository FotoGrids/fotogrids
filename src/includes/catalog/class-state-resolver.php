<?php
declare(strict_types=1);

namespace FotoGrids\Catalog;

use FotoGrids\Render\Api\Field_State;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves edit-time state for catalog fields and options.
 *
 * @package FotoGrids\Catalog
 * @since   1.0.0
 */
final class State_Resolver {

	/**
	 * Returns field state for a field and optional selected option.
	 *
	 * @since   1.0.0
	 * @param   string      $field_id Field identifier.
	 * @param   string|null $option_value Option value for per-option checks.
	 * @return  Field_State
	 */
	public static function resolve(
		string $field_id,
		?string $option_value = null,
		?string $simulate_state = null
	): string {
		$entry = Catalog::get( $field_id );
		if ( null === $entry ) {
			self::debug_log_resolution( $field_id, $option_value, 'unknown', Field_State::TEASER, 'missing_catalog_entry' );
			return Field_State::TEASER;
		}

		$required_tier = $entry['tier_required'] ?? 'free';
		if ( null !== $option_value && ! empty( $entry['options'] ) && is_array( $entry['options'] ) ) {
			$option_tier = $entry['options'][ $option_value ]['tier_required'] ?? null;
			if ( is_string( $option_tier ) && '' !== $option_tier ) {
				$required_tier = $option_tier;
			}
		}

		// Free fields/options bypass the provider entirely. They're always
		// editable and don't deserve a Freemius round-trip or a debug-log line.
		if ( 'free' === $required_tier && null === $simulate_state ) {
			return Field_State::EDITABLE;
		}

		if ( null !== $simulate_state ) {
			$simulated_state = self::resolve_for_simulated_state( (string) $required_tier, $simulate_state );
			self::debug_log_resolution(
				$field_id,
				$option_value,
				(string) $required_tier,
				$simulated_state,
				'simulate:' . $simulate_state
			);
			return $simulated_state;
		}

		// On the required plan (or higher) -> editable.
		if ( \FotoGrids\License_Manager::on_plan( (string) $required_tier ) ) {
			self::debug_log_resolution( $field_id, $option_value, (string) $required_tier, Field_State::EDITABLE, 'editable' );
			return Field_State::EDITABLE;
		}

		// Active Pro but not this tier / lapsed -> locked; never had it -> teaser.
		if ( \FotoGrids\License_Manager::is_pro_active() ) {
			self::debug_log_resolution( $field_id, $option_value, (string) $required_tier, Field_State::LOCKED, 'license_invalid' );
			return Field_State::LOCKED;
		}

		self::debug_log_resolution( $field_id, $option_value, (string) $required_tier, Field_State::TEASER, 'not_on_plan' );
		return Field_State::TEASER;
	}

	/**
	 * Resolves field state from a simulated license state.
	 *
	 * @since   1.0.0
	 * @param   string $required_tier Required tier for this field/option.
	 * @param   string $simulate_state Simulated state token.
	 * @return  Field_State
	 */
	private static function resolve_for_simulated_state( string $required_tier, string $simulate_state ): string {
		if ( 'free' === $required_tier ) {
			return Field_State::EDITABLE;
		}

		switch ( $simulate_state ) {
			case 'ok':
				return Field_State::EDITABLE;
			case 'expired':
				return Field_State::LOCKED;
			case 'password_required':
			case 'unauthorized':
				return Field_State::TEASER;
			default:
				return Field_State::TEASER;
		}
	}

	/**
	 * Emit a single, structured debug line per non-trivial field resolution.
	 *
	 * Deduplicates within a single request to avoid hundreds of identical
	 * lines when one field is resolved many times during a render.
	 *
	 * @since   1.0.0
	 * @param   string      $field_id Field identifier.
	 * @param   string|null $option_value Option value, if any.
	 * @param   string      $required_tier Required tier slug.
	 * @param   Field_State $state Resolved field state.
	 * @param   string      $reason Short reason tag.
	 * @return  void
	 */
	private static function debug_log_resolution(
		string $field_id,
		?string $option_value,
		string $required_tier,
		string $state,
		string $reason
	): void {
		// Cheap gate first so non-debug requests never touch the dedup table.
		if ( ! \FotoGrids\Debug_Log::should_log( 'catalog' ) ) {
			return;
		}

		static $already_logged = array();

		$signature = $field_id . '|' . ( $option_value ?? '' ) . '|' . $required_tier . '|' . $state;
		if ( isset( $already_logged[ $signature ] ) ) {
			return;
		}
		$already_logged[ $signature ] = true;

		\FotoGrids\Debug_Log::write(
			'catalog',
			sprintf(
				'field=%s%s tier=%s -> %s (%s)',
				$field_id,
				null !== $option_value ? '.' . $option_value : '',
				$required_tier,
				$state,
				$reason
			)
		);
	}
}
