<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * SVG Helpers
 *
 * Shared utilities for safely outputting the plugin's own trusted inline SVG
 * markup (logos, icons). All SVGs handled here ship with the plugin and never
 * contain user input, but Plugin Check (and good practice) still requires
 * echoed markup to pass through wp_kses() with an explicit allowlist.
 */
final class Svg {

    /**
     * Allowed tags and attributes for wp_kses() when echoing trusted inline SVG.
     *
     * This is the union of every element/attribute used by the plugin's bundled
     * SVGs (logos and icons), so a single call site can render any of them.
     * wp_kses() strips anything not listed here, so keep this limited to the
     * presentational SVG primitives the plugin actually ships.
     *
     * @return array<string,array<string,bool>> Allowlist suitable for wp_kses().
     */
    public static function kses_allowed() {
        return array(
            'svg'     => array(
                'id'      => true,
                'class'   => true,
                'width'   => true,
                'height'  => true,
                'viewbox' => true,
                'fill'    => true,
                'xmlns'   => true,
                'style'   => true,
            ),
            'rect'    => array(
                'x'            => true,
                'y'            => true,
                'width'        => true,
                'height'       => true,
                'rx'           => true,
                'ry'           => true,
                'fill'         => true,
                'stroke'       => true,
                'stroke-width' => true,
                'style'        => true,
            ),
            'path'    => array(
                'd'               => true,
                'fill'            => true,
                'stroke'          => true,
                'stroke-width'    => true,
                'stroke-linecap'  => true,
                'stroke-linejoin' => true,
                'style'           => true,
            ),
            'polygon' => array(
                'points' => true,
                'fill'   => true,
                'style'  => true,
            ),
        );
    }

    /**
     * Echo trusted inline SVG markup through wp_kses().
     *
     * Convenience wrapper so call sites don't repeat the allowlist argument.
     *
     * @param string $svg Trusted, plugin-shipped SVG markup.
     * @return void
     */
    public static function render( $svg ) {
        echo wp_kses( $svg, self::kses_allowed() ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wp_kses() is the escaping function.
    }
}
