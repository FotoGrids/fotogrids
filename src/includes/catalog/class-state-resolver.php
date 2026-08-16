<?php
declare(strict_types=1);

namespace FotoGrids\Catalog;

use FotoGrids\Hooks\Filters_Catalog;
use FotoGrids\Render\Api\Field_State;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves edit-time state for catalog fields and options.
 *
 * The free plugin performs NO license or plan check. State is derived purely
 * from the field's declared tier: free fields are editable, higher-tier fields
 * are shown as static teasers (upgrade prompts / advertising). No built-in
 * feature is gated behind a license here - the teaser is an advertisement, not
 * a lock. The Pro add-on makes its own fields editable by overriding the
 * catalog.
 *
 * @package FotoGrids\Catalog
 * @since   1.0.0
 */
final class State_Resolver {

	/**
	 * Returns field state for a field and optional selected option.
	 *
	 * @since   1.0.0
	 * @param   string      $field_id     Field identifier.
	 * @param   string|null $option_value Option value for per-option checks.
	 * @return  string  One of Field_State::EDITABLE | Field_State::TEASER.
	 */
	public static function resolve(
		string $field_id,
		?string $option_value = null
	): string {
		$entry = Catalog::get( $field_id );
		if ( null === $entry ) {
			return Field_State::TEASER;
		}

		$required_tier = $entry['tier_required'] ?? 'free';
		if ( null !== $option_value && ! empty( $entry['options'] ) && is_array( $entry['options'] ) ) {
			$option_tier = $entry['options'][ $option_value ]['tier_required'] ?? null;
			if ( is_string( $option_tier ) && '' !== $option_tier ) {
				$required_tier = $option_tier;
			}
		}

		$state = ( 'free' === $required_tier || '' === $required_tier )
			? Field_State::EDITABLE
			: Field_State::TEASER;

		/**
		 * Filter the resolved field state so the Pro add-on can apply its own
		 * per-plan license resolution. Free registers no callback, so the
		 * static tier-derived state stands and no license check runs here.
		 *
		 * @since 1.0.0
		 * @param string      $state         Field_State::EDITABLE | TEASER (default).
		 * @param string      $field_id      Catalog field id.
		 * @param string|null $option_value  Option value, if any.
		 * @param string      $required_tier The field/option's declared tier.
		 */
		return (string) apply_filters( Filters_Catalog::FIELD_STATE, $state, $field_id, $option_value, $required_tier );
	}
}
