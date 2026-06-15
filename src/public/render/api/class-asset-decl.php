<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Asset declaration metadata for module assets.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Asset_Decl {

	/**
	 * @param array<int, string> $deps Asset dependency handles.
	 */
	public function __construct(
		public readonly string $path,
		public readonly array $deps = array(),
		public readonly bool $in_footer = false,
		public readonly ?string $plugin_origin = null,
	) {}
}
