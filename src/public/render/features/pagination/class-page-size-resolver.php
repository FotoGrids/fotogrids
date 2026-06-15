<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Pagination;

use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Static helper for pagination math.
 *
 * Lives as a class (not a trait) so non-module callers — most importantly
 * Context_Builder — can use the same logic without having to `use` the
 * Pagination_Common trait. The trait delegates to this class for the math
 * so the module classes and the builder agree.
 *
 * @package FotoGrids\Render\Features\Pagination
 * @since   1.0.0
 */
final class Page_Size_Resolver {

	/**
	 * Resolves items_per_page for the active breakpoint.
	 *
	 * The setting is shaped responsive: { desktop: { default }, tablet:
	 * { default }, mobile: { default } }. We resolve to the current
	 * breakpoint, falling back to desktop, falling back to 24.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $settings        Render context settings.
	 * @param Render_Context|null  $render_context  When given, used to read
	 *                                              the active breakpoint;
	 *                                              otherwise defaults to
	 *                                              'desktop'.
	 * @return int
	 */
	public static function resolve_page_size( array $settings, ?Render_Context $render_context = null ): int {
		$raw = $settings['items_per_page'] ?? null;
		if ( null === $raw ) {
			return 24;
		}

		// Flat int — saved by older settings (or by show_all default).
		if ( is_numeric( $raw ) ) {
			return max( 1, (int) $raw );
		}

		if ( ! is_array( $raw ) ) {
			return 24;
		}

		$breakpoint = null !== $render_context
			? (string) ( $render_context->meta->breakpoint ?? 'desktop' )
			: 'desktop';

		// The saved shape is { desktop: <int>, tablet: <int>, mobile: <int> }
		// (the resolved per-breakpoint values from the responsive_range
		// control). Older drafts or third-party writes may also nest under
		// ['value'] or ['default']; we accept all three shapes.
		$value = self::extract_breakpoint_value( $raw, $breakpoint )
			?? self::extract_breakpoint_value( $raw, 'desktop' )
			?? 24;

		return max( 1, (int) $value );
	}

	/**
	 * Extract a numeric value from a single breakpoint slot, accepting any
	 * of the three shapes we've seen in the wild:
	 *   - flat int / numeric string:  $raw[$bp] = 2
	 *   - nested 'value':             $raw[$bp] = [ 'value' => 2, 'unit' => 'items' ]
	 *   - schema-default fallback:    $raw[$bp] = [ 'default' => 24, ... ]
	 *
	 * Returns null when the slot is missing or unreadable.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $raw
	 */
	private static function extract_breakpoint_value( array $raw, string $breakpoint ): ?int {
		if ( ! array_key_exists( $breakpoint, $raw ) ) {
			return null;
		}

		$slot = $raw[ $breakpoint ];

		if ( is_numeric( $slot ) ) {
			return (int) $slot;
		}

		if ( is_array( $slot ) ) {
			if ( isset( $slot['value'] ) && is_numeric( $slot['value'] ) ) {
				return (int) $slot['value'];
			}
			if ( isset( $slot['default'] ) && is_numeric( $slot['default'] ) ) {
				return (int) $slot['default'];
			}
		}

		return null;
	}

	/**
	 * Whether we should actually slice — guards against "total <= page_size"
	 * which would render the same as show_all but with chrome glued on.
	 *
	 * @since 1.0.0
	 */
	public static function should_paginate( int $total_items, int $page_size ): bool {
		return $total_items > $page_size;
	}
}
