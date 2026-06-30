<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Carries per-breakpoint values for a single CSS custom property.
 *
 * Modules return this from style_vars() for any property whose value differs
 * across breakpoints. Style_Var_Builder accumulates all Responsive_Var
 * instances and emits exactly one @media block per breakpoint - the number
 * of blocks is bounded by the number of breakpoints, not by the number of
 * properties or decorators.
 *
 * Non-responsive (scalar) vars are still returned as plain strings alongside
 * Responsive_Var instances in the same style_vars() array.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Responsive_Var {

	public string $desktop;
	public string $tablet;
	public string $mobile;

	/**
	 * @since 1.0.0
	 * @param string $desktop Value for the desktop breakpoint (always set).
	 * @param string $tablet  Value for the tablet breakpoint (falls back to desktop if empty).
	 * @param string $mobile  Value for the mobile breakpoint (falls back to tablet if empty).
	 */
	public function __construct(
		string $desktop,
		string $tablet = '',
		string $mobile = ''
	) {
		$this->desktop = $desktop;
		$this->tablet  = $tablet;
		$this->mobile  = $mobile;
	}

	/**
	 * Returns the effective value for a given breakpoint, cascading upward
	 * through desktop → tablet → mobile when a tier is empty.
	 *
	 * @since  1.0.0
	 * @param  string $breakpoint One of 'desktop', 'tablet', 'mobile'.
	 * @return string
	 */
	public function for_breakpoint( string $breakpoint ): string {
		switch ( $breakpoint ) {
			case 'mobile':
				return '' !== $this->mobile ? $this->mobile : $this->for_breakpoint( 'tablet' );
			case 'tablet':
				return '' !== $this->tablet ? $this->tablet : $this->desktop;
			default:
				return $this->desktop;
		}
	}
}
