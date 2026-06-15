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

	public string $tag;
	public array $attrs;

	/**
	 * @param array<string, string> $attrs Wrapper attributes.
	 */
	public function __construct(
		string $tag,
		array $attrs
	) {
		$this->tag   = $tag;
		$this->attrs = $attrs;
	}
}
