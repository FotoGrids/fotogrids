<?php
/**
 * Access-state resolver.
 *
 * @package FotoGrids\Licensing
 * @since   1.0.0
 */

namespace FotoGrids\Licensing;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolves a required tier into the product-wide access-state vocabulary
 * ('editable' | 'teaser' | 'locked') for the current user.
 *
 * This is the single source of truth for that resolution. It mirrors the
 * logic previously duplicated in:
 *   - includes/catalog/class-state-resolver.php  (Field_State enum form)
 *   - includes/tools/class-tools-rest.php        (string form)
 *
 * Both the Tools manifest and the Modules manifest call this so the whole
 * product describes "can you touch this right now" with one vocabulary.
 *
 * Vocabulary:
 *   'editable' - user is on the required tier (or the tier is 'free')
 *   'teaser'   - feature lives on a higher tier the user has never had
 *   'locked'   - user was on the right tier but the license has expired
 *
 * @since 1.0.0
 */
final class Access_State {

	/**
	 * Editable state token.
	 *
	 * @var string
	 */
	public const EDITABLE = 'editable';

	/**
	 * Teaser state token.
	 *
	 * @var string
	 */
	public const TEASER = 'teaser';

	/**
	 * Locked state token.
	 *
	 * @var string
	 */
	public const LOCKED = 'locked';

	/**
	 * Resolve a required tier to an access state for the current user.
	 *
	 * Uses the static License_Manager tier API. Free tiers short-circuit
	 * before any provider round-trip.
	 *
	 * @since 1.0.0
	 * @param string $tier_required One of 'free' | 'pro_starter' | 'pro_plus' | 'agency'.
	 * @return string One of self::EDITABLE | self::TEASER | self::LOCKED.
	 */
	public static function resolve( string $tier_required ): string {
		if ( 'free' === $tier_required || '' === $tier_required ) {
			return self::EDITABLE;
		}

		// User is on the required plan (or higher).
		if ( \FotoGrids\License_Manager::on_plan( $tier_required ) ) {
			return self::EDITABLE;
		}

		// User has an active Pro license but not this tier / it has lapsed
		// for this tier - treat as locked (they had access at some point).
		if ( \FotoGrids\License_Manager::is_pro_active() ) {
			return self::LOCKED;
		}

		// User has never been on this tier.
		return self::TEASER;
	}
}
