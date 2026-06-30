<?php
/**
 * WP-Cron action hook identifiers.
 *
 * Dispatched by WordPress core's WP-Cron scheduler when `wp_schedule_event()`
 * fires, not by us. We listen via `add_action()` on the same hook name.
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
 * WP-Cron action hook identifiers.
 */
final class Actions_Cron {

	/**
	 * Scheduled WP-Cron action used to purge expired statistics rows.
	 *
	 * @since 1.0.0
	 */
	public const STATS_CLEANUP = 'fotogrids/cron/stats_cleanup';

	/**
	 * Scheduled WP-Cron action used to send anonymous usage statistics.
	 *
	 * @since 1.0.0
	 */
	public const SEND_STATISTICS = 'fotogrids/cron/send_statistics';
}
