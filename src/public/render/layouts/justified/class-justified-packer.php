<?php
/**
 * Server-side mirror of the JS justified row-packer.
 *
 * @package FotoGrids\Render\Layouts\Justified
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Layouts\Justified;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Server-side mirror of the JS justified row-packer.
 *
 * Same shrink-vs-grow lookahead used by layouts/justified/justified.js:
 * for each new item, if the projected stretched row width reaches the
 * container, choose between closing the row WITH the candidate (shrink)
 * or WITHOUT it (stretch) by comparing which option's resulting row
 * height is closer to the target.
 *
 * Accepts a flat list of aspect ratios (w / h) so the caller controls
 * how to derive them from items. Returns rows as arrays of integer
 * indices into the input list, so the caller can map back to whatever
 * item shape it holds.
 *
 * @package FotoGrids\Render\Layouts\Justified
 * @since   1.0.0
 */
final class Justified_Packer {

    /**
     * Pack aspect ratios into rows.
     *
     * @since  1.0.0
     * @param  float[] $aspect_ratios  Ordered aspect ratios (width / height).
     * @param  float   $container_width Container pixel width.
     * @param  float   $gap             Inter-item pixel gap.
     * @param  float   $target_height   Target row height.
     * @return int[][]                  Rows of integer indices into $aspect_ratios.
     */
    public static function pack( array $aspect_ratios, float $container_width, float $gap, float $target_height ): array {
        $rows                = [];
        $current             = [];
        $current_aspect_sum  = 0.0;
        $item_count          = count( $aspect_ratios );

        if ( $item_count === 0 || $container_width <= 0 || $target_height <= 0 ) {
            return [];
        }

        $row_height_for = static function ( float $aspect_sum, int $count ) use ( $container_width, $gap, $target_height ): float {
            if ( $aspect_sum <= 0 || $count <= 0 ) {
                return $target_height;
            }
            $available_width = $container_width - max( 0, $count - 1 ) * $gap;
            return $available_width / $aspect_sum;
        };

        for ( $i = 0; $i < $item_count; $i++ ) {
            $aspect = $aspect_ratios[ $i ];
            if ( ! is_numeric( $aspect ) || $aspect <= 0 ) {
                $aspect = 1.5;
            }
            $aspect = (float) $aspect;

            $with_count          = count( $current ) + 1;
            $with_aspect         = $current_aspect_sum + $aspect;
            $natural_width_with  = $with_aspect * $target_height + max( 0, $with_count - 1 ) * $gap;

            if ( $natural_width_with < $container_width || empty( $current ) ) {
                $current[]          = $i;
                $current_aspect_sum = $with_aspect;
                continue;
            }

            $height_with    = $row_height_for( $with_aspect,         $with_count );
            $height_without = $row_height_for( $current_aspect_sum,  count( $current ) );

            $delta_with    = abs( $height_with    - $target_height );
            $delta_without = abs( $height_without - $target_height );

            if ( $delta_with <= $delta_without ) {
                $current[]          = $i;
                $rows[]             = $current;
                $current            = [];
                $current_aspect_sum = 0.0;
            } else {
                $rows[]             = $current;
                $current            = [ $i ];
                $current_aspect_sum = $aspect;
            }
        }

        if ( ! empty( $current ) ) {
            $rows[] = $current;
        }

        return $rows;
    }

    /**
     * Compute the stretched row height for a single row of aspect ratios.
     * Mirrors the JS applyRow() math.
     *
     * @since  1.0.0
     * @param  float[] $row_aspects     Aspect ratios for one row.
     * @param  float   $container_width Container pixel width.
     * @param  float   $gap             Inter-item pixel gap.
     * @return float
     */
    public static function row_height( array $row_aspects, float $container_width, float $gap ): float {
        $count = count( $row_aspects );
        if ( $count === 0 ) {
            return 0.0;
        }
        $aspect_sum = 0.0;
        foreach ( $row_aspects as $aspect ) {
            $aspect_sum += is_numeric( $aspect ) && $aspect > 0 ? (float) $aspect : 1.5;
        }
        if ( $aspect_sum <= 0 ) {
            return 0.0;
        }
        $available_width = $container_width - max( 0, $count - 1 ) * $gap;
        return $available_width / $aspect_sum;
    }

    /**
     * Compute the natural (unstretched) row width — the width the row would
     * take if every item rendered at the target height. Used to measure
     * how full the last row is against the container.
     *
     * @since  1.0.0
     * @param  float[] $row_aspects     Aspect ratios for one row.
     * @param  float   $gap             Inter-item pixel gap.
     * @param  float   $target_height   Target row height.
     * @return float
     */
    public static function natural_row_width( array $row_aspects, float $gap, float $target_height ): float {
        $count = count( $row_aspects );
        if ( $count === 0 ) {
            return 0.0;
        }
        $aspect_sum = 0.0;
        foreach ( $row_aspects as $aspect ) {
            $aspect_sum += is_numeric( $aspect ) && $aspect > 0 ? (float) $aspect : 1.5;
        }
        return $aspect_sum * $target_height + max( 0, $count - 1 ) * $gap;
    }
}
