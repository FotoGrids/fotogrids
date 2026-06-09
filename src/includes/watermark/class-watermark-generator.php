<?php
/**
 * Watermark variant generation and tracking for one attachment.
 *
 * @package FotoGrids\Watermark
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Watermark;

use FotoGrids\Image_Size_Manager;
use FotoGrids\Settings\Watermark_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Generates the watermarked `-fgwm` siblings for an attachment's FotoGrids
 * sub-sizes and tracks them in attachment meta.
 *
 * Only FotoGrids-managed sizes are watermarked; WordPress core/theme sizes and
 * the original file are left untouched. Which FotoGrids sizes are watermarked
 * depends on the `watermark_apply_to` setting (full / thumbnails / both).
 *
 * The tracking meta records, per size slug, the variant filename, its
 * dimensions, when it was generated, and the drawing-config hash in force at
 * generation time - so a later pass can tell which variants are current, stale,
 * or missing.
 *
 * @since 1.0.0
 */
final class Watermark_Generator {

    /**
     * Attachment meta key holding the per-size variant tracking map.
     *
     * @var string
     */
    const META_KEY = '_fotogrids_watermark_variants';

    /**
     * FotoGrids sizes treated as "full" (display) images.
     *
     * @var string[]
     */
    private const FULL_SIZES = array(
        Image_Size_Manager::SLUG_FULL,
        Image_Size_Manager::SLUG_FULL_MOBILE,
        Image_Size_Manager::SLUG_MASONRY,
        Image_Size_Manager::SLUG_JUSTIFIED,
    );

    /**
     * FotoGrids sizes treated as thumbnails.
     *
     * @var string[]
     */
    private const THUMBNAIL_SIZES = array(
        Image_Size_Manager::SLUG_THUMBNAIL,
    );

    /**
     * Generate the watermarked variants for one attachment.
     *
     * Idempotent: re-running overwrites variants in place and rewrites the
     * tracking meta. Sizes whose clean source file is missing are skipped.
     *
     * @since 1.0.0
     * @param int                       $attachment_id Attachment to process.
     * @param array<string, mixed>|null $config        Resolved watermark config;
     *                                                  defaults to global settings.
     * @return array{generated:int, skipped:int, failed:int, sizes:array<string,string>}
     */
    public static function generate_for_attachment( int $attachment_id, ?array $config = null ): array {
        $result = array( 'generated' => 0, 'skipped' => 0, 'failed' => 0, 'sizes' => array() );

        $config = $config ?? Watermark_Settings_Store::get();
        $hash   = Watermark_Settings_Store::config_hash( $config );

        $base_file = get_attached_file( $attachment_id );
        if ( ! $base_file || ! file_exists( $base_file ) ) {
            return $result;
        }

        $dir   = trailingslashit( dirname( $base_file ) );
        $slugs = self::target_slugs( $config );

        $variants = array();

        foreach ( $slugs as $slug ) {
            $data = image_get_intermediate_size( $attachment_id, $slug );

            if ( $data === false || empty( $data['file'] ) ) {
                $result['skipped']++;
                $result['sizes'][ $slug ] = 'skipped';
                continue;
            }

            $clean_path = $dir . $data['file'];
            if ( ! is_readable( $clean_path ) ) {
                $result['skipped']++;
                $result['sizes'][ $slug ] = 'skipped';
                continue;
            }

            $wm_path = Watermark_Paths::wm_path( $clean_path );
            $size    = array(
                'width'  => (int) ( $data['width'] ?? 0 ),
                'height' => (int) ( $data['height'] ?? 0 ),
            );

            $ok = Watermark_Engine::apply( $clean_path, $wm_path, $config, $size );

            if ( ! $ok ) {
                $result['failed']++;
                $result['sizes'][ $slug ] = 'failed';
                continue;
            }

            $variants[ $slug ] = array(
                'file'         => basename( $wm_path ),
                'width'        => $size['width'],
                'height'       => $size['height'],
                'generated_at' => time(),
                'config_hash'  => $hash,
            );

            $result['generated']++;
            $result['sizes'][ $slug ] = 'generated';
        }

        if ( ! empty( $variants ) ) {
            update_post_meta( $attachment_id, self::META_KEY, $variants );
        } else {
            delete_post_meta( $attachment_id, self::META_KEY );
        }

        return $result;
    }

    /**
     * Delete all watermarked variant files for an attachment and clear its
     * tracking meta.
     *
     * @since 1.0.0
     * @param int $attachment_id Attachment to clean up.
     * @return int Number of variant files removed.
     */
    public static function delete_for_attachment( int $attachment_id ): int {
        $variants = self::get_variants( $attachment_id );
        if ( empty( $variants ) ) {
            return 0;
        }

        $base_file = get_attached_file( $attachment_id );
        $dir       = $base_file ? trailingslashit( dirname( $base_file ) ) : '';
        $removed   = 0;

        if ( $dir !== '' ) {
            foreach ( $variants as $variant ) {
                $file = $dir . ( $variant['file'] ?? '' );
                if ( ! empty( $variant['file'] ) && file_exists( $file ) ) {
                    wp_delete_file( $file );
                    if ( ! file_exists( $file ) ) {
                        $removed++;
                    }
                }
            }
        }

        delete_post_meta( $attachment_id, self::META_KEY );

        return $removed;
    }

    /**
     * Read the stored variant tracking map for an attachment.
     *
     * @since 1.0.0
     * @param int $attachment_id Attachment ID.
     * @return array<string, array<string, mixed>> Map of size slug => variant data.
     */
    public static function get_variants( int $attachment_id ): array {
        $variants = get_post_meta( $attachment_id, self::META_KEY, true );

        return is_array( $variants ) ? $variants : array();
    }

    /**
     * Whether an attachment has any watermark variant recorded.
     *
     * @since 1.0.0
     * @param int $attachment_id Attachment ID.
     * @return bool
     */
    public static function has_variants( int $attachment_id ): bool {
        return ! empty( self::get_variants( $attachment_id ) );
    }

    /**
     * Classify an attachment's variants against the current global config.
     *
     * Returns 'missing' when no variant is recorded, 'stale' when any recorded
     * variant was generated under a different drawing config, or 'current' when
     * every recorded variant matches the current hash.
     *
     * @since 1.0.0
     * @param int         $attachment_id Attachment ID.
     * @param string|null $current_hash  Current global config hash; resolved if null.
     * @return string One of 'missing' | 'stale' | 'current'.
     */
    public static function variant_state( int $attachment_id, ?string $current_hash = null ): string {
        $variants = self::get_variants( $attachment_id );

        if ( empty( $variants ) ) {
            return 'missing';
        }

        $current_hash = $current_hash ?? Watermark_Settings_Store::current_config_hash();

        foreach ( $variants as $variant ) {
            if ( ( $variant['config_hash'] ?? '' ) !== $current_hash ) {
                return 'stale';
            }
        }

        return 'current';
    }

    /**
     * The FotoGrids size slugs to watermark for the given config.
     *
     * Maps `watermark_apply_to` (full / thumbnails / both) onto the FotoGrids
     * size slugs and includes any gallery-custom sizes alongside the full set.
     *
     * @since 1.0.0
     * @param array<string, mixed> $config Resolved watermark config.
     * @return string[]
     */
    private static function target_slugs( array $config ): array {
        $apply_to = (string) ( $config['watermark_apply_to'] ?? 'full' );

        $custom = array_keys( Image_Size_Manager::get_custom_sizes() );

        switch ( $apply_to ) {
            case 'thumbnails':
                return self::THUMBNAIL_SIZES;

            case 'both':
                return array_merge( self::FULL_SIZES, self::THUMBNAIL_SIZES, $custom );

            case 'full':
            default:
                return array_merge( self::FULL_SIZES, $custom );
        }
    }
}
