<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Effects;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Hover effects decorator for Free effects.
 *
 * @package FotoGrids\Render\Decorators\Effects
 * @since   1.0.0
 */
class Hover_Effects implements Decorator {

	use Setting_Helpers;

	/**
	 * @var array<int, string>
	 */
	protected const SUPPORTED_EFFECTS = array(
		'none',
		'fade',
		'zoom-in',
		'zoom-soft',
		'slide-up',
		'slide-down',
		'slide-left',
		'slide-right',
		'fade-caption',
		'blur',
		'shadow-lift',
		'border-grow',
		'pulse',
		'tilt',
	);

	/**
	 * @var array<string, string>
	 */
	protected const EFFECT_ALIASES = array(
		'fade-both' => 'fade-caption',
		'scale'     => 'zoom-soft',
		'rotate'    => 'tilt',
		'opacity'   => 'fade',
		'shadow'    => 'shadow-lift',
		'border'    => 'border-grow',
	);

	public function id(): string {
		return 'fotogrids/hover-effect';
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
		$effect_id = $this->normalized_effect_id( $render_context );
		return in_array( $effect_id, static::SUPPORTED_EFFECTS, true );
	}

	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		return $collection_items;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$effect_id = $this->normalized_effect_id( $render_context );

		return array(
			'data-fg-hover' => $effect_id,
		);
	}

	public function style_vars( Render_Context $render_context ): array {
		$cursor = $this->cursor_icon( $render_context );
		$vars   = array( '--fg-hover-cursor' => $cursor );

		// When the cursor is 'default', the <a> inside .fg-item should fall back
		// to the browser's natural pointer - so we omit --fg-hover-cursor-link and
		// let the CSS fallback (pointer) take over. For any other value the link
		// should match the chosen cursor, so we set the var explicitly.
		if ( 'default' !== $cursor ) {
			$vars['--fg-hover-cursor-link'] = $cursor;
		}

		return $vars;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		$effect_id = $this->normalized_effect_id( $render_context );

		$css_assets = array(
			'fotogrids-hover-base' => new Asset_Decl(
				'decorators/hover/effects/none.css'
			),
		);

		if ( 'none' !== $effect_id ) {
			$css_assets[ 'fotogrids-hover-' . $effect_id ] = new Asset_Decl(
				'decorators/hover/effects/' . $effect_id . '.css'
			);
		}

		return new Module_Assets( $css_assets );
	}

	protected function effect_id( Render_Context $render_context ): string {
		$effect_id = $render_context->behavior->hover_effect ?? 'none';
		return is_string( $effect_id ) && '' !== $effect_id ? $effect_id : 'none';
	}

	/**
	 * Resolve canonical effect ID from aliases.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	protected function normalized_effect_id( Render_Context $render_context ): string {
		$effect_id = $this->effect_id( $render_context );
		return static::EFFECT_ALIASES[ $effect_id ] ?? $effect_id;
	}

	/**
	 * Resolve hover cursor icon from settings.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	protected function cursor_icon( Render_Context $render_context ): string {
		return $this->setting_scalar( $render_context->settings['hover_cursor_icon'] ?? null, 'default' );
	}
}
