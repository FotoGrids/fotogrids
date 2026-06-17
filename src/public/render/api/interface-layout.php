<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Contract for render layout modules.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
interface Layout {

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
	 * @return  string
	 */
	public function layout_key(): string;

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function supports( Render_Context $render_context ): bool;

	/**
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @param   Item_Renderer  $item_renderer  Shared item renderer.
	 * @return  string
	 */
	public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string;

	/**
	 * CSS classes added to the wrapper element for layout-specific structural
	 * rules (e.g. 'fg-layout-grid'). Layouts are the only module type that
	 * still contribute classes - everything else uses data attributes.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<int, string>
	 */
	public function structural_classes( Render_Context $render_context ): array;

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

	/**
	 * Preferred WP thumbnail size slug for this layout, or null when the
	 * layout has no preference and the user's configured thumbnail_size
	 * setting should be used as-is.
	 *
	 * By default this is a *soft* preference: it is only consulted when the
	 * user has left thumbnail_size on its default (fotogrids_thumbnail), and
	 * an explicit non-default user choice wins. Structural layouts that
	 * cannot render correctly with an arbitrary size (Justified needs a
	 * fixed-height/variable-width derivative; Masonry needs a
	 * fixed-width/variable-height one) can promote this to a *mandatory*
	 * preference via requires_thumbnail_size(), in which case it overrides
	 * the user's pick too.
	 *
	 * The returned slug still flows through Image_Size_Manager's fallback
	 * chain, so a missing derivative falls back to fotogrids_thumbnail →
	 * thumbnail → medium → full.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string|null
	 */
	public function preferred_thumbnail_size( Render_Context $render_context ): ?string;

	/**
	 * Whether preferred_thumbnail_size() is mandatory for this layout.
	 *
	 * When TRUE, the layout's preferred size overrides an explicit
	 * user-picked thumbnail_size as well as the default - the layout cannot
	 * lay out correctly with any other size. Justified and Masonry return
	 * TRUE; every other layout returns FALSE and keeps the soft-preference
	 * behaviour (only applied when thumbnail_size is on its default).
	 *
	 * A layout returning TRUE here must return a non-null slug from
	 * preferred_thumbnail_size().
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function requires_thumbnail_size( Render_Context $render_context ): bool;

	/**
	 * Capability flags this layout advertises to the rest of the render
	 * pipeline. Lets cross-cutting features (pagination, filtering, etc.)
	 * ask the active layout "do you support this?" without hardcoding a
	 * list of layout IDs.
	 *
	 * Contract:
	 *  - Missing keys default to TRUE (permissive). A layout that returns
	 *    `[]` opts into every capability - the historical default for
	 *    Grid, Masonry, Justified.
	 *  - Returning `[ 'paginates' => false ]` opts out of pagination chrome
	 *    being rendered around this layout (used by Single Item, which
	 *    only ever shows one image).
	 *  - Returning `[ 'filters' => false ]` opts out of the filter bar
	 *    being rendered above this layout.
	 *
	 * Known capability keys (extend this list as new cross-cutting
	 * features need to ask):
	 *  - paginates : bool - Pagination modules should render chrome.
	 *  - filters   : bool - Filter_Ui should render the filter bar.
	 *
	 * @since   1.0.0
	 * @return  array<string, bool>
	 */
	public function capabilities(): array;
}
