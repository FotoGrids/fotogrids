<?php
declare(strict_types=1);

namespace FotoGrids\Render\Layouts;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Layout;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Internal\Item_Renderer;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Instant Photos layout module.
 *
 * A grid layout where every item is rendered as a white-bordered photo print
 * with the caption set below the image, optionally tilted and elevated like
 * an instant photo tossed on a table.
 *
 * Opt-in capabilities (same as Grid):
 *   - enforces_item_box  : --fg-item-aspect-ratio + --fg-item-fit
 *   - uses_columns       : --fg-cols / --fg-col-min / --fg-col-max
 *   - uses_item_spacing  : --fg-gap
 *
 * Per-item randomisation:
 *   - Rotation angle is randomised within ±max_rotation degrees.
 *   - Shadow offsets are counter-rotated so the light source appears
 *     to come from straight above the page regardless of tile rotation.
 *   - Randomisation is deterministic (seeded by gallery_id + attachment_id)
 *     so items stay visually stable across visits and through the page cache.
 *
 * @package FotoGrids\Render\Layouts
 * @since   1.0.0
 */
final class Layout_Instant_Photos implements Layout {

	/** Resting shadow offset in CSS pixels. */
	private const SHADOW_DISTANCE_REST = 1.0;

	/** Hover shadow offset in CSS pixels. */
	private const SHADOW_DISTANCE_HOVER = 4.0;

	/** Resting shadow blur in CSS pixels. */
	private const SHADOW_BLUR_REST = 2.0;

	/** Hover shadow blur in CSS pixels. */
	private const SHADOW_BLUR_HOVER = 20.0;

	/** World-up lift in CSS pixels when elevated (rest state). */
	private const LIFT_REST = 8.0;

	/** World-up lift in CSS pixels when elevated and hovered. */
	private const LIFT_HOVER = 20.0;

	/** Fixed hover-tilt boost in degrees when Action on Mouseover = "tilt". */
	private const HOVER_BOOST_DEG = 4.0;

	public function id(): string {
		return 'fotogrids/instant-photos';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	public function layout_key(): string {
		return 'instant-photos';
	}

	public function supports( Render_Context $render_context ): bool {
		return 'instant-photos' === $render_context->layout->layout_id;
	}

	public function render( Render_Context $render_context, Item_Renderer $item_renderer ): string {
		$settings = $render_context->settings;

		$max_rotation = $this->resolve_responsive_rotation( $settings );
		$elevation_on = (bool) ( $settings['instant_photo_elevation'] ?? true );
		$sticker_on   = ! $elevation_on && (bool) ( $settings['instant_photo_sticker'] ?? false );
		$sticker_hide = $sticker_on && (bool) ( $settings['instant_photo_sticker_hide_on_hover'] ?? false );

		// Seed source: the gallery's stable id (album id when rendering an
		// album of galleries). Falls back to a request-stable digest of the
		// first item id when no gallery id is present (e.g. previews).
		$seed_base = $this->resolve_seed_base( $render_context );

		// mt_srand mutates global PHP random state; capture nothing here and
		// restore an entropy-fresh seed at the end so unrelated code that
		// calls mt_rand() later in the same request isn't surprised.
		$items_html = '';
		foreach ( $render_context->items as $item_view ) {
			$decorated   = $this->decorate_item( $item_view, $seed_base, $max_rotation, $elevation_on, $sticker_on, $sticker_hide );
			$items_html .= $item_renderer->render( $decorated, $render_context );
		}
        // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_seeding_mt_srand -- Restores entropy-fresh global PRNG state after per-item deterministic seeding; no argument = re-seed from entropy.
		mt_srand();

		// data-fg-items-root marks this element as the container that
		// pagination-core.js can append/replace items inside.
		return '<div class="fg-instant-photos-track" data-fg-items-root="true">' . $items_html . '</div>';
	}

	public function structural_classes( Render_Context $render_context ): array {
		return array();
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		$action = (string) ( $settings['instant_photo_hover_action'] ?? 'straighten' );
		if ( ! in_array( $action, array( 'straighten', 'tilt' ), true ) ) {
			$action = 'straighten';
		}

		return array(
			// Read by instant-photos.css to switch the hover transform
			// between straightening toward 0deg and tilting further in
			// the same direction as the item's base rotation.
			'data-fg-hover-action' => $action,
		);
	}

	public function style_vars( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		$thickness = $settings['instant_photo_frame_thickness'] ?? array();
		if ( ! is_array( $thickness ) ) {
			$thickness = array();
		}
		$desktop = isset( $thickness['desktop'] ) ? (int) $thickness['desktop'] : 16;
		$tablet  = isset( $thickness['tablet'] ) ? (int) $thickness['tablet'] : 14;
		$mobile  = isset( $thickness['mobile'] ) ? (int) $thickness['mobile'] : 12;

		// --fg-hover-boost is unit-less and fixed (the picker only chooses
		// direction, not magnitude). CSS multiplies it by --fg-rotation-sign
		// when data-fg-hover-action="tilt" so the item leans further in its
		// existing direction.
		$vars = array(
			'--fg-frame-thickness' => new Responsive_Var(
				$desktop . 'px',
				$tablet . 'px',
				$mobile . 'px',
			),
			'--fg-hover-boost'     => (string) self::HOVER_BOOST_DEG,
		);

		// Sticker colour. Only emitted when sticker is actually rendered so
		// we don't pollute the cascade for galleries that don't use it; user
		// theme CSS can still override --fg-sticker-color directly when this
		// var is absent because the CSS uses var(--fg-sticker-color, ...).
		$elevation_on = (bool) ( $settings['instant_photo_elevation'] ?? true );
		$sticker_on   = ! $elevation_on && (bool) ( $settings['instant_photo_sticker'] ?? false );
		if ( $sticker_on ) {
			$sticker_color = (string) ( $settings['instant_photo_sticker_color'] ?? '' );
			if ( '' !== $sticker_color ) {
				$vars['--fg-sticker-color'] = $sticker_color;
			}
		}

		return $vars;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-render-base'           => new Asset_Decl(
					'base/collection-base.css'
				),
				'fotogrids-layout-instant-photos' => new Asset_Decl(
					'layouts/instant-photos/instant-photos.css'
				),
			)
		);
	}

	public function preferred_thumbnail_size( Render_Context $render_context ): ?string {
		return null;
	}

	public function requires_thumbnail_size( Render_Context $render_context ): bool {
		return false;
	}

	public function capabilities(): array {
		return array(
			'enforces_item_box' => true,
			'uses_columns'      => true,
			'uses_item_spacing' => true,
		);
	}

	/**
	 * Stamp per-item CSS custom properties onto the figure's inline style.
	 *
	 * Returns a cloned Item_View with the style and class additions. The
	 * original Item_View is immutable.
	 *
	 * @since   1.0.0
	 */
	private function decorate_item( $item_view, string $seed_base, float $max_rotation, bool $elevation_on, bool $sticker_on, bool $sticker_hide_on_hover ): \FotoGrids\Render\Api\Item_View {
		$rotation = 0.0;
		if ( $max_rotation > 0.0 ) {
			$seed = $this->seed_from( $seed_base, $item_view->id );
            // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_seeding_mt_srand -- Per-item deterministic seed so each tile's tilt angle is stable across renders; wp_rand() is non-seedable by design.
			mt_srand( $seed );
			// mt_rand range is integer; multiply by 100 to retain two
			// decimal places of randomness in the chosen angle.
            // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_mt_rand -- Paired with the seeded mt_srand() above for a reproducible tilt angle, not a security-sensitive RNG.
			$cents    = mt_rand( (int) ( -$max_rotation * 100 ), (int) ( $max_rotation * 100 ) );
			$rotation = $cents / 100;
		}

		$style = array(
			'--fg-rotation' => $this->format_deg( $rotation ),
		);

		// Base shadow (always emitted, even when elevation is off, so the
		// CSS rest rule has values to work with on every tile).
		$rest_shadow  = $this->shadow_offsets( $rotation, self::SHADOW_DISTANCE_REST );
		$hover_shadow = $this->shadow_offsets( $rotation, self::SHADOW_DISTANCE_HOVER );

		$style['--fg-shadow-x']          = $this->format_px( $rest_shadow[0] );
		$style['--fg-shadow-y']          = $this->format_px( $rest_shadow[1] );
		$style['--fg-shadow-blur']       = self::SHADOW_BLUR_REST . 'px';
		$style['--fg-shadow-hover-x']    = $this->format_px( $hover_shadow[0] );
		$style['--fg-shadow-hover-y']    = $this->format_px( $hover_shadow[1] );
		$style['--fg-shadow-hover-blur'] = self::SHADOW_BLUR_HOVER . 'px';

		if ( $elevation_on ) {
			// Counter-rotated world-up lift. The CSS rotate happens AFTER
			// the translate (because transforms chain right-to-left in
			// matrix order: `transform: translate(x,y) rotate(r)` applies
			// rotate first, then translate). To make the tile appear to
			// shift straight up the page regardless of its tilt, we cancel
			// out the rotation by pre-rotating the (0, -lift) vector by
			// +rotation here.
			$rest_lift  = $this->lift_offsets( $rotation, self::LIFT_REST );
			$hover_lift = $this->lift_offsets( $rotation, self::LIFT_HOVER );

			$style['--fg-lift-x']       = $this->format_px( $rest_lift[0] );
			$style['--fg-lift-y']       = $this->format_px( $rest_lift[1] );
			$style['--fg-lift-hover-x'] = $this->format_px( $hover_lift[0] );
			$style['--fg-lift-hover-y'] = $this->format_px( $hover_lift[1] );

			// Elevated shadow gap. When the tile lifts, the whole element
			// (including its rest shadow) moves up with it - which kills
			// the visual cue. To restore the "tile floating above its
			// shadow" effect, we stamp a second pair of shadow offsets
			// whose world-down distance includes the lift distance: as
			// the tile rises N px, the shadow extends N px further below,
			// producing a visible gap in world space.
			$elev_shadow_rest  = $this->shadow_offsets( $rotation, self::SHADOW_DISTANCE_REST + self::LIFT_REST );
			$elev_shadow_hover = $this->shadow_offsets( $rotation, self::SHADOW_DISTANCE_HOVER + self::LIFT_HOVER );

			$style['--fg-elev-shadow-x']       = $this->format_px( $elev_shadow_rest[0] );
			$style['--fg-elev-shadow-y']       = $this->format_px( $elev_shadow_rest[1] );
			$style['--fg-elev-shadow-hover-x'] = $this->format_px( $elev_shadow_hover[0] );
			$style['--fg-elev-shadow-hover-y'] = $this->format_px( $elev_shadow_hover[1] );
		}

		// Sign carrier for the hover-rotation boost so the CSS can amplify
		// the item's tilt in the same direction when Action on Mouseover
		// is "tilt". -1 / 0 / 1 keeps the CSS expression simple.
		$sign = 0;
		if ( $rotation > 0 ) {
			$sign = 1;
		} elseif ( $rotation < 0 ) {
			$sign = -1;
		}
		$style['--fg-rotation-sign'] = (string) $sign;

		$extra_classes = array( 'fg-instant-photo' );
		if ( $elevation_on ) {
			$extra_classes[] = 'fg-instant-photo--elevated';
		}
		if ( $sticker_on ) {
			$extra_classes[] = 'fg-instant-photo--stickered';
			if ( $sticker_hide_on_hover ) {
				$extra_classes[] = 'fg-instant-photo--sticker-hide-on-hover';
			}
		}

		return $item_view->with(
			array(
				'classes' => array_merge( $item_view->classes, $extra_classes ),
				'style'   => array_merge( $item_view->style, $style ),
			)
		);
	}

	/**
	 * Compute shadow x/y given a tile rotation and a "world-down" distance.
	 *
	 * CSS box-shadow draws in the rotated element's local space. To make the
	 * shadow appear to fall straight down (light from above) in screen space
	 * regardless of the tile's rotation, the offset is counter-rotated by
	 * the negative of the tile angle.
	 *
	 * @since   1.0.0
	 * @return  array{0: float, 1: float} [x, y] in CSS pixels.
	 */
	/**
	 * Compute the counter-rotated translate offsets that lift a tile
	 * straight up the page by $distance CSS pixels, regardless of the
	 * tile's rotation.
	 *
	 * The element's transform is `translate(x, y) rotate(r)` which, in
	 * matrix order, rotates first and then translates. We want the
	 * visible motion to be world-up (0, -distance) AFTER the rotate
	 * has been applied. So in the element's local pre-rotate space the
	 * translate vector must be the world-up vector pre-rotated by
	 * +rotation:
	 *   x =  sin(rot) * distance
	 *   y = -cos(rot) * distance
	 *
	 * @since   1.0.0
	 * @return  array{0: float, 1: float} [x, y] in CSS pixels.
	 */
	private function lift_offsets( float $rotation_deg, float $distance ): array {
		$rad = deg2rad( $rotation_deg );
		$x   = sin( $rad ) * $distance;
		$y   = -cos( $rad ) * $distance;
		return array( $x, $y );
	}

	private function shadow_offsets( float $rotation_deg, float $distance ): array {
		$rad = deg2rad( -$rotation_deg );
		// World-down vector is (0, distance). Rotating it by -rotation:
		//   x = sin(-rot) * distance
		//   y = cos(-rot) * distance
		$x = sin( $rad ) * $distance;
		$y = cos( $rad ) * $distance;
		return array( $x, $y );
	}

	/**
	 * Resolve the active device's max-rotation value from the responsive
	 * setting. We hand the per-device values straight through to CSS so
	 * the active value is selected by the existing responsive plumbing,
	 * but for randomisation we have to pick one bucket on the PHP side.
	 * Desktop is the widest range and the most visible — use it.
	 *
	 * @since   1.0.0
	 */
	private function resolve_responsive_rotation( array $settings ): float {
		$raw = $settings['instant_photo_max_rotation'] ?? array();
		if ( is_numeric( $raw ) ) {
			return max( 0.0, min( 30.0, (float) $raw ) );
		}
		if ( is_array( $raw ) && isset( $raw['desktop'] ) ) {
			return max( 0.0, min( 30.0, (float) $raw['desktop'] ) );
		}
		return 15.0;
	}

	/**
	 * Build a stable seed for crc32() that uniquely identifies this gallery.
	 *
	 * @since   1.0.0
	 */
	private function resolve_seed_base( Render_Context $render_context ): string {
		$gallery_id = $render_context->meta->gallery_id ?? 0;
		if ( $gallery_id > 0 ) {
			return 'fg-ip-' . $gallery_id;
		}
		// Preview/template path: fall back to a hash of the first few item
		// IDs so the same set of items always produces the same arrangement.
		$first_ids = array();
		foreach ( $render_context->items as $item ) {
			$first_ids[] = $item->id;
			if ( count( $first_ids ) >= 4 ) {
				break;
			}
		}
		return 'fg-ip-preview-' . implode( '-', $first_ids );
	}

	/**
	 * Per-item deterministic seed.
	 *
	 * @since   1.0.0
	 */
	private function seed_from( string $seed_base, int $item_id ): int {
		// crc32 returns an unsigned 32-bit integer on 64-bit platforms but
		// can return a signed int on 32-bit. mt_srand accepts both.
		return crc32( $seed_base . '|' . $item_id );
	}

	private function format_deg( float $value ): string {
		return rtrim( rtrim( number_format( $value, 2, '.', '' ), '0' ), '.' ) . 'deg';
	}

	private function format_px( float $value ): string {
		return rtrim( rtrim( number_format( $value, 2, '.', '' ), '0' ), '.' ) . 'px';
	}
}
