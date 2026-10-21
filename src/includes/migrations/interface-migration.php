<?php
/**
 * Contract for a one-time upgrade migration.
 *
 * @package FotoGrids\Migrations
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Migrations;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * A data change applied once per site by `Migration_Runner`.
 *
 * Each implementation lives in `includes/migrations/class-<slug>.php`.
 *
 * @since 1.3.0
 */
interface Migration {

	/**
	 * Identifier recorded once the migration has run.
	 *
	 * A zero-padded sequence number and a slug, such as
	 * `0002-collection-defaults-split`. Migrations run in identifier order,
	 * and an identifier never changes once released.
	 *
	 * @since  1.3.0
	 * @return string
	 */
	public static function id(): string;

	/**
	 * Apply the migration.
	 *
	 * Throws when the change could not be completed, which leaves the
	 * migration pending.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function run(): void;
}
