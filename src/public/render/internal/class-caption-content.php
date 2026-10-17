<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Resolved title and description for one thumbnail caption.
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
	 * Description as safe HTML for display.
	 *
	 * @since 1.3.0
	 * @var string
	 */
	public string $description_html;

	/**
	 * @param string $title            Resolved title, plain text (empty when hidden).
	 * @param string $description      Resolved description, plain text (empty when hidden).
	 * @param string $description_html Description as safe HTML for display; empty unless resolved for display.
	 */
	public function __construct(
		string $title,
		string $description,
		string $description_html = ''
	) {
		$this->title            = $title;
		$this->description      = $description;
		$this->description_html = $description_html;
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
