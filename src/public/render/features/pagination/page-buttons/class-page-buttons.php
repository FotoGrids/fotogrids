<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Pagination\Page_Buttons;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Features\Pagination\Pagination_Common;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Page-button pagination ("1 2 3 … 7  Next").
 *
 * Active when:
 *   - pagination_type   === 'paginated'
 *   - pagination_method === 'pages'
 *
 * Renders the prev/next + numbered-page bar after the layout (via
 * html_after). Client-side, clicks call
 * FotoGrids.modules.pagination.goToPage(gEl, n, { mode: 'replace' }).
 *
 * Reads:
 *   - pagination_alignment          (left | center | right)
 *   - pages_show_prev_next          (bool)
 *   - pages_prev_text / pages_next_text (string)
 *   - pages_button_icon             (none | chevron | chevron_double | arrow
 *                                    | arrow_narrow | arrow_square
 *                                    | arrow_circle | arrow_circle_broken
 *                                    | arrow_block) - mirrors lightbox_arrow_icon
 *   - pages_show_numbers            (bool)
 *   - pages_truncate                (bool - when true, JS runs the
 *                                    boundary+siblings windowing algorithm
 *                                    with hardcoded sibling counts emitted
 *                                    via --fg-pagination-siblings; when
 *                                    false, every page button is shown.)
 *
 * @package FotoGrids\Render\Features\Pagination\Page_Buttons
 * @since   1.0.0
 */
final class Page_Buttons implements Feature {

	use Pagination_Common;

	/** @var array<int, string> */
	private const ALLOWED_ALIGNMENTS = array( 'stretch', 'left', 'center', 'right' );

	/**
	 * Allowed icon style values. Mirrors lightbox_arrow_icon options exactly,
	 * with 'none' added on top. SVG pairs are loaded from the lightbox feature's
	 * arrow-icons.json (single source of truth).
	 *
	 * @var array<int, string>
	 */
	private const ALLOWED_ICONS = array(
		'none',
		'chevron',
		'chevron_double',
		'arrow',
		'arrow_narrow',
		'arrow_square',
		'arrow_circle',
		'arrow_circle_broken',
		'arrow_block',
	);

	/** @var array<string, array{prev: string, next: string}>|null */
	private static ?array $arrow_icons_cache = null;

	/**
	 * Loads arrow SVG pairs from the lightbox feature's arrow-icons.json,
	 * cached for the request. Same JSON as Lightbox::arrow_icons() so the
	 * two surfaces stay visually in sync without duplicating the SVGs.
	 *
	 * @return array<string, array{prev: string, next: string}>
	 */
	private static function arrow_icons(): array {
		if ( null !== self::$arrow_icons_cache ) {
			return self::$arrow_icons_cache;
		}
		$path = __DIR__ . '/../../lightbox/arrow-icons.json';
		if ( file_exists( $path ) ) {
			$decoded = json_decode( file_get_contents( $path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a bundled local plugin file (not a remote URL); WP_Filesystem is unnecessary here.
			if ( is_array( $decoded ) ) {
				self::$arrow_icons_cache = $decoded;
				return self::$arrow_icons_cache;
			}
		}
		// Fallback: bare chevrons so the pager always has something.
		self::$arrow_icons_cache = array(
			'chevron' => array(
				'prev' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
				'next' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			),
		);
		return self::$arrow_icons_cache;
	}

	public function id(): string {
		return 'fotogrids/pagination/page-buttons';
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
		if ( ! $this->pagination_supports( $render_context ) ) {
			return false;
		}

		return ( $render_context->settings['pagination_method'] ?? '' ) === 'pages';
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Renders the pagination bar:
	 *   [Prev]  [1] [2] [3] … [N]  [Next]
	 *
	 * Each section is optional based on pages_show_prev_next and
	 * pages_show_numbers. JS owns the active state and ellipsis trimming
	 * (max-visible). PHP renders the initial state for page 1.
	 *
	 * Uses html_appendix (NOT html_after) so the bar lives INSIDE the
	 * gallery wrapper - see Load_More for the same reasoning.
	 *
	 * @since 1.0.0
	 */
	public function html_appendix( Render_Context $render_context ): string {
		$align          = $this->resolve_alignment( $render_context );
		$show_prev_next = (bool) ( $render_context->settings['pages_show_prev_next'] ?? true );
		$show_numbers   = (bool) ( $render_context->settings['pages_show_numbers'] ?? true );
		$icon           = $this->resolve_icon( $render_context );

		$page_size   = self::resolve_page_size( $render_context->settings, $render_context );
		$total       = (int) ( $render_context->meta->total_item_count ?? count( $render_context->items ) );
		$total_pages = max( 1, (int) ceil( $total / $page_size ) );
		$current     = max( 1, (int) ( $render_context->meta->requested_page ?? 1 ) );

		$html = sprintf(
			'<nav class="fg-pagination fg-pagination--pages fg-pagination--align-%s"'
			. ' data-fg-pagination-role="pages" aria-label="%s">',
			esc_attr( $align ),
			esc_attr__( 'Gallery pagination', 'fotogrids' )
		);

		if ( $show_prev_next ) {
			$html .= $this->render_prev_button( $render_context, $current, $icon );
		}

		if ( $show_numbers ) {
			$html .= $this->render_number_buttons( $current, $total_pages );
		}

		if ( $show_prev_next ) {
			$html .= $this->render_next_button( $render_context, $current, $total_pages, $icon );
		}

		$html .= '<div class="fg-pagination__status" role="status" aria-live="polite"></div>';
		$html .= '</nav>';

		return $html;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$attrs = $this->common_wrapper_attrs( $render_context, 'pages' );

		// Flag whether the JS should run the windowing algorithm or render
		// every page button untouched. JS reads dataset.fgPagesTruncate.
		$truncate                        = (bool) ( $render_context->settings['pages_truncate'] ?? true );
		$attrs['data-fg-pages-truncate'] = $truncate ? '1' : '0';

		return $attrs;
	}

	public function style_vars( Render_Context $render_context ): array {
		// Start from the shared trait - currently emits
		// `--fg-pagination-distance` (margin above the bar).
		$vars = $this->common_style_vars( $render_context );

		// When truncation is off we render the full list - no sibling var needed.
		if ( ! (bool) ( $render_context->settings['pages_truncate'] ?? true ) ) {
			return $vars;
		}

		// Sibling count is hardcoded - the user only chooses truncate on/off.
		// Two on desktop/tablet matches the long-form Bootstrap/Material/GitHub
		// pattern; one on mobile keeps the bar to ~5 chips + 2 ellipses at the
		// worst case (current in the middle). Boundaries (first + last) are
		// always 1 each, so the totals are:
		//   - desktop/tablet: 1 + 1 + (2*2 + 1) + 1 + 1 = 9 slots worst case
		//   - mobile:         1 + 1 + (2*1 + 1) + 1 + 1 = 7 slots worst case
		//
		// The Responsive_Var flows the mobile value through whatever
		// mobile_breakpoint the user has configured - see Breakpoint_Config.
		$vars['--fg-pagination-siblings'] = new Responsive_Var(
			'2',
			'2',
			'1',
		);

		return $vars;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		$common = $this->common_assets();

		return new Module_Assets(
			array_merge(
				$common->css,
				array(
					'fotogrids-pagination-page-buttons' => new Asset_Decl(
						'features/pagination/page-buttons/page-buttons.css',
						array(),
						false,
					),
				)
			),
			array_merge(
				$common->js,
				array(
					'fotogrids-pagination-page-buttons' => new Asset_Decl(
						'../../assets/js/page-buttons.js',
						array( 'fotogrids-pagination-core' ),
						true,
					),
				)
			)
		);
	}

	private function render_prev_button( Render_Context $render_context, int $current, string $icon ): string {
		$label    = $this->resolve_prev_text( $render_context );
		$disabled = $current <= 1 ? ' disabled' : '';
		$icon_svg = $this->render_icon( $icon, 'prev' );

		return sprintf(
			'<button type="button" class="fg-pagination__btn fg-pagination__prev"'
			. ' data-fg-pagination-trigger="prev"%s>%s%s</button>',
			$disabled,
			$icon_svg,
			esc_html( $label )
		);
	}

	private function render_next_button( Render_Context $render_context, int $current, int $total_pages, string $icon ): string {
		$label    = $this->resolve_next_text( $render_context );
		$disabled = $current >= $total_pages ? ' disabled' : '';
		$icon_svg = $this->render_icon( $icon, 'next' );

		return sprintf(
			'<button type="button" class="fg-pagination__btn fg-pagination__next"'
			. ' data-fg-pagination-trigger="next"%s>%s%s</button>',
			$disabled,
			esc_html( $label ),
			$icon_svg
		);
	}

	/**
	 * Renders the numbered buttons block.
	 *
	 * PHP emits every page button; JS handles ellipsis trimming based on
	 * data-fg-pages-truncate + --fg-pagination-siblings. This keeps PHP
	 * simple and lets the client respond to viewport changes (the mobile
	 * sibling count) without a re-render.
	 *
	 * @since 1.0.0
	 */
	private function render_number_buttons( int $current, int $total_pages ): string {
		$html = '<ol class="fg-pagination__numbers" role="list">';

		for ( $page = 1; $page <= $total_pages; $page++ ) {
			$active_class = $page === $current ? ' fg-is-active' : '';
			$aria_current = $page === $current ? ' aria-current="page"' : '';

			$html .= sprintf(
				'<li class="fg-pagination__number-item"><button type="button"'
				. ' class="fg-pagination__btn fg-pagination__number%s"'
				. ' data-fg-pagination-trigger="page" data-fg-pagination-page="%d"%s>%d</button></li>',
				$active_class,
				$page,
				$aria_current,
				$page
			);
		}

		$html .= '</ol>';

		return $html;
	}

	/**
	 * Returns the inline SVG for the chosen icon, oriented correctly for
	 * prev or next. Returns empty string for 'none'.
	 *
	 * SVG pairs come from the lightbox feature's arrow-icons.json so the
	 * arrow styles offered for pagination match the lightbox 1:1. The SVGs
	 * are already oriented per side (prev/next) - no CSS flip needed.
	 *
	 * The raw SVG markup is wrapped in a span carrying the class +
	 * data-fg-icon attribute so CSS can size/style icons consistently. We
	 * don't re-emit the SVG markup ourselves because each icon's <path>
	 * geometry is unique.
	 *
	 * @since 1.0.0
	 * @param string $icon  One of self::ALLOWED_ICONS.
	 * @param string $side  'prev' | 'next' - picks the correctly oriented SVG.
	 */
	private function render_icon( string $icon, string $side ): string {
		if ( 'none' === $icon ) {
			return '';
		}

		$icons = self::arrow_icons();
		$pair  = $icons[ $icon ] ?? $icons['chevron'] ?? null;
		if ( ! is_array( $pair ) ) {
			return '';
		}

		$svg = 'next' === $side ? ( $pair['next'] ?? '' ) : ( $pair['prev'] ?? '' );
		if ( '' === $svg ) {
			return '';
		}

		// The SVG is wrapped so the page-buttons.css selector targets a stable
		// hook (`.fg-pagination__icon`) regardless of which arrow style is in
		// use. The raw markup is trusted - it comes from a plugin-owned JSON
		// file, not from user input.
		return sprintf(
			'<span class="fg-pagination__icon fg-pagination__icon--%s" data-fg-icon="%s" aria-hidden="true">%s</span>',
			esc_attr( $icon ),
			esc_attr( $side ),
			$svg
		);
	}

	private function resolve_alignment( Render_Context $render_context ): string {
		$value = $render_context->settings['pagination_alignment'] ?? 'center';

		return in_array( $value, self::ALLOWED_ALIGNMENTS, true )
			? (string) $value
			: 'center';
	}

	private function resolve_icon( Render_Context $render_context ): string {
		$value = $render_context->settings['pages_button_icon'] ?? 'chevron';

		return in_array( $value, self::ALLOWED_ICONS, true )
			? (string) $value
			: 'chevron';
	}

	private function resolve_prev_text( Render_Context $render_context ): string {
		$raw = $render_context->settings['pages_prev_text'] ?? '';
		$raw = is_string( $raw ) ? trim( $raw ) : '';

		return '' !== $raw ? $raw : __( 'Previous', 'fotogrids' );
	}

	private function resolve_next_text( Render_Context $render_context ): string {
		$raw = $render_context->settings['pages_next_text'] ?? '';
		$raw = is_string( $raw ) ? trim( $raw ) : '';

		return '' !== $raw ? $raw : __( 'Next', 'fotogrids' );
	}
}
