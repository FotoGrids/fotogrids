<?php
/**
 * Licensing-provider filter hooks.
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
 * Licensing filter hooks.
 */
final class Filters_Licensing {

    /**
     * Override hook for the licensing provider singleton.
     *
     * @since 1.0.0
     * @param \FotoGrids\Licensing\License_Provider|null $override Provider or null.
     */
    public const PROVIDER = 'fotogrids/licensing/provider';

    /**
     * Feature → required plan-tier map.
     *
     * @since 1.0.0
     * @param array<string,string> $defaults Feature → tier map.
     */
    public const FEATURE_PLAN_MAP = 'fotogrids/licensing/feature_plan_map';

    /**
     * Internal tier → Freemius-plan-id map.
     *
     * @since 1.0.0
     * @param array<string,int> $tier_to_freemius_plans Map.
     */
    public const TIER_TO_FREEMIUS_PLAN = 'fotogrids/licensing/tier_to_freemius_plan';
}
