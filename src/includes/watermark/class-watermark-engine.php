<?php
/**
 * Text-watermark compositor (GD / Imagick).
 *
 * @package FotoGrids\Watermark
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Watermark;

use FotoGrids\Settings\Watermark_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Burns a text watermark into an image file.
 *
 * Reads an already-generated clean sub-size, composites the configured text,
 * and writes a watermarked sibling that matches the source format and JPEG
 * quality exactly - only the watermark pixels differ. Works directly on the
 * file via the Imagick or GD extension (Imagick preferred for text quality);
 * WP_Image_Editor is not used because it exposes no text-drawing primitive.
 *
 * The compositor is config-driven so Pro can add an image (logo) branch
 * without changing the call sites. It never throws: any failure returns false
 * and is logged when WP_DEBUG is on, so a generation pass can skip one image
 * without breaking the batch or a render.
 *
 * @since 1.0.0
 */
final class Watermark_Engine {

    /**
     * Font height as a fraction of the image's shorter edge, per size preset.
     *
     * @var array<string, float>
     */
    private const SIZE_RATIO = array(
        'small'   => 0.03,
        'regular' => 0.04,
        'large'   => 0.055,
    );

    /**
     * Burn the configured watermark into one image.
     *
     * @since 1.0.0
     * @param string               $src_path  Clean source file (the sub-size).
     * @param string               $dest_path Destination for the watermarked file.
     * @param array<string, mixed> $config    Resolved watermark settings.
     * @param array{width:int, height:int} $size Pixel dimensions of the source.
     * @return bool True on success, false on any failure.
     */
    public static function apply( string $src_path, string $dest_path, array $config, array $size ): bool {
        if ( ! is_readable( $src_path ) ) {
            return self::fail( "source not readable: {$src_path}" );
        }

        $text = trim( (string) ( $config['watermark_text'] ?? '' ) );
        if ( $text === '' ) {
            return self::fail( 'empty watermark text' );
        }

        $font_key  = (string) ( $config['watermark_font_family'] ?? 'inter' );
        $font_file = Watermark_Settings_Store::font_path( $font_key );
        if ( ! is_readable( $font_file ) ) {
            return self::fail( "font not readable: {$font_file}" );
        }

        $width  = max( 1, (int) ( $size['width'] ?? 0 ) );
        $height = max( 1, (int) ( $size['height'] ?? 0 ) );

        $params = self::resolve_params( $config, $width, $height, $text, $font_file );

        if ( self::has_imagick() ) {
            return self::apply_imagick( $src_path, $dest_path, $font_file, $params );
        }

        if ( self::has_gd() ) {
            return self::apply_gd( $src_path, $dest_path, $font_file, $params );
        }

        return self::fail( 'no image backend (Imagick or GD) available' );
    }

    /**
     * Resolve config + dimensions into concrete drawing parameters shared by
     * both backends.
     *
     * @since 1.0.0
     * @param array<string, mixed> $config
     * @param int    $width
     * @param int    $height
     * @param string $text
     * @param string $font_file
     * @return array<string, mixed>
     */
    private static function resolve_params( array $config, int $width, int $height, string $text, string $font_file ): array {
        $preset    = (string) ( $config['watermark_font_size'] ?? 'regular' );
        $ratio     = self::SIZE_RATIO[ $preset ] ?? self::SIZE_RATIO['regular'];
        $font_size = max( 8, (int) round( min( $width, $height ) * $ratio ) );

        $opacity = (int) ( $config['watermark_opacity'] ?? 70 );
        $opacity = max( 0, min( 100, $opacity ) );

        // The configured margin is calibrated against a 1000px reference edge
        // and scaled to this image, so the watermark keeps a consistent visual
        // inset whether the sub-size is 300px or 3000px wide.
        $margin_setting = max( 0, (int) ( $config['watermark_margin'] ?? 20 ) );
        $margin = (int) round( $margin_setting * min( $width, $height ) / 1000 );

        $color = self::resolve_color( $config );
        $box   = self::measure_text( $font_file, $font_size, $text );

        // Contrast shadow keeps the mark legible on same-tone backgrounds:
        // light text gets a soft dark shadow, dark text a soft light one. The
        // shadow is a soft blurred glow rather than a crisp offset stamp, with
        // a small offset and a blur radius that both scale with the font size.
        $shadow_color  = self::is_light( $color ) ? array( 0, 0, 0 ) : array( 255, 255, 255 );
        $shadow_offset = max( 1, (int) round( $font_size / 40 ) );
        $shadow_blur   = max( 2, (int) round( $font_size / 4 ) );

        [ $x, $y ] = self::resolve_position(
            (string) ( $config['watermark_position'] ?? 'bottom-right' ),
            $width,
            $height,
            $box['width'],
            $box['height'],
            $margin
        );

        return array(
            'text'          => $text,
            'font_size'     => $font_size,
            'opacity'       => $opacity,
            'color'         => $color,            // [ r, g, b ]
            'shadow_color'  => $shadow_color,     // [ r, g, b ]
            'shadow_offset' => $shadow_offset,    // px, scales with font size
            'shadow_blur'   => $shadow_blur,      // gaussian blur radius (px)
            'x'             => $x,                // top-left x of the text box (GD)
            'y'             => $y,                // top-left y of the text box (GD)
            'offset_x'      => $box['offset_x'],  // 0; X needs no origin correction
            'offset_y'      => $box['offset_y'],  // bbox top offset (box-top → baseline)
            'position'      => (string) ( $config['watermark_position'] ?? 'bottom-right' ),
            'margin'        => $margin,           // scaled margin in px
        );
    }

    /**
     * Whether an [r,g,b] colour is light (perceived luminance > mid).
     *
     * @since 1.0.0
     * @param array{0:int,1:int,2:int} $rgb
     * @return bool
     */
    private static function is_light( array $rgb ): bool {
        // Rec. 601 luma.
        $luma = 0.299 * $rgb[0] + 0.587 * $rgb[1] + 0.114 * $rgb[2];
        return $luma >= 140;
    }

    /**
     * Resolve the configured colour preset to an [r, g, b] triple.
     *
     * @since 1.0.0
     * @param array<string, mixed> $config
     * @return array{0:int,1:int,2:int}
     */
    private static function resolve_color( array $config ): array {
        $mode = (string) ( $config['watermark_text_color'] ?? 'light' );

        if ( $mode === 'dark' ) {
            return array( 0, 0, 0 );
        }

        if ( $mode === 'custom' ) {
            $hex = (string) ( $config['watermark_custom_text_color'] ?? '#ffffff' );
            $rgb = self::hex_to_rgb( $hex );
            if ( $rgb !== null ) {
                return $rgb;
            }
        }

        return array( 255, 255, 255 );
    }

    /**
     * Convert a #rrggbb or #rgb string to an [r, g, b] triple, or null.
     *
     * @since 1.0.0
     * @param string $hex
     * @return array{0:int,1:int,2:int}|null
     */
    private static function hex_to_rgb( string $hex ): ?array {
        $hex = ltrim( trim( $hex ), '#' );

        if ( strlen( $hex ) === 3 ) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        if ( strlen( $hex ) !== 6 || ! ctype_xdigit( $hex ) ) {
            return null;
        }

        return array(
            (int) hexdec( substr( $hex, 0, 2 ) ),
            (int) hexdec( substr( $hex, 2, 2 ) ),
            (int) hexdec( substr( $hex, 4, 2 ) ),
        );
    }

    /**
     * Measure a single line of text. Returns the ink box width/height plus the
     * bbox offsets needed to convert a desired box top-left into the
     * baseline-left draw origin both backends use.
     *
     * Uses GD's imagettfbbox when available (works for both backends since they
     * read the same TTF); falls back to a rough estimate otherwise.
     *
     * @since 1.0.0
     * @param string $font_file
     * @param int    $font_size
     * @param string $text
     * @return array{width:int, height:int, offset_x:int, offset_y:int}
     */
    private static function measure_text( string $font_file, int $font_size, string $text ): array {
        if ( function_exists( 'imagettfbbox' ) ) {
            $bbox = imagettfbbox( $font_size, 0, $font_file, $text );
            if ( is_array( $bbox ) ) {
                // imagettfbbox returns 8 ints (4 corner x/y pairs) relative to
                // the draw origin on the baseline. The ink box spans:
                //   x: min of all x corners → max of all x corners
                //   y: min of all y corners (top) → max (bottom)
                $xs = array( $bbox[0], $bbox[2], $bbox[4], $bbox[6] );
                $ys = array( $bbox[1], $bbox[3], $bbox[5], $bbox[7] );

                $max_x = max( $xs );
                $min_y = min( $ys );
                $max_y = max( $ys );

                // Width is measured from the draw origin (x=0) to the rightmost
                // ink, NOT max_x-min_x. imagettftext advances glyphs from the
                // origin, and GD's actual right extent can exceed the ink box's
                // own min_x→max_x span; using max_x as the box width guarantees
                // right-aligned text never overflows the image edge. The small
                // left bearing is folded into the box, so X needs no origin
                // correction (offset_x = 0). Y still converts box-top → baseline.
                return array(
                    'width'    => (int) ceil( $max_x ),
                    'height'   => (int) ceil( $max_y - $min_y ),
                    'offset_x' => 0,
                    'offset_y' => (int) $min_y,
                );
            }
        }

        // Estimate when FreeType metrics are unavailable: glyph ~0.6em wide,
        // ascent ~0.8em above the baseline.
        return array(
            'width'    => (int) ceil( strlen( $text ) * $font_size * 0.6 ),
            'height'   => $font_size,
            'offset_x' => 0,
            'offset_y' => (int) round( -0.8 * $font_size ),
        );
    }

    /**
     * Resolve a nine-point position to the top-left [x, y] of the text box.
     *
     * @since 1.0.0
     * @param string $position
     * @param int    $img_w
     * @param int    $img_h
     * @param int    $box_w
     * @param int    $box_h
     * @param int    $margin
     * @return array{0:int,1:int}
     */
    private static function resolve_position( string $position, int $img_w, int $img_h, int $box_w, int $box_h, int $margin ): array {
        $left   = $margin;
        $center = (int) round( ( $img_w - $box_w ) / 2 );
        $right  = $img_w - $box_w - $margin;

        $top    = $margin;
        $middle = (int) round( ( $img_h - $box_h ) / 2 );
        $bottom = $img_h - $box_h - $margin;

        $map = array(
            'top-left'      => array( $left, $top ),
            'top-center'    => array( $center, $top ),
            'top-right'     => array( $right, $top ),
            'center-left'   => array( $left, $middle ),
            'center'        => array( $center, $middle ),
            'center-right'  => array( $right, $middle ),
            'bottom-left'   => array( $left, $bottom ),
            'bottom-center' => array( $center, $bottom ),
            'bottom-right'  => array( $right, $bottom ),
        );

        $xy = $map[ $position ] ?? $map['bottom-right'];

        // Never let the box escape the image when it is larger than expected.
        return array( max( 0, $xy[0] ), max( 0, $xy[1] ) );
    }

    /**
     * Imagick draw path.
     *
     * @since 1.0.0
     * @param string $src_path
     * @param string $dest_path
     * @param string $font_file
     * @param array<string, mixed> $p
     * @return bool
     */
    private static function apply_imagick( string $src_path, string $dest_path, string $font_file, array $p ): bool {
        try {
            $image = new \Imagick( $src_path );

            $img_w = (int) $image->getImageWidth();
            $img_h = (int) $image->getImageHeight();

            $draw = new \ImagickDraw();
            $draw->setFont( $font_file );
            $draw->setFontSize( (float) $p['font_size'] );
            $draw->setFillColor( self::imagick_color( $p['color'], $p['opacity'] ) );

            // Use Imagick's own metrics (not the GD bbox) so the text box is
            // measured in the same model annotateImage draws with.
            $metrics = $image->queryFontMetrics( $draw, (string) $p['text'] );
            $text_w  = (int) ceil( $metrics['textWidth'] );
            $ascender = (float) $metrics['ascender'];   // positive, above baseline
            $descender = (float) $metrics['descender']; // negative, below baseline
            $text_h  = (int) ceil( $ascender - $descender );

            // Re-resolve the box top-left against this image using Imagick's
            // measured box, then place the baseline-left origin with gravity
            // NORTHWEST: x = box left, y = box top + ascender.
            [ $box_x, $box_y ] = self::resolve_position(
                (string) ( $p['position'] ?? 'bottom-right' ),
                $img_w,
                $img_h,
                $text_w,
                $text_h,
                (int) $p['margin']
            );

            // With NORTHWEST gravity, annotateImage positions the text's
            // top-left at (x, y) directly - gravity already accounts for the
            // baseline, so the ascender must NOT be added again.
            $draw->setGravity( \Imagick::GRAVITY_NORTHWEST );
            $draw_x = $box_x;
            $draw_y = $box_y;

            // Soft shadow: draw the shadow text onto a transparent layer the
            // size of the image, gaussian-blur it, then composite it under the
            // main text. A blurred glow reads as a real shadow and keeps the
            // mark legible on same-tone backgrounds.
            $offset = (int) $p['shadow_offset'];
            $blur   = (int) $p['shadow_blur'];

            $shadow_layer = new \Imagick();
            $shadow_layer->newImage( $img_w, $img_h, new \ImagickPixel( 'transparent' ) );
            $shadow_layer->setImageFormat( 'png' );

            $shadow_draw = new \ImagickDraw();
            $shadow_draw->setFont( $font_file );
            $shadow_draw->setFontSize( (float) $p['font_size'] );
            $shadow_draw->setGravity( \Imagick::GRAVITY_NORTHWEST );
            $shadow_draw->setFillColor(
                self::imagick_color( $p['shadow_color'], min( 100, (int) round( $p['opacity'] * 0.7 ) ) )
            );
            $shadow_layer->annotateImage(
                $shadow_draw,
                (float) ( $draw_x + $offset ),
                (float) ( $draw_y + $offset ),
                0.0,
                (string) $p['text']
            );
            $shadow_layer->gaussianBlurImage( 0, max( 1, $blur ) );

            $image->compositeImage( $shadow_layer, \Imagick::COMPOSITE_OVER, 0, 0 );

            $shadow_draw->clear();
            $shadow_layer->clear();

            $image->annotateImage( $draw, (float) $draw_x, (float) $draw_y, 0.0, (string) $p['text'] );

            $format = strtolower( (string) $image->getImageFormat() );
            self::match_encoding_imagick( $image, $format, $src_path );

            $ok = $image->writeImage( $dest_path );

            $image->clear();
            $draw->clear();

            return (bool) $ok;
        } catch ( \Throwable $e ) {
            return self::fail( 'imagick: ' . $e->getMessage() );
        }
    }

    /**
     * Build an ImagickPixel for an [r,g,b] triple at a 0-100 opacity.
     *
     * @since 1.0.0
     * @param array{0:int,1:int,2:int} $rgb
     * @param int $opacity
     * @return \ImagickPixel
     */
    private static function imagick_color( array $rgb, int $opacity ): \ImagickPixel {
        $alpha = max( 0.0, min( 1.0, $opacity / 100 ) );
        return new \ImagickPixel(
            sprintf( 'rgba(%d,%d,%d,%.3f)', $rgb[0], $rgb[1], $rgb[2], $alpha )
        );
    }

    /**
     * Match the output encoding (quality) to the source for JPEG/WEBP.
     *
     * @since 1.0.0
     * @param \Imagick $image
     * @param string   $format
     * @param string   $src_path
     * @return void
     */
    private static function match_encoding_imagick( \Imagick $image, string $format, string $src_path ): void {
        if ( $format === 'jpeg' || $format === 'jpg' || $format === 'webp' ) {
            try {
                $probe   = new \Imagick( $src_path );
                $quality = (int) $probe->getImageCompressionQuality();
                $probe->clear();
                if ( $quality > 0 ) {
                    $image->setImageCompressionQuality( $quality );
                }
            } catch ( \Throwable $e ) {
                // Leave Imagick's default quality if the probe fails.
                unset( $e );
            }
        }
    }

    /**
     * GD draw path.
     *
     * @since 1.0.0
     * @param string $src_path
     * @param string $dest_path
     * @param string $font_file
     * @param array<string, mixed> $p
     * @return bool
     */
    private static function apply_gd( string $src_path, string $dest_path, string $font_file, array $p ): bool {
        $info = getimagesize( $src_path );
        if ( $info === false ) {
            return self::fail( "getimagesize failed: {$src_path}" );
        }

        $type  = $info[2];
        $image = self::gd_load( $src_path, $type );
        if ( $image === null ) {
            return self::fail( "gd load failed: {$src_path}" );
        }

        imagealphablending( $image, true );
        imagesavealpha( $image, true );

        // GD encodes per-glyph alpha from the allocated colour's alpha (0-127,
        // 0 = opaque). Map 0-100 opacity onto that range.
        $main_alpha = (int) round( ( 1 - max( 0, min( 100, (int) $p['opacity'] ) ) / 100 ) * 127 );
        $rgb        = $p['color'];
        $color      = imagecolorallocatealpha( $image, $rgb[0], $rgb[1], $rgb[2], $main_alpha );

        // imagettftext draws from the baseline-left origin. Subtract the bbox
        // offsets so the ink box's top-left lands exactly at (x, y).
        $draw_x = (int) $p['x'] - (int) $p['offset_x'];
        $draw_y = (int) $p['y'] - (int) $p['offset_y'];

        // Soft shadow: draw the shadow text onto a transparent layer, blur it,
        // and merge it under the main text. GD has no per-call blur, so the
        // gaussian filter is applied repeatedly to approximate the radius.
        $srgb   = $p['shadow_color'];
        $offset = (int) $p['shadow_offset'];
        $blur   = (int) $p['shadow_blur'];

        $w = imagesx( $image );
        $h = imagesy( $image );

        $layer = imagecreatetruecolor( $w, $h );
        imagealphablending( $layer, false );
        imagesavealpha( $layer, true );
        imagefill( $layer, 0, 0, imagecolorallocatealpha( $layer, 0, 0, 0, 127 ) );
        imagealphablending( $layer, true );

        $shadow_alpha = (int) round( ( 1 - min( 100, (int) round( $p['opacity'] * 0.72 ) ) / 100 ) * 127 );
        $shadow_color = imagecolorallocatealpha( $layer, $srgb[0], $srgb[1], $srgb[2], $shadow_alpha );
        imagettftext( $layer, (float) $p['font_size'], 0.0, $draw_x + $offset, $draw_y + $offset, $shadow_color, $font_file, (string) $p['text'] );

        if ( function_exists( 'imagefilter' ) ) {
            for ( $i = 0; $i < max( 1, $blur ); $i++ ) {
                imagefilter( $layer, IMG_FILTER_GAUSSIAN_BLUR );
            }
        }

        imagealphablending( $image, true );
        imagecopy( $image, $layer, 0, 0, 0, 0, $w, $h );
        imagedestroy( $layer );

        imagettftext( $image, (float) $p['font_size'], 0.0, $draw_x, $draw_y, $color, $font_file, (string) $p['text'] );

        $ok = self::gd_save( $image, $dest_path, $type, $src_path );
        imagedestroy( $image );

        return $ok;
    }

    /**
     * Load a GD image resource from a file by IMAGETYPE_* constant.
     *
     * @since 1.0.0
     * @param string $path
     * @param int    $type
     * @return \GdImage|null
     */
    private static function gd_load( string $path, int $type ) {
        switch ( $type ) {
            case IMAGETYPE_JPEG:
                $img = imagecreatefromjpeg( $path );
                break;
            case IMAGETYPE_PNG:
                $img = imagecreatefrompng( $path );
                break;
            case IMAGETYPE_WEBP:
                $img = function_exists( 'imagecreatefromwebp' ) ? imagecreatefromwebp( $path ) : false;
                break;
            case IMAGETYPE_GIF:
                $img = imagecreatefromgif( $path );
                break;
            default:
                $img = false;
        }

        return $img === false ? null : $img;
    }

    /**
     * Save a GD image, preserving the source format and JPEG/WEBP quality.
     *
     * @since 1.0.0
     * @param \GdImage $image
     * @param string   $dest_path
     * @param int      $type
     * @param string   $src_path
     * @return bool
     */
    private static function gd_save( $image, string $dest_path, int $type, string $src_path ): bool {
        switch ( $type ) {
            case IMAGETYPE_JPEG:
                return imagejpeg( $image, $dest_path, self::source_jpeg_quality( $src_path ) );
            case IMAGETYPE_PNG:
                return imagepng( $image, $dest_path );
            case IMAGETYPE_WEBP:
                return function_exists( 'imagewebp' ) ? imagewebp( $image, $dest_path ) : false;
            case IMAGETYPE_GIF:
                return imagegif( $image, $dest_path );
            default:
                return false;
        }
    }

    /**
     * Best-effort read of a JPEG's stored quality; falls back to 90.
     *
     * GD cannot report a JPEG's original quality, so prefer Imagick's probe
     * when present, otherwise use a high default that closely matches WP's
     * resized sub-sizes.
     *
     * @since 1.0.0
     * @param string $src_path
     * @return int
     */
    private static function source_jpeg_quality( string $src_path ): int {
        if ( class_exists( '\Imagick' ) ) {
            try {
                $probe   = new \Imagick( $src_path );
                $quality = (int) $probe->getImageCompressionQuality();
                $probe->clear();
                if ( $quality > 0 ) {
                    return $quality;
                }
            } catch ( \Throwable $e ) {
                unset( $e );
            }
        }

        return 90;
    }

    /**
     * Whether the Imagick extension is usable.
     *
     * @since 1.0.0
     * @return bool
     */
    private static function has_imagick(): bool {
        return extension_loaded( 'imagick' ) && class_exists( '\Imagick' );
    }

    /**
     * Whether GD with FreeType (imagettftext) is usable.
     *
     * @since 1.0.0
     * @return bool
     */
    private static function has_gd(): bool {
        return extension_loaded( 'gd' ) && function_exists( 'imagettftext' );
    }

    /**
     * Log a failure under WP_DEBUG and return false.
     *
     * @since 1.0.0
     * @param string $message
     * @return false
     */
    private static function fail( string $message ): bool {
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( '[FotoGrids watermark] ' . $message );
        }
        return false;
    }
}
