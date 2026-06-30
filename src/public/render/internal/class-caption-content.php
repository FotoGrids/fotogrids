<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolved title and description strings for one thumbnail caption.
 *
 * Both fields are empty strings when the corresponding hide toggle is on,
 * meaning the caller can use strict empty checks to decide whether to render
 * each span.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Caption_Content {

	public string $title;
	public string $description;

	/**
	 * @param string $title       Resolved title text (empty when hidden).
	 * @param string $description Resolved description text (empty when hidden).
	 */
	public function __construct(
		string $title,
		string $description
	) {
		$this->title       = $title;
		$this->description = $description;
	}

	/**
	 * Returns true when both title and description are empty.
	 *
	 * Item_Renderer uses this to skip the <figcaption> entirely.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	public function is_empty(): bool {
		return '' === $this->title && '' === $this->description;
	}
}
