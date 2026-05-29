<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Render\Api\Breakpoint_Config;
use FotoGrids\Render\Api\Responsive_Var;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Serializes CSS variable maps into a scoped inline style block.
 *
 * Accepts a mixed map of plain strings and Responsive_Var instances.
 * Plain strings are emitted in the base rule.  Responsive_Var instances
 * are bucketed by breakpoint and emitted as at most two @media blocks
 * (tablet, mobile) - the count is bounded by breakpoints, never by the
 * number of properties or decorators.
 *
 * Output shape for instance #fg-123-1 (instance_id pattern is
 * "fg-{collection_id}-{seq}", written into the wrapper's id attribute):
 *
 *   <style class="fg-vars">
 *   #fg-123-1 {
 *       --fg-radius: 8px 4px;
 *       --fg-gap: 12px;
 *       --fg-border-color: #f00;
 *   }
 *   \@media (max-width: 1024px) {
 *       #fg-123-1 {
 *           --fg-radius: 6px;
 *           --fg-gap: 8px;
 *       }
 *   }
 *   \@media (max-width: 767px) {
 *       #fg-123-1 {
 *           --fg-radius: 4px;
 *           --fg-gap: 6px;
 *       }
 *   }
 *   </style>
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Style_Var_Builder {

    /**
     * Serializes the variable map into a complete inline style element.
     *
     * @since  1.0.0
     * @param  array<string, string|Responsive_Var> $css_variables Variable map.
     * @param  string                               $instance_id   Gallery wrapper element ID.
     * @param  Breakpoint_Config                    $breakpoints   User-configured breakpoints.
     * @return string  The full <style> element, or '' when the map is empty.
     */
    public function build_style_element(
        array $css_variables,
        string $instance_id,
        Breakpoint_Config $breakpoints
    ): string {
        if ( empty( $css_variables ) ) {
            return '';
        }

        ksort( $css_variables );

        $base_vars    = [];
        $tablet_vars  = [];
        $mobile_vars  = [];

        foreach ( $css_variables as $name => $value ) {
            if ( ! str_starts_with( $name, '--' ) ) {
                throw new \InvalidArgumentException( sprintf( "Style var '%s' must start with '--'", $name ) );
            }

            if ( $value instanceof Responsive_Var ) {
                $desktop_val = $this->sanitize( $value->for_breakpoint( 'desktop' ) );
                $tablet_val  = $this->sanitize( $value->for_breakpoint( 'tablet' ) );
                $mobile_val  = $this->sanitize( $value->for_breakpoint( 'mobile' ) );

                if ( $desktop_val !== '' ) {
                    $base_vars[ $name ] = $desktop_val;
                }
                // Only emit a tablet override when the value actually differs from desktop.
                if ( $tablet_val !== '' && $tablet_val !== $desktop_val ) {
                    $tablet_vars[ $name ] = $tablet_val;
                }
                // Only emit a mobile override when the value actually differs from tablet.
                if ( $mobile_val !== '' && $mobile_val !== $tablet_val ) {
                    $mobile_vars[ $name ] = $mobile_val;
                }
            } else {
                $safe = $this->sanitize( (string) $value );
                if ( $safe !== '' ) {
                    $base_vars[ $name ] = $safe;
                }
            }
        }

        if ( empty( $base_vars ) && empty( $tablet_vars ) && empty( $mobile_vars ) ) {
            return '';
        }

        $selector = '#' . esc_attr( $instance_id );
        $output   = "<style class=\"fg-vars\">\n";

        $output .= $selector . " {\n";
        foreach ( $base_vars as $name => $val ) {
            $output .= '    ' . $name . ': ' . $val . ";\n";
        }
        $output .= "}\n";

        if ( ! empty( $tablet_vars ) ) {
            $output .= '@media (max-width: ' . $breakpoints->tablet_max_width . "px) {\n";
            $output .= '    ' . $selector . " {\n";
            foreach ( $tablet_vars as $name => $val ) {
                $output .= '        ' . $name . ': ' . $val . ";\n";
            }
            $output .= "    }\n";
            $output .= "}\n";
        }

        if ( ! empty( $mobile_vars ) ) {
            $output .= '@media (max-width: ' . $breakpoints->mobile_max_width . "px) {\n";
            $output .= '    ' . $selector . " {\n";
            foreach ( $mobile_vars as $name => $val ) {
                $output .= '        ' . $name . ': ' . $val . ";\n";
            }
            $output .= "    }\n";
            $output .= "}\n";
        }

        $output .= '</style>';

        return $output;
    }

    /**
     * Strips characters that would break out of a CSS declaration value.
     *
     * @since  1.0.0
     * @param  string $value Raw value.
     * @return string
     */
    private function sanitize( string $value ): string {
        return str_replace( [ ';', "\n", "\r" ], '', $value );
    }
}
