<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Border;

use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Applies responsive thumbnail border variables.
 *
 * Reads border_enabled, border_width (responsive, four-sided), border_color,
 * and border_style from settings and emits CSS custom properties consumed by
 * the gallery item stylesheet.
 *
 * @package FotoGrids\Render\Decorators\Border
 * @since   1.0.0
 */
final class Border implements Decorator {

	use Setting_Helpers;

	public function id(): string {
		return 'fotogrids/border';
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
		return $this->setting_to_bool( $render_context->settings['border_enabled'] ?? false );
	}

	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		return $collection_items;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$border_style = $this->setting_scalar( $render_context->settings['border_style'] ?? null, 'solid' );

		return array(
			'data-fg-border' => $border_style,
		);
	}

	public function style_vars( Render_Context $render_context ): array {
		$settings     = $render_context->settings;
		$border_width = $settings['border_width'] ?? array();
		$border_color = $this->setting_scalar( $settings['border_color'] ?? null, '#000000' );
		$border_style = $this->setting_scalar( $settings['border_style'] ?? null, 'solid' );

		return array(
			'--fg-border-w'     => new Responsive_Var(
				desktop: $this->resolve_four_sided_value( $border_width, 'desktop', 'px' ),
				tablet:  $this->resolve_four_sided_value( $border_width, 'tablet', 'px' ),
				mobile:  $this->resolve_four_sided_value( $border_width, 'mobile', 'px' ),
			),
			'--fg-border-color' => $border_color,
			'--fg-border-style' => $border_style,
		);
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}
}
