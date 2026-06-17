<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Border_Radius;

use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Applies responsive thumbnail border radius variables.
 *
 * @package FotoGrids\Render\Decorators\Border_Radius
 * @since   1.0.0
 */
final class Border_Radius implements Decorator {

	use Setting_Helpers;

	public function id(): string {
		return 'fotogrids/border-radius';
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

	public function supports( Render_Context $render_context ): bool {
		$border_radius = $render_context->settings['border_radius'] ?? array();

		if ( ! is_array( $border_radius ) ) {
			return false;
		}

		foreach ( array( 'desktop', 'tablet', 'mobile' ) as $breakpoint ) {
			if ( $this->breakpoint_has_value( $border_radius[ $breakpoint ] ?? null ) ) {
				return true;
			}
		}

		return false;
	}

	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		return $collection_items;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		$border_radius = $render_context->settings['border_radius'] ?? array();

		return array(
			'--fg-radius' => new Responsive_Var(
				$this->resolve_four_sided_value( $border_radius, 'desktop', 'px' ),
				$this->resolve_four_sided_value( $border_radius, 'tablet', 'px' ),
				$this->resolve_four_sided_value( $border_radius, 'mobile', 'px' ),
			),
		);
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}
}
