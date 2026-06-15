<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Wrapper metadata applied around an item image.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Item_Wrapper {

	/**
	 * @param array<string, string> $attrs Wrapper attributes.
	 */
	public function __construct(
		public readonly string $tag,
		public readonly array $attrs,
	) {}
}
