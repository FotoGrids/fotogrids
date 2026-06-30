<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Immutable value object representing a single option in a filter source.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Filter_Option {

	public string $value;
	public string $label;
	public int $count;

	/**
	 * @param string $value Machine-readable value (e.g. tag slug). Used in
	 *                      data-fg-* attributes and JS token matching. Must be
	 *                      safe for use as an HTML attribute value and a JS
	 *                      space-separated token (no spaces).
	 * @param string $label Human-readable display label (escaped before output).
	 * @param int    $count Number of items carrying this option value.
	 */
	public function __construct(
		string $value,
		string $label,
		int $count
	) {
		$this->value = $value;
		$this->label = $label;
		$this->count = $count;
	}
}
