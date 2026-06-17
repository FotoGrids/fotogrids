<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Shared HTML renderer for all gate lock screens.
 *
 * Owns the structural template that every gate reuses: an inline CSS-var block,
 * a ghost grid placeholder that mirrors the real gallery layout, and a centred
 * overlay card. Individual gates supply their card content via Gate_Card.
 *
 * Ghost grid
 * ----------
 * Renders GHOST_CELL_COUNT placeholder cells inside a CSS grid whose column
 * count and gap mirror the gallery's real layout via CSS custom properties.
 * The count is fixed to keep this path zero-query; it can be overridden by
 * passing a custom value to render() if a gate has reason to differ.
 *
 * Usage
 * -----
 *   // In a Gate::assets() method:
 *   return new Module_Assets(
 *       css: array_merge(
 *           Gate_Renderer::shared_asset_decl(),
 *           [ 'my-gate-css-handle' => new Asset_Decl( path: 'gates/my-gate/my-gate.css' ) ],
 *       )
 *   );
 *
 *   // In a Gate::evaluate() method:
 *   return Gate_Result::block(
 *       html: Gate_Renderer::render( $render_context, new Gate_Card( ... ) ),
 *       http_status: 200,
 *   );
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Gate_Renderer {

	/**
	 * Default number of ghost cells rendered in the placeholder grid.
	 *
	 * Fixed to avoid a DB query in this path. Pass a custom value to render()
	 * if a gate needs a different count.
	 *
	 * @since 1.0.0
	 */
	private const DEFAULT_GHOST_CELL_COUNT = 9;

	/**
	 * Handle used when enqueueing the shared gate CSS.
	 *
	 * @since 1.0.0
	 */
	private const SHARED_CSS_HANDLE = 'fotogrids-gate-lock';

	/**
	 * Path to the shared CSS file, relative to /public/render/.
	 *
	 * @since 1.0.0
	 */
	private const SHARED_CSS_PATH = 'gates/gate-lock.css';

	/**
	 * Returns the Asset_Decl for the shared gate CSS.
	 *
	 * Gates should merge this into their own Module_Assets::css map alongside
	 * their gate-specific Asset_Decl.
	 *
	 * @since  1.0.0
	 * @return array<string, Asset_Decl>
	 */
	public static function shared_asset_decl(): array {
		return array(
			self::SHARED_CSS_HANDLE => new Asset_Decl(
				self::SHARED_CSS_PATH
			),
		);
	}

	/**
	 * Builds the full gate lock-screen HTML.
	 *
	 * Produces: inline CSS-var style block → outer wrapper → ghost grid →
	 * overlay → card (icon? + title + description + body_html).
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context  Render context for this gallery.
	 * @param  Gate_Card      $card            Per-gate card content.
	 * @param  int            $ghost_cell_count Override the default ghost cell count.
	 * @return string
	 */
	public static function render(
		Render_Context $render_context,
		Gate_Card $card,
		int $ghost_cell_count = self::DEFAULT_GHOST_CELL_COUNT
	): string {
		$instance_id = $render_context->meta->instance_id;
		$gallery_id  = $render_context->meta->gallery_id;
		$layout      = $render_context->layout;

		// --- CSS custom-property block -----------------------------------
		$cols_desktop = absint( $layout->responsive_columns['desktop'] ?? 3 ) ?: 3;
		$cols_tablet  = absint( $layout->responsive_columns['tablet'] ?? 2 ) ?: 2;
		$cols_mobile  = absint( $layout->responsive_columns['mobile'] ?? 1 ) ?: 1;

		$gap_desktop = self::resolve_gap( $layout->responsive_spacing['desktop'] ?? array() );
		$gap_tablet  = self::resolve_gap( $layout->responsive_spacing['tablet'] ?? array() );
		$gap_mobile  = self::resolve_gap( $layout->responsive_spacing['mobile'] ?? array() );

		$style = sprintf(
			'<style>'
			. '#%1$s{--fg-cols:%2$d;--fg-gap:%3$s}'
			. '@media(max-width:768px){#%1$s{--fg-cols:%4$d;--fg-gap:%5$s}}'
			. '@media(max-width:480px){#%1$s{--fg-cols:%6$d;--fg-gap:%7$s}}'
			. '</style>',
			esc_attr( $instance_id ),
			$cols_desktop,
			esc_attr( $gap_desktop ),
			$cols_tablet,
			esc_attr( $gap_tablet ),
			$cols_mobile,
			esc_attr( $gap_mobile )
		);

		// --- Ghost grid --------------------------------------------------
		$ghost_cells = str_repeat( '<div class="fg-ghost-cell" aria-hidden="true"></div>', max( 0, $ghost_cell_count ) );

		// --- Wrapper data-* attributes -----------------------------------
		$data_attr_html = '';
		foreach ( $card->data_attrs as $attr_name => $attr_value ) {
			$data_attr_html .= ' ' . esc_attr( $attr_name ) . '="' . esc_attr( $attr_value ) . '"';
		}

		$wrapper_class = trim( 'fotogrids-gate ' . $card->extra_class );

		// --- Icon --------------------------------------------------------
		$icon_html = '';
		if ( '' !== $card->icon_svg ) {
			$icon_html = '<div class="fg-gate-icon" aria-hidden="true">' . $card->icon_svg . '</div>';
		}

		// --- Assemble ----------------------------------------------------
		return sprintf(
			'%s'
			. '<div id="%s" class="%s" data-fg-gallery-id="%d"%s>'
			. '<div class="fg-ghost-grid" aria-hidden="true">%s</div>'
			. '<div class="fg-gate-overlay" role="dialog" aria-modal="false" aria-label="%s">'
			. '<div class="fg-gate-card">'
			. '%s'                 // icon (may be empty)
			. '<p class="fg-gate-title">%s</p>'
			. '<p class="fg-gate-description">%s</p>'
			. '%s'                 // body_html
			. '</div>'             // .fg-gate-card
			. '</div>'             // .fg-gate-overlay
			. '</div>',            // .fotogrids-gate
			$style,
			esc_attr( $instance_id ),
			esc_attr( $wrapper_class ),
			$gallery_id,
			$data_attr_html,
			$ghost_cells,
			esc_attr( $card->aria_label ),
			$icon_html,
			$card->title,
			$card->description,
			$card->body_html
		);
	}

	/**
	 * Resolves a responsive spacing value to a CSS length string (e.g. "10px").
	 *
	 * Mirrors Layout_Grid::resolve_spacing_value() without importing that class.
	 *
	 * @since  1.0.0
	 * @param  mixed $spacing Spacing setting for one breakpoint.
	 * @return string
	 */
	private static function resolve_gap( $spacing ): string {
		if ( is_array( $spacing ) ) {
			$value = $spacing['value'] ?? '';
			$unit  = $spacing['unit'] ?? 'px';
			return '' !== $value ? ( (string) $value . $unit ) : '10px';
		}

		if ( is_numeric( $spacing ) ) {
			return $spacing . 'px';
		}

		return '10px';
	}
}
