<?php
/**
 * Registers the Free hover-effect descriptors.
 *
 * @package FotoGrids\Render\Decorators\Hover
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Hover;

use FotoGrids\Render\Api\Hover_Effect;
use FotoGrids\Render\Internal\Hover_Effect_Registry;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Source of truth for the Free hover effects. Each descriptor names its render
 * CSS (also used as the admin preview CSS in Free) and the layouts it hides on.
 *
 * @since 1.0.0
 */
final class Hover_Effects_Catalog {

	/**
	 * Registers every Free descriptor with the registry.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	public static function register(): void {
		foreach ( self::definitions() as $definition ) {
			Hover_Effect_Registry::register( new Hover_Effect( $definition ) );
		}
	}

	/**
	 * @since  1.0.0
	 * @return array<int, array<string, mixed>>
	 */
	private static function definitions(): array {
		$css = static function ( string $id ): string {
			return 'decorators/hover/effects/' . $id . '.css';
		};

		$preview = static function ( string $id ): string {
			return 'public/render/decorators/hover/effects/' . $id . '.css';
		};

		return array(
			array(
				'id'               => 'none',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'None', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_MEDIA,
				'coupling'         => Hover_Effect::COUPLING_NONE,
				'css_path'         => $css( 'none' ),
				'preview_css_path' => $preview( 'none' ),
			),
			array(
				'id'               => 'zoom',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Zoom', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_MEDIA,
				'coupling'         => Hover_Effect::COUPLING_ITEM,
				'css_path'         => $css( 'zoom' ),
				'preview_css_path' => $preview( 'zoom' ),
			),
			array(
				'id'               => 'pan',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Pan', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_MEDIA,
				'coupling'         => Hover_Effect::COUPLING_MEDIA,
				'hide_on_layouts'  => array( 'masonry', 'justified' ),
				'css_path'         => $css( 'pan' ),
				'preview_css_path' => $preview( 'pan' ),
			),
			array(
				'id'               => 'blur-focus',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Blur Focus', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_MEDIA,
				'coupling'         => Hover_Effect::COUPLING_MEDIA,
				'css_path'         => $css( 'blur-focus' ),
				'preview_css_path' => $preview( 'blur-focus' ),
			),
			array(
				'id'               => 'grayscale',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Grayscale', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_MEDIA,
				'coupling'         => Hover_Effect::COUPLING_MEDIA,
				'css_path'         => $css( 'grayscale' ),
				'preview_css_path' => $preview( 'grayscale' ),
			),
			array(
				'id'               => 'tint',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Tint', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_MEDIA,
				'coupling'         => Hover_Effect::COUPLING_MEDIA,
				'css_path'         => $css( 'tint' ),
				'preview_css_path' => $preview( 'tint' ),
			),
			array(
				'id'               => 'lift',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Lift', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_FRAME,
				'coupling'         => Hover_Effect::COUPLING_ITEM,
				'hide_on_layouts'  => array( 'slider', 'image-viewer' ),
				'conflicts_css'    => array( 'box-shadow' ),
				'css_path'         => $css( 'lift' ),
				'preview_css_path' => $preview( 'lift' ),
			),
			array(
				'id'               => 'frame',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Frame', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_FRAME,
				'coupling'         => Hover_Effect::COUPLING_ITEM,
				'hide_on_layouts'  => array( 'slider', 'image-viewer' ),
				'css_path'         => $css( 'frame' ),
				'preview_css_path' => $preview( 'frame' ),
			),
			array(
				'id'               => 'tilt',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Tilt', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_FRAME,
				'coupling'         => Hover_Effect::COUPLING_ITEM,
				'hide_on_layouts'  => array( 'slider', 'image-viewer' ),
				'css_path'         => $css( 'tilt' ),
				'preview_css_path' => $preview( 'tilt' ),
			),
			array(
				'id'               => 'caption-fade',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Caption Fade', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_CAPTION,
				'coupling'         => Hover_Effect::COUPLING_NONE,
				'requires_caption' => true,
				'hide_on_layouts'  => array( 'image-viewer', 'instant-photos' ),
				'css_path'         => $css( 'caption-fade' ),
				'preview_css_path' => $preview( 'caption-fade' ),
			),
			array(
				'id'               => 'caption-rise',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Caption Rise', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_CAPTION,
				'coupling'         => Hover_Effect::COUPLING_NONE,
				'requires_caption' => true,
				'hide_on_layouts'  => array( 'image-viewer', 'instant-photos' ),
				'css_path'         => $css( 'caption-rise' ),
				'preview_css_path' => $preview( 'caption-rise' ),
			),
			array(
				'id'               => 'caption-slide',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Caption Slide', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_CAPTION,
				'coupling'         => Hover_Effect::COUPLING_NONE,
				'requires_caption' => true,
				'hide_on_layouts'  => array( 'image-viewer', 'instant-photos' ),
				'css_path'         => $css( 'caption-slide' ),
				'preview_css_path' => $preview( 'caption-slide' ),
			),
			array(
				'id'               => 'caption-split',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Caption Split', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_CAPTION,
				'coupling'         => Hover_Effect::COUPLING_NONE,
				'requires_caption' => true,
				'hide_on_layouts'  => array( 'image-viewer', 'instant-photos' ),
				'css_path'         => $css( 'caption-split' ),
				'preview_css_path' => $preview( 'caption-split' ),
			),
			array(
				'id'               => 'spotlight',
				'origin'           => 'fotogrids',
				'tier'             => 'free',
				'label'            => __( 'Spotlight', 'fotogrids' ),
				'animates'         => Hover_Effect::ANIMATES_BOTH,
				'coupling'         => Hover_Effect::COUPLING_ITEM,
				'requires_caption' => true,
				'hide_on_layouts'  => array( 'image-viewer', 'instant-photos' ),
				'css_path'         => $css( 'spotlight' ),
				'preview_css_path' => $preview( 'spotlight' ),
			),
		);
	}
}
