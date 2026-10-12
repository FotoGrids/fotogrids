<?php
/**
 * Base class for the declarations of the options the plugin stores.
 *
 * @package FotoGrids\Options
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Options;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Abstract_Option_Declaration
 *
 * A class extending this under `includes/options/declarations/` is found by
 * `Option_Registry` with no other wiring. It names the options one part of the
 * plugin owns and whether Maintenance > Reset all settings clears each of them.
 *
 * @package FotoGrids\Options
 * @since   1.3.0
 */
abstract class Abstract_Option_Declaration {

	/**
	 * Cleared by Reset all settings.
	 *
	 * @var string
	 */
	public const RESET = 'reset';

	/**
	 * Kept by Reset all settings.
	 *
	 * @var string
	 */
	public const KEEP = 'keep';

	/**
	 * The options this part of the plugin owns.
	 *
	 * @since  1.3.0
	 * @return array<string, string> Option name => self::RESET or self::KEEP.
	 */
	abstract public static function options(): array;

	/**
	 * Restore whatever must exist once a reset has deleted its options.
	 *
	 * Runs after every declaration's options are cleared.
	 *
	 * @since  1.3.0
	 * @param  array<int, string> $cleared Options the reset deleted.
	 * @return void
	 */
	public static function after_reset( array $cleared ): void {} // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Default for declarations with nothing to restore.
}
