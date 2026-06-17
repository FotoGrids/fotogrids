<?php
/**
 * Hover-effects decorator for Free effects.
 *
 * @package FotoGrids\Render\Decorators\Effects
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Effects;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Hover_Effect;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Setting_Helpers;
use FotoGrids\Render\Internal\Hover_Effect_Registry;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Applies a Free hover effect to a collection. Effect facts come from the
 * Hover_Effect_Registry; this decorator only renders Free-origin effects.
 *
 * @since 1.0.0
 */
class Hover_Effects implements Decorator {

	use Setting_Helpers;

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
		$effect = $this->resolve_effect( $render_context );

		if ( null === $effect || 'fotogrids' !== $effect->origin ) {
			return false;
		}

		if ( in_array( $render_context->layout->layout_id, $effect->hide_on_layouts, true ) ) {
			return false;
		}

		if ( $effect->requires_caption && ! $this->captions_visible( $render_context ) ) {
			return false;
		}

		return true;
	}

	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		return $collection_items;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$effect = $this->resolve_effect( $render_context );

		if ( null === $effect ) {
			return array();
		}

		return array(
			'data-fg-hover' => $effect->id,
		);
	}

	public function style_vars( Render_Context $render_context ): array {
		$cursor = $this->cursor_icon( $render_context );
		$vars   = array( '--fg-hover-cursor' => $cursor );

		if ( 'default' !== $cursor ) {
			$vars['--fg-hover-cursor-link'] = $cursor;
		}

		$effect = $this->resolve_effect( $render_context );
		if ( null !== $effect ) {
			foreach ( $effect->style_var_defaults as $var_name => $var_value ) {
				$vars[ $var_name ] = $var_value;
			}
		}

		return $vars;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		$effect = $this->resolve_effect( $render_context );

		if ( null === $effect || null === $effect->css_path || 'fotogrids' !== $effect->origin ) {
			return new Module_Assets();
		}

		$css_assets = array(
			'fotogrids-hover-base' => new Asset_Decl( 'decorators/hover/base.css' ),
		);

		if ( 'none' !== $effect->id ) {
			$css_assets[ 'fotogrids-hover-' . $effect->id ] = new Asset_Decl(
				$effect->css_path,
				array( 'fotogrids-hover-base' )
			);
		}

		return new Module_Assets( $css_assets );
	}

	/**
	 * Resolves the active effect descriptor from the registry.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return Hover_Effect|null
	 */
	protected function resolve_effect( Render_Context $render_context ): ?Hover_Effect {
		return Hover_Effect_Registry::get( $this->effect_id( $render_context ) );
	}

	/**
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	protected function effect_id( Render_Context $render_context ): string {
		$effect_id = $render_context->behavior->hover_effect ?? 'none';
		return is_string( $effect_id ) && '' !== $effect_id ? $effect_id : 'none';
	}

	/**
	 * Whether a caption is configured to render for this collection.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return bool
	 */
	protected function captions_visible( Render_Context $render_context ): bool {
		$hide_title = $this->setting_to_bool( $render_context->settings['caption_hide_title'] ?? false );
		$hide_desc  = $this->setting_to_bool( $render_context->settings['caption_hide_description'] ?? false );

		return ! ( $hide_title && $hide_desc );
	}

	/**
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	protected function cursor_icon( Render_Context $render_context ): string {
		return $this->setting_scalar( $render_context->settings['hover_cursor_icon'] ?? null, 'default' );
	}
}
