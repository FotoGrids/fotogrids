<?php
/**
 * Registry of hover-effect descriptors.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Hover_Effect;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Single source of truth for hover effects. Free, Pro, and third-party plugins
 * register descriptors here on the REGISTER_HOVER_EFFECTS action. Every
 * consumer (renderer, schema options, admin preview) reads from this registry.
 *
 * @since 1.0.0
 */
final class Hover_Effect_Registry {

	/**
	 * @var array<string, Hover_Effect>
	 */
	private static $effects = array();

	/**
	 * Registers a descriptor. A real (non-teaser) descriptor overrides a teaser
	 * of the same id; a teaser never overrides a real descriptor. Invalid
	 * descriptors are ignored.
	 *
	 * @since  1.0.0
	 * @param  Hover_Effect $effect Descriptor to register.
	 * @return void
	 */
	public static function register( Hover_Effect $effect ): void {
		if ( ! $effect->is_valid() ) {
			return;
		}

		$existing = isset( self::$effects[ $effect->id ] ) ? self::$effects[ $effect->id ] : null;

		if ( null !== $existing && false === $existing->is_teaser && true === $effect->is_teaser ) {
			return;
		}

		self::$effects[ $effect->id ] = $effect;
	}

	/**
	 * @since  1.0.0
	 * @param  string $id Effect id.
	 * @return Hover_Effect|null
	 */
	public static function get( string $id ): ?Hover_Effect {
		return isset( self::$effects[ $id ] ) ? self::$effects[ $id ] : null;
	}

	/**
	 * @since  1.0.0
	 * @return array<string, Hover_Effect>
	 */
	public static function all(): array {
		return self::$effects;
	}

	/**
	 * @since  1.0.0
	 * @param  string $origin Plugin origin token.
	 * @return array<string, Hover_Effect>
	 */
	public static function for_origin( string $origin ): array {
		return array_filter(
			self::$effects,
			static function ( Hover_Effect $effect ) use ( $origin ): bool {
				return $effect->origin === $origin;
			}
		);
	}

	/**
	 * Serialises the registered effects into the option shape the admin hover
	 * grid consumes. Tier maps to the field-state tier; metadata travels so the
	 * grid can preview, gate, and surface conflicts from one source.
	 *
	 * @since  1.0.0
	 * @return array<int, array<string, mixed>>
	 */
	public static function as_options(): array {
		$options = array();

		foreach ( self::$effects as $effect ) {
			$options[] = array(
				'value'            => $effect->id,
				'label'            => $effect->label,
				'tier_required'    => $effect->tier,
				'animates'         => $effect->animates,
				'requires_caption' => $effect->requires_caption,
				'hide_on_layouts'  => $effect->hide_on_layouts,
				'conflicts_css'    => $effect->conflicts_css,
				'preview_hint'     => $effect->preview_hint,
			);
		}

		return $options;
	}

	/**
	 * Clears the registry. Test-support only.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function reset_for_tests(): void {
		self::$effects = array();
	}
}
