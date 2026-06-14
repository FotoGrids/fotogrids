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

    /**
     * Canonical FotoGrids brand colors.
     */
    const BRAND_COLORS = array(
        'top'         => '#3c46f0',
        'mid_left'    => '#f01e32',
        'bottom_left' => '#ffb914',
        'bottom_mid'  => '#323232',
        'mid_right'   => '#323232',
    );

    /**
     * The FotoGrids icon.
     *
     * @param array $args {
     *     @type string|null $fill    Single fill for every rect (e.g. '#a7aaad'
     *                                or 'currentColor'). Null uses brand colours.
     *     @type int|string  $size    Width/height. Omit for no explicit size.
     *     @type string      $id      Root <svg> id. Default 'fotogrids-logo'.
     *     @type string      $viewbox viewBox. Default '0 0 59.53 59.53'.
     * }
     * @return string SVG markup (pass through Svg::render() to echo).
     */
    public static function fotogrids_icon( $args = array() ) {
        $args = array_merge(
            array(
                'fill'    => null,
                'size'    => null,
                'id'      => 'fotogrids-logo',
                'viewbox' => '0 0 59.53 59.53',
            ),
            $args
        );

        $c = self::BRAND_COLORS;
        $solid = $args['fill'];
        $f = static function ( $key ) use ( $solid, $c ) {
            return null !== $solid ? $solid : $c[ $key ];
        };

        $size_attr = '';
        if ( null !== $args['size'] ) {
            $size_attr = ' width="' . esc_attr( $args['size'] ) . '" height="' . esc_attr( $args['size'] ) . '"';
        }

        return '<svg id="' . esc_attr( $args['id'] ) . '" xmlns="http://www.w3.org/2000/svg" viewBox="' . esc_attr( $args['viewbox'] ) . '"' . $size_attr . '>'
            . '<rect x="1.42" y="1.42" width="56.69" height="14.17" fill="' . $f( 'top' ) . '"/>'
            . '<rect x="1.42" y="22.68" width="35.43" height="14.17" fill="' . $f( 'mid_left' ) . '"/>'
            . '<rect x="1.42" y="43.94" width="14.17" height="14.17" fill="' . $f( 'bottom_left' ) . '"/>'
            . '<rect x="22.68" y="43.94" width="14.17" height="14.17" fill="' . $f( 'bottom_mid' ) . '"/>'
            . '<rect x="43.94" y="22.68" width="14.17" height="35.43" fill="' . $f( 'mid_right' ) . '"/>'
            . '</svg>';
    }

    /**
     * The full FotoGrids logo.
     *
     * @param array $args {
     *     @type string $id      Root <svg> id. Default 'fotogrids-logo'.
     *     @type string $viewbox viewBox. Default '0 0 351.5 59.53'.
     * }
     * @return string SVG markup (pass through Svg::render() to echo).
     */
    public static function fotogrids_logo( $args = array() ) {
        $args = array_merge(
            array(
                'id'      => 'fotogrids-logo',
                'viewbox' => '0 0 351.5 59.53',
            ),
            $args
        );

        $c    = self::BRAND_COLORS;
        $dark = $c['bottom_mid'];

        return '<svg id="' . esc_attr( $args['id'] ) . '" xmlns="http://www.w3.org/2000/svg" viewBox="' . esc_attr( $args['viewbox'] ) . '">'
            . '<rect x="1.42" y="1.42" width="56.69" height="14.17" fill="' . $c['top'] . '"/>'
            . '<rect x="1.42" y="22.68" width="35.43" height="14.17" fill="' . $c['mid_left'] . '"/>'
            . '<rect x="1.42" y="43.94" width="14.17" height="14.17" fill="' . $c['bottom_left'] . '"/>'
            . '<rect x="22.68" y="43.94" width="14.17" height="14.17" fill="' . $c['bottom_mid'] . '"/>'
            . '<rect x="43.94" y="22.68" width="14.17" height="35.43" fill="' . $c['mid_right'] . '"/>'
            . '<rect x="282.15" y="22.68" width="4.25" height="35.43" fill="' . $dark . '"/>'
            . '<polygon points="167.24 22.68 138.9 22.68 138.9 31.18 147.4 31.18 147.4 58.11 158.74 58.11 158.74 31.18 167.24 31.18 167.24 22.68" fill="' . $dark . '"/>'
            . '<polygon points="97.8 31.18 97.8 22.68 72.28 22.68 72.28 58.11 83.62 58.11 83.62 46.77 94.96 46.77 94.96 38.27 83.62 38.27 83.62 31.18 97.8 31.18" fill="' . $dark . '"/>'
            . '<path d="M119.06,33.31c3.91,0,7.09,3.18,7.09,7.09s-3.18,7.09-7.09,7.09-7.09-3.18-7.09-7.09,3.18-7.09,7.09-7.09M119.06,21.97c-10.18,0-18.43,8.25-18.43,18.43s8.25,18.43,18.43,18.43,18.43-8.25,18.43-18.43-8.25-18.43-18.43-18.43h0Z" fill="' . $dark . '"/>'
            . '<path d="M187.09,33.31c3.91,0,7.09,3.18,7.09,7.09s-3.18,7.09-7.09,7.09-7.09-3.18-7.09-7.09,3.18-7.09,7.09-7.09M187.09,21.97c-10.18,0-18.43,8.25-18.43,18.43s8.25,18.43,18.43,18.43,18.43-8.25,18.43-18.43-8.25-18.43-18.43-18.43h0Z" fill="' . $dark . '"/>'
            . '<path d="M338.84,58.82c-6.25,0-11.34-5.09-11.34-11.34h4.25c0,3.91,3.18,7.09,7.09,7.09,3.43,0,7.09-1.49,7.09-5.67,0-2.93-2.99-4.43-7.93-6.55-4.92-2.12-10.5-4.51-10.5-10.46s4.56-9.92,11.34-9.92c6.25,0,11.34,5.09,11.34,11.34h-4.25c0-3.91-3.18-7.09-7.09-7.09-3.43,0-7.09,1.49-7.09,5.67,0,2.93,2.99,4.43,7.93,6.55,4.92,2.12,10.5,4.51,10.5,10.46s-4.56,9.92-11.34,9.92Z" fill="' . $dark . '"/>'
            . '<path d="M226.77,40.39v4.25h16.35c-1.81,5.74-7.19,9.92-13.52,9.92-7.82,0-14.17-6.36-14.17-14.17s6.36-14.17,14.17-14.17c5.23,0,9.8,2.86,12.26,7.09h4.75c-2.78-6.66-9.34-11.34-17.01-11.34-10.18,0-18.43,8.25-18.43,18.43s8.25,18.43,18.43,18.43,18.43-8.25,18.43-18.43h-21.26Z" fill="' . $dark . '"/>'
            . '<path d="M305.54,22.68h-12.05v35.43h12.05c9.78,0,17.72-7.93,17.72-17.72s-7.93-17.72-17.72-17.72ZM305.54,53.86h0s-7.8,0-7.8,0v-26.93h7.8c7.42,0,13.46,6.04,13.46,13.46s-6.04,13.46-13.46,13.46Z" fill="' . $dark . '"/>'
            . '<path d="M276.38,33.66c0-6.07-4.92-10.98-10.98-10.98h-13.11v35.43h4.25v-13.46h6.9l7.77,13.46h4.91l-7.98-13.82c4.74-1.22,8.24-5.51,8.24-10.63ZM265.39,40.39h-8.86v-13.46h8.86c3.71,0,6.73,3.02,6.73,6.73s-3.02,6.73-6.73,6.73h0Z" fill="' . $dark . '"/>'
            . '</svg>';
    }
}
