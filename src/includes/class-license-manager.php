<?php
/**
 * License manager - Pro presence and entitlement gate.
 *
 * FotoGrids Free contains no license activation, verification, or storage. It
 * answers two kinds of question, both filter-driven so the Pro plugin can
 * supply real entitlement when installed:
 *
 *  - has_pro(): is the Pro plugin's code present on this site? (constant check)
 *  - is_pro_active() / can_use() / on_plan(): is a Pro feature or plan
 *    available for the current site? Always false / empty in Free; the Pro
 *    plugin answers these through the Filters_Features hooks.
 *
 * @package FotoGrids
 * @since   1.0.0
 */

namespace FotoGrids;

use FotoGrids\Hooks\Filters_Features;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Pro presence + entitlement gate.
 *
 * @since 1.0.0
 */
final class License_Manager {

	/**
	 * Bootstrap hook. Free wires nothing; the Pro plugin owns license
	 * verification and any scheduling.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function init() {}

	/**
	 * Whether the FotoGrids Pro plugin's code is present on this site.
	 *
	 * Constant-only check - does NOT validate any license. Use can_use() or
	 * on_plan() to ask whether a Pro feature is actually available.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function has_pro(): bool {
		return defined( 'FOTOGRIDS_PRO_VERSION' );
	}

	/**
	 * Whether Pro is active for the current site.
	 *
	 * Always false in Free; the Pro plugin answers via the PRO_IS_ACTIVE filter.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function is_pro_active(): bool {
		return (bool) apply_filters( Filters_Features::PRO_IS_ACTIVE, false );
	}

	/**
	 * Whether a specific Pro feature can be used.
	 *
	 * Always false in Free; the Pro plugin answers via the PRO_CAN_USE filter.
	 *
	 * @since 1.0.0
	 * @param string $feature_id Stable feature identifier.
	 * @return bool
	 */
	public static function can_use( string $feature_id ): bool {
		return (bool) apply_filters( Filters_Features::PRO_CAN_USE, false, $feature_id );
	}

	/**
	 * Alias of can_use() for call sites that read as "is this feature on".
	 *
	 * @since 1.0.0
	 * @param string $feature_name Stable feature identifier.
	 * @return bool
	 */
	public static function feature_enabled( string $feature_name ): bool {
		return self::can_use( $feature_name );
	}

	/**
	 * Whether the current site is on a given Pro plan or higher.
	 *
	 * Always false in Free; the Pro plugin answers via the PRO_ON_PLAN filter.
	 *
	 * @since 1.0.0
	 * @param string $plan Plan / tier slug.
	 * @return bool
	 */
	public static function on_plan( string $plan ): bool {
		return (bool) apply_filters( Filters_Features::PRO_ON_PLAN, false, $plan );
	}

	/**
	 * The enabled Pro feature identifiers for the current site.
	 *
	 * Empty in Free; the Pro plugin answers via the PRO_ENABLED_FEATURES filter.
	 *
	 * @since 1.0.0
	 * @return array
	 */
	public static function get_enabled_features(): array {
		return (array) apply_filters( Filters_Features::PRO_ENABLED_FEATURES, array() );
	}
}
