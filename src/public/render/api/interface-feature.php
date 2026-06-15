<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Contract for render feature modules.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Feature {

	/**
	 * @since   1.0.0
	 * @return  string
	 */
	public function id(): string;

	/**
	 * @since   1.0.0
	 * @return  string
	 */
	public function origin(): string;

	/**
	 * @since   1.0.0
	 * @return  string|null
	 */
	public function replaces(): ?string;

	/**
	 * @since   1.0.0
	 * @return  string|null
	 */
	public function extends_id(): ?string;

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function supports( Render_Context $render_context ): bool;

	/**
	 * HTML injected inside the gallery wrapper, before the layout content.
	 *
	 * Use for UI controls that must live inside the wrapper but precede items
	 * (e.g. filter bar, sort bar, search box). Returned strings from all active
	 * features are concatenated and placed immediately after the <style> block
	 * and before the layout output.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_before( Render_Context $render_context ): string;

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_appendix( Render_Context $render_context ): string;

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_after( Render_Context $render_context ): string;

	/**
	 * Data attributes to merge onto the collection wrapper element.
	 *
	 * Keys must be prefixed with 'data-fg-'. See Decorator::wrapper_data_attrs()
	 * for the full convention.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array;

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string|Responsive_Var>
	 */
	public function style_vars( Render_Context $render_context ): array;

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets;
}
