<?php
/**
 * Base class for rules that adjust the defaults seeded into a new collection.
 *
 * @package FotoGrids\Settings
 * @since   1.1.3
 */

declare(strict_types=1);

namespace FotoGrids\Settings;

use FotoGrids\Hooks\Filters_Settings;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Abstract_Seed_Rule
 *
 * A class extending this under `includes/settings/seed-rules/` is found and
 * registered by `Collection_Defaults_Seeder` with no other wiring. Each rule
 * receives the saved defaults about to be written into a new collection and
 * returns them, changed or not.
 *
 * @package FotoGrids\Settings
 * @since   1.1.3
 */
abstract class Abstract_Seed_Rule {

	/**
	 * Adjust the defaults about to be seeded into a new collection.
	 *
	 * @since  1.1.3
	 * @param  array<string, mixed> $values    Setting key => saved default value.
	 * @param  int                  $post_id   The new collection's post ID.
	 * @param  string               $post_type The new collection's post type.
	 * @return array<string, mixed>
	 */
	abstract public static function apply( array $values, int $post_id, string $post_type ): array;

	/**
	 * Hook the rule onto `Filters_Settings::DEFAULTS_SEED`.
	 *
	 * @since  1.1.3
	 * @return void
	 */
	final public static function register(): void {
		add_filter( Filters_Settings::DEFAULTS_SEED, array( static::class, 'filter' ), 10, 3 );
	}

	/**
	 * Filter callback that normalises the arguments before `apply()`.
	 *
	 * @since  1.1.3
	 * @param  mixed $values    Values passed along the filter.
	 * @param  mixed $post_id   The new collection's post ID.
	 * @param  mixed $post_type The new collection's post type.
	 * @return array<string, mixed>
	 */
	final public static function filter( $values, $post_id, $post_type ): array {
		return static::apply( (array) $values, (int) $post_id, (string) $post_type );
	}
}
