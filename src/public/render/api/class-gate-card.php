<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Describes the per-gate content rendered inside the shared gate card.
 *
 * Gate_Renderer owns the outer structure (ghost grid, overlay, card chrome).
 * Each gate constructs a Gate_Card to supply the parts that differ: icon,
 * heading, description, the interactive body (form, link, etc.), and a few
 * HTML attributes on the outermost wrapper.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Gate_Card {

	/**
	 * @param string               $title         Heading shown inside the card.
	 * @param string               $description   Sub-heading / instruction text.
	 * @param string               $body_html     HTML placed below the description
	 *                                            (form, CTA link, etc.). Already
	 *                                            escaped by the caller.
	 * @param string               $aria_label    aria-label for the overlay element.
	 * @param string               $icon_svg      Optional inline SVG icon. Empty
	 *                                            string = no icon rendered.
	 * @param string               $extra_class   Optional extra class appended to
	 *                                            the outermost wrapper element.
	 * @param array<string,string> $data_attrs    Optional data-* attributes for the
	 *                                            outermost wrapper, e.g.
	 *                                            ['data-fg-restricted' => 'registered-users'].
	 *                                            Keys must include the 'data-' prefix.
	 */
	public function __construct(
		public readonly string $title,
		public readonly string $description,
		public readonly string $body_html,
		public readonly string $aria_label,
		public readonly string $icon_svg = '',
		public readonly string $extra_class = '',
		public readonly array $data_attrs = array(),
	) {}
}
