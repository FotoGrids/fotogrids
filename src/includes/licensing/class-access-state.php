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
 * Resolves a required tier into the product-wide access-state vocabulary.
 *
 * The free plugin runs NO license or plan check: state is derived purely from
 * the declared tier. Both the Tools manifest and the Modules manifest call
 * this so the whole product describes availability with one vocabulary.
 *
 * Vocabulary:
 *   'editable' - the tier is 'free' (fully available in the free plugin)
 *   'teaser'   - the feature lives on a higher tier; shown as a static
 *                upgrade prompt (advertising), never a lock on working code
 *   'locked'   - not produced by the free plugin; reserved for the Pro
 *                add-on, which applies its own resolution via the
 *                'fotogrids/features/access_state' filter
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
	 * Resolve a required tier to an access state (static; no license check).
	 *
	 * @since 1.0.0
	 * @param string $tier_required One of 'free' | 'pro_starter' | 'pro_plus' | 'agency'.
	 * @return string One of self::EDITABLE | self::TEASER | self::LOCKED.
	 */
	public static function resolve( string $tier_required ): string {
		// No license or plan check: state is derived purely from the declared
		// tier. Free features are editable; higher-tier features are shown as
		// static teasers (advertising), never as a lock on working code.
		$state = ( 'free' === $tier_required || '' === $tier_required )
			? self::EDITABLE
			: self::TEASER;

		/**
		 * Filter the resolved access state so the Pro add-on can apply its own
		 * per-plan license resolution. Free registers no callback, so the
		 * static tier-derived state stands and no license check runs here.
		 *
		 * @since 1.0.0
		 * @param string $state         Resolved state ('editable' | 'teaser' | 'locked').
		 * @param string $tier_required The required tier slug.
		 */
		return (string) apply_filters( \FotoGrids\Hooks\Filters_Features::ACCESS_STATE, $state, $tier_required );
	}
}
