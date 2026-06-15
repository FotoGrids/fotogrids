<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Immutable behavior configuration values.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Behavior {

	public string $click_behavior;
	public string $pagination_type;
	public string $pagination_method;
	public ?string $hover_effect;

	/**
	 * @since   1.0.0
	 * @param   string      $click_behavior Click interaction mode.
	 * @param   string      $pagination_type Pagination type.
	 * @param   string      $pagination_method Pagination method.
	 * @param   string|null $hover_effect Hover effect ID.
	 * @return  void
	 */
	public function __construct(
		string $click_behavior,
		string $pagination_type,
		string $pagination_method,
		?string $hover_effect
	) {
		$this->click_behavior = $click_behavior;
		$this->pagination_type = $pagination_type;
		$this->pagination_method = $pagination_method;
		$this->hover_effect = $hover_effect;
	}
}
