<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

use FotoGrids\Hooks\Filters_Render;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Carries the site-level responsive breakpoint configuration.
 *
 * Created once per request from fotogrids_general_settings and passed into
 * Style_Var_Builder so that the breakpoint pixel values used in emitted
 * @media blocks match whatever the user has configured - they are never
 * hardcoded in PHP or CSS.
 *
 * Filterable via 'fotogrids/render/breakpoint_config' before the render
 * pipeline runs, so Pro or third-party plugins can adjust breakpoints
 * without touching core code.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Breakpoint_Config {

	public int $tablet_max_width;
	public int $mobile_max_width;
	public bool $detect_by_browser;

	/**
	 * @since 1.0.0
	 * @param int  $tablet_max_width  Viewport width (px) at which the tablet
	 *                                breakpoint activates (max-width condition).
	 * @param int  $mobile_max_width  Viewport width (px) at which the mobile
	 *                                breakpoint activates (max-width condition).
	 * @param bool $detect_by_browser When true, the breakpoint follows the
	 *                                device class the frontend runtime writes
	 *                                to html[data-fg-breakpoint] instead of
	 *                                the viewport width.
	 */
	public function __construct(
		int $tablet_max_width,
		int $mobile_max_width,
		bool $detect_by_browser = false
	) {
		$this->tablet_max_width  = $tablet_max_width;
		$this->mobile_max_width  = $mobile_max_width;
		$this->detect_by_browser = $detect_by_browser;
	}

	/**
	 * Wrapper data attributes that hand the configuration to the frontend
	 * runtime, which classifies the visitor against the same widths.
	 *
	 * @since  1.1.3
	 * @return array<string, string>
	 */
	public function wrapper_attrs(): array {
		return array(
			'data-fg-breakpoints'       => $this->mobile_max_width . ' ' . $this->tablet_max_width,
			'data-fg-breakpoint-detect' => $this->detect_by_browser ? 'device' : 'viewport',
		);
	}

	/**
	 * Wraps a declaration block so it applies at the given breakpoint and
	 * every narrower one.
	 *
	 * Viewport detection emits a max-width @media block. Device detection
	 * scopes the rule under html[data-fg-breakpoint], which the runtime sets
	 * from the device class, and keeps the max-width block as the fallback
	 * for the moment before the runtime has run.
	 *
	 * @since  1.1.3
	 * @param  string $breakpoint   'tablet' or 'mobile'.
	 * @param  string $selector     Selector the declarations belong to.
	 * @param  string $declarations Declarations, one per line, without braces.
	 * @return string
	 */
	public function scope( string $breakpoint, string $selector, string $declarations ): string {
		$width = 'mobile' === $breakpoint ? $this->mobile_max_width : $this->tablet_max_width;

		if ( ! $this->detect_by_browser ) {
			return '@media (max-width: ' . $width . "px) {\n"
				. '    ' . $selector . " {\n" . $declarations . "    }\n"
				. "}\n";
		}

		$classes   = 'mobile' === $breakpoint ? array( 'mobile' ) : array( 'tablet', 'mobile' );
		$selectors = array();
		foreach ( $classes as $class ) {
			$selectors[] = 'html[data-fg-breakpoint="' . $class . '"] ' . $selector;
		}

		return implode( ', ', $selectors ) . " {\n" . $declarations . "}\n"
			. '@media (max-width: ' . $width . "px) {\n"
			. '    html:not([data-fg-breakpoint]) ' . $selector . " {\n" . $declarations . "    }\n"
			. "}\n";
	}

	/**
	 * Builds a Breakpoint_Config from the stored fotogrids_general_settings,
	 * then passes it through the 'fotogrids/render/breakpoint_config' filter
	 * so Pro and third-party plugins can adjust values before any render runs.
	 *
	 * @since  1.0.0
	 * @return self
	 */
	public static function from_settings(): self {
		$stored   = get_option( 'fotogrids_general_settings', array() );
		$settings = is_array( $stored ) ? $stored : array();

		$tablet     = isset( $settings['tablet_breakpoint'] ) ? absint( $settings['tablet_breakpoint'] ) : 1024;
		$mobile     = isset( $settings['mobile_breakpoint'] ) ? absint( $settings['mobile_breakpoint'] ) : 767;
		$by_browser = ! empty( $settings['detect_responsive_by_browser'] );

		// Guard: mobile must be strictly less than tablet.
		if ( $mobile >= $tablet ) {
			$mobile = (int) round( $tablet * 0.75 );
		}

		$config = new self(
			$tablet,
			$mobile,
			$by_browser,
		);

		/**
		 * Filters the breakpoint configuration used by the render engine.
		 *
		 * @since 1.0.0
		 * @param Breakpoint_Config $config The resolved configuration.
		 */
		return apply_filters( Filters_Render::BREAKPOINT_CONFIG, $config );
	}
}
