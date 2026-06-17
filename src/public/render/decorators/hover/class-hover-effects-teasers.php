<?php
/**
 * Registers Pro hover-effect teasers shipped in Free.
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
 * Declares the Pro hover effects as teasers so the admin grid lists and
 * animates them before Pro is installed. Each teaser carries preview CSS that
 * ships in Free and no render CSS; when Pro is active its real descriptor
 * replaces the teaser in the registry.
 *
 * @since 1.0.0
 */
final class Hover_Effects_Teasers {

	/**
	 * Registers every Pro teaser descriptor.
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
		$preview = static function ( string $id ): string {
			return 'public/render/decorators/hover/preview/' . $id . '.css';
		};

		$media   = Hover_Effect::ANIMATES_MEDIA;
		$frame   = Hover_Effect::ANIMATES_FRAME;
		$caption = Hover_Effect::ANIMATES_CAPTION;
		$both    = Hover_Effect::ANIMATES_BOTH;

		$couple_item  = Hover_Effect::COUPLING_ITEM;
		$couple_media = Hover_Effect::COUPLING_MEDIA;
		$couple_none  = Hover_Effect::COUPLING_NONE;

		$specs = array(
			array( 'zoom-pan', __( 'Zoom Pan', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'parallax-tilt', __( 'Parallax Tilt', 'fotogrids' ), $media, $couple_media, false, array( 'slider', 'image-viewer' ) ),
			array( 'tilt-3d', __( '3D Tilt', 'fotogrids' ), $frame, $couple_item, false, array( 'slider', 'image-viewer' ) ),
			array( 'flip', __( 'Flip', 'fotogrids' ), $both, $couple_item, true, array( 'slider', 'image-viewer' ) ),
			array( 'flip-vertical', __( 'Flip Vertical', 'fotogrids' ), $both, $couple_item, true, array( 'slider', 'image-viewer' ) ),
			array( 'swing', __( 'Swing', 'fotogrids' ), $frame, $couple_item, false, array( 'slider', 'image-viewer' ) ),
			array( 'pop', __( 'Pop', 'fotogrids' ), $frame, $couple_item, false, array() ),
			array( 'push-3d', __( '3D Push', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'duotone', __( 'Duotone', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'saturate-pop', __( 'Saturate Pop', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'warm-cool', __( 'Warm Cool', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'vignette', __( 'Vignette', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'bloom', __( 'Bloom', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'invert-flash', __( 'Flash', 'fotogrids' ), $media, $couple_media, false, array() ),
			array( 'reveal-mask', __( 'Reveal Mask', 'fotogrids' ), $caption, $couple_none, true, array( 'image-viewer', 'instant-photos' ) ),
			array( 'gradient-sweep', __( 'Gradient Sweep', 'fotogrids' ), $both, $couple_item, true, array( 'image-viewer', 'instant-photos' ) ),
			array( 'split-doors', __( 'Split Doors', 'fotogrids' ), $caption, $couple_none, true, array( 'image-viewer', 'instant-photos' ) ),
			array( 'slide-curtain', __( 'Slide Curtain', 'fotogrids' ), $both, $couple_item, true, array( 'image-viewer', 'instant-photos' ) ),
			array( 'caption-typer', __( 'Caption Typer', 'fotogrids' ), $caption, $couple_none, true, array( 'image-viewer', 'instant-photos' ) ),
			array( 'border-draw', __( 'Border Draw', 'fotogrids' ), $frame, $couple_item, false, array( 'slider', 'image-viewer' ) ),
			array( 'spotlight-pro', __( 'Spotlight Pro', 'fotogrids' ), $both, $couple_item, false, array( 'image-viewer', 'instant-photos' ) ),
			array( 'zoom-pan-blur', __( 'Zoom Pan Blur', 'fotogrids' ), $both, $couple_item, false, array( 'image-viewer', 'instant-photos' ) ),
			array( 'cinematic-bars', __( 'Cinematic Bars', 'fotogrids' ), $both, $couple_item, true, array( 'image-viewer', 'instant-photos' ) ),
			array( 'glass-frost', __( 'Glass Frost', 'fotogrids' ), $both, $couple_item, true, array( 'image-viewer', 'instant-photos' ) ),
			array( 'depth-stack', __( 'Depth Stack', 'fotogrids' ), $both, $couple_item, true, array( 'slider', 'image-viewer', 'instant-photos' ) ),
			array( 'focus-dim-siblings', __( 'Focus Dim', 'fotogrids' ), $media, $couple_item, false, array( 'slider', 'image-viewer', 'instant-photos' ) ),
		);

		$definitions = array();
		foreach ( $specs as $spec ) {
			$definitions[] = array(
				'id'               => $spec[0],
				'origin'           => 'fotogrids-pro',
				'tier'             => 'pro_starter',
				'label'            => $spec[1],
				'animates'         => $spec[2],
				'coupling'         => $spec[3],
				'requires_caption' => $spec[4],
				'hide_on_layouts'  => $spec[5],
				'is_teaser'        => true,
				'preview_css_path' => $preview( $spec[0] ),
			);
		}

		return $definitions;
	}
}
