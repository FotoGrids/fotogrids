<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Shadow;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Applies a responsive box-shadow to gallery thumbnails.
 *
 * Reads shadow_enabled, shadow_color (rgba, alpha-enabled), shadow_offset_x,
 * shadow_offset_y, shadow_blur, and shadow_spread from settings
 * and composes a CSS box-shadow value per breakpoint, emitted as --fg-shadow.
 *
 * @package FotoGrids\Render\Decorators\Shadow
 * @since   1.0.0
 */
final class Shadow implements Decorator {

	use Setting_Helpers;

	public function id(): string {
		return 'fotogrids/shadow';
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
		return $this->setting_to_bool( $render_context->settings['shadow_enabled'] ?? false );
	}

	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		return $collection_items;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array(
			'data-fg-shadow' => 'true',
		);
	}

	public function style_vars( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		$offset_x = $settings['shadow_offset_x'] ?? array();
		$offset_y = $settings['shadow_offset_y'] ?? array();
		$blur     = $settings['shadow_blur'] ?? array();
		$spread   = $settings['shadow_spread'] ?? array();
		$color    = $this->setting_scalar( $settings['shadow_color'] ?? null, 'rgba(0,0,0,0.5)' );

		return array(
			'--fg-shadow' => new Responsive_Var(
				$this->build_shadow( $offset_x, $offset_y, $blur, $spread, $color, 'desktop' ),
				$this->build_shadow( $offset_x, $offset_y, $blur, $spread, $color, 'tablet' ),
				$this->build_shadow( $offset_x, $offset_y, $blur, $spread, $color, 'mobile' ),
			),
		);
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-decorator-shadow' => new Asset_Decl(
					'decorators/shadow/shadow.css'
				),
			)
		);
	}

	/**
	 * Composes a single CSS box-shadow value for one breakpoint.
	 *
	 * @param mixed  $offset_x Responsive X-offset setting (px).
	 * @param mixed  $offset_y Responsive Y-offset setting (px).
	 * @param mixed  $blur     Responsive blur setting (px).
	 * @param mixed  $spread   Responsive spread setting (px).
	 * @param string $color    CSS color string (hex, rgb, rgba, etc.).
	 * @param string $bp       Breakpoint: 'desktop', 'tablet', or 'mobile'.
	 * @return string          CSS box-shadow value.
	 */
	private function build_shadow(
		mixed $offset_x,
		mixed $offset_y,
		mixed $blur,
		mixed $spread,
		string $color,
		string $bp
	): string {
		$x = $this->resolve_responsive_value( $offset_x, $bp, 'px', '0px' );
		$y = $this->resolve_responsive_value( $offset_y, $bp, 'px', '4px' );
		$b = $this->resolve_responsive_value( $blur, $bp, 'px', '10px' );
		$s = $this->resolve_responsive_value( $spread, $bp, 'px', '0px' );

		return "{$x} {$y} {$b} {$s} {$color}";
	}
}
