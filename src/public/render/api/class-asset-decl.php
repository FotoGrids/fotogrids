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

	public string $path;
	public array $deps;
	public bool $in_footer;
	public ?string $plugin_origin;

	/**
	 * @param array<int, string> $deps Asset dependency handles.
	 */
	public function __construct(
		string $path,
		array $deps = array(),
		bool $in_footer = false,
		?string $plugin_origin = null
	) {
		$this->path = $path;
		$this->deps = $deps;
		$this->in_footer = $in_footer;
		$this->plugin_origin = $plugin_origin;
	}
}
