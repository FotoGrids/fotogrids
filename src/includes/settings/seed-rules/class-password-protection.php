<?php
/**
 * Password protection rule for seeding a new collection from the defaults.
 *
 * @package FotoGrids\Settings\Seed_Rules
 * @since   1.1.3
 */

declare(strict_types=1);

namespace FotoGrids\Settings\Seed_Rules;

use FotoGrids\Settings\Abstract_Seed_Rule;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Password_Protection
 *
 * Keeps a default password out of a new collection unless the defaults also
 * switch password protection on, matching the collection save path, which
 * clears the stored password whenever protection is turned off.
 *
 * @package FotoGrids\Settings\Seed_Rules
 * @since   1.1.3
 */
final class Password_Protection extends Abstract_Seed_Rule {

	/**
	 * Drop the default password when the defaults leave protection off.
	 *
	 * @since  1.1.3
	 * @param  array<string, mixed> $values    Setting key => saved default value.
	 * @param  int                  $post_id   The new collection's post ID.
	 * @param  string               $post_type The new collection's post type.
	 * @return array<string, mixed>
	 */
	public static function apply( array $values, int $post_id, string $post_type ): array { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by Abstract_Seed_Rule; params intentionally unused here.
		if ( ! rest_sanitize_boolean( $values['password_protect'] ?? false ) ) {
			unset( $values['password'] );
		}

		return $values;
	}
}
