<?php
declare(strict_types=1);

namespace FotoGrids\Render\Sorters\Random;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Sorter;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Random sorter - shuffles the item list on every public render.
 *
 * The shuffle is seeded and therefore stable for the lifetime of whatever
 * cache holds the rendered page. The random_mode setting decides how that is
 * answered. MODE_REFETCH (default) and MODE_REORDER both keep the page
 * cacheable and are handled client-side by random-sort.js; MODE_UNCACHED
 * re-renders per request and opts the page out of caching instead.
 *
 * @package FotoGrids\Render\Sorters\Random
 * @since   1.0.0
 */
final class Random_Sorter implements Sorter {

	/**
	 * random_mode value: the page stays cacheable and the browser requests a
	 * fresh random selection once it has loaded. The only mode that can change
	 * which items appear when the render is a subset of the collection.
	 *
	 * @since 1.0.0
	 */
	public const MODE_REFETCH = 'refetch';

	/**
	 * random_mode value: the page stays cacheable and the browser rearranges
	 * the items it was served. No request, but the selection cannot change.
	 *
	 * @since 1.0.0
	 */
	public const MODE_REORDER = 'reorder';

	/**
	 * random_mode value: a fresh order is chosen while the page is built, and
	 * the page opts out of every cache so the choice is not stored.
	 *
	 * @since 1.0.0
	 */
	public const MODE_UNCACHED = 'uncached';

	/**
	 * Resolve the random_mode setting. Unrecognised values fall back to
	 * MODE_REFETCH, which matches the shipped default.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $settings Collection settings.
	 * @return string
	 */
	public static function mode( array $settings ): string {
		$mode = (string) ( $settings['random_mode'] ?? '' );

		return in_array( $mode, array( self::MODE_REORDER, self::MODE_UNCACHED ), true )
			? $mode
			: self::MODE_REFETCH;
	}

	/**
	 * Whether the supplied settings select random sorting resolved in the
	 * visitor's browser - either by rearranging the rendered items or by
	 * requesting a fresh selection.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $settings Collection settings.
	 * @return bool
	 */
	public static function is_client_randomized( array $settings ): bool {
		return 'random' === ( $settings['default_sort_order'] ?? '' )
			&& self::MODE_UNCACHED !== self::mode( $settings );
	}

	/**
	 * Whether the supplied settings select random sorting served from the
	 * server on every request.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $settings Collection settings.
	 * @return bool
	 */
	public static function is_server_randomized( array $settings ): bool {
		return 'random' === ( $settings['default_sort_order'] ?? '' )
			&& self::MODE_UNCACHED === self::mode( $settings );
	}

	public function id(): string {
		return 'fotogrids/sort/random';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	/**
	 * Active when default_sort_order is 'random' on a public render.
	 *
	 * @since  1.0.0
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( $render_context->meta->is_preview ) {
			return false;
		}

		return ( $render_context->settings['default_sort_order'] ?? '' ) === 'random';
	}

	/**
	 * Returns a shuffled copy of $item_ids using a deterministic shuffle
	 * seeded by Render_Meta::random_seed.
	 *
	 * Why deterministic? Because pagination + filtering rebuild the
	 * Render_Context per request. With a non-seeded shuffle, page 2
	 * would draw from a different random permutation than page 1 - items
	 * that appeared on page 1 could reappear on page 2, and others would
	 * never show up. The seed travels with every paginated request (set
	 * once on the initial render, sent back by the client thereafter)
	 * so all pages of one visitor's session draw from the same shuffle.
	 *
	 * Implementation: Fisher-Yates with mt_srand. We don't use the older
	 * srand()/array_rand() path; mt_srand gives reproducible output
	 * cross-platform.
	 *
	 * @since  1.0.0
	 */
	public function sort( array $item_ids, Render_Context $render_context ): array {
		$shuffled = array_values( $item_ids );
		$count    = count( $shuffled );
		if ( $count < 2 ) {
			return $shuffled;
		}

		$seed = $render_context->meta->random_seed;
		if ( null === $seed ) {
			// No seed inherited - fall back to a non-deterministic shuffle.
			shuffle( $shuffled );
			return $shuffled;
		}

		// Seed once and consume mt_rand() values. mt_srand resets the
		// global PHP Mersenne Twister state - fine here because the
		// renderer runs synchronously per request.
        // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_seeding_mt_srand -- Deterministic, seed-reproducible shuffle is required so a gallery renders the same order across requests/pagination; wp_rand() is non-seedable by design.
		mt_srand( (int) $seed );
		for ( $i = $count - 1; $i > 0; $i-- ) {
            // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_mt_rand -- Paired with the seeded mt_srand() above for a reproducible shuffle, not a security-sensitive RNG.
			$j              = mt_rand( 0, $i );
			$tmp            = $shuffled[ $i ];
			$shuffled[ $i ] = $shuffled[ $j ];
			$shuffled[ $j ] = $tmp;
		}
		// Re-seed from time so any later mt_rand() callers aren't
		// pinned to our seed.
        // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_seeding_mt_srand -- Restores entropy-fresh global PRNG state after our deterministic shuffle; no argument = re-seed from entropy.
		mt_srand();

		return $shuffled;
	}

	/**
	 * Declares the client-side randomization module.
	 *
	 * Returned only for gallery renders the JS will actually act on - those
	 * carrying data-fg-random-mode. MODE_UNCACHED and albums ship nothing. The
	 * stylesheet holds the items while a fetch is in flight, so it is declared
	 * for MODE_REFETCH only.
	 *
	 * @since  1.0.0
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		if ( Collection_Kind::GALLERY !== $render_context->meta->collection_kind
			|| ! self::is_client_randomized( $render_context->settings )
		) {
			return new Module_Assets();
		}

		$css = array();
		if ( self::MODE_REFETCH === self::mode( $render_context->settings ) ) {
			$css['fotogrids-random-sort'] = new Asset_Decl( 'sorters/random/random-sort.css' );
		}

		return new Module_Assets(
			$css,
			array(
				'fotogrids-random-sort' => new Asset_Decl(
					'../../assets/js/random-sort.js',
					array( 'fotogrids-runtime' ),
					true
				),
			)
		);
	}
}
