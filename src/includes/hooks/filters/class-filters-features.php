<?php
/**
 * Feature-gate filter hooks (Pro / layouts / custom JS).
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Feature filter hooks.
 */
final class Filters_Features {

	/**
	 * Per-feature gate: can a given Pro feature be used?
	 *
	 * @since 1.0.0
	 * @param bool   $can_use      Default false in Free.
	 * @param string $feature_name Feature identifier.
	 */
	public const PRO_CAN_USE = 'fotogrids/features/pro/can_use';

	/**
	 * Master "Pro is active" toggle.
	 *
	 * @since 1.0.0
	 * @param bool $is_pro Default false in Free.
	 */
	public const PRO_IS_ACTIVE = 'fotogrids/features/pro/is_active';

	/**
	 * The list of layout modules available to galleries.
	 *
	 * Pro hooks here to register premium layouts (Carousel etc.).
	 *
	 * @since 1.0.0
	 * @param array $layouts Layout slug => meta map.
	 */
	public const LAYOUTS_AVAILABLE = 'fotogrids/features/layouts/available';

	/**
	 * Whether the current site is on a specific Pro plan or higher.
	 *
	 * @since 1.0.0
	 * @param bool   $on_plan Default false in Free.
	 * @param string $plan    Plan / tier slug.
	 */
	public const PRO_ON_PLAN = 'fotogrids/features/pro/on_plan';

	/**
	 * The list of enabled Pro feature identifiers for the current site.
	 *
	 * @since 1.0.0
	 * @param array $features Default empty in Free.
	 */
	public const PRO_ENABLED_FEATURES = 'fotogrids/features/pro/enabled';
}
