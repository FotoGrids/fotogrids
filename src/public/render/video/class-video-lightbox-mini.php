<?php
/**
 * Minimal video lightbox feature module.
 *
 * @package FotoGrids\Render\Video
 * @since   1.1.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Video;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Opens video items in a minimal, chrome-light overlay.
 *
 * Active when a gallery plays videos in a lightbox (video_playback_mode =
 * lightbox) but the gallery's item click behaviour is NOT the full lightbox.
 * In that case the full lightbox module is not on the page, so video items get
 * this minimal overlay instead - just the player and a close button, no info
 * panel, toolbar, or thumbnails.
 *
 * When click behaviour IS lightbox, videos play inside the full lightbox and
 * this module stays inactive.
 *
 * @package FotoGrids\Render\Video
 * @since   1.1.0
 */
final class Video_Lightbox_Mini implements Feature {

	public function id(): string {
		return 'fotogrids/video-lightbox-mini';
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

	/**
	 * Active for galleries with lightbox video playback whose click behaviour
	 * is neither the full lightbox nor disabled.
	 *
	 * When click behaviour is 'lightbox', videos play in the full lightbox.
	 * When it is 'nothing' (e.g. the page-builder "Make items clickable" toggle
	 * is off), items are not interactive at all, so the mini overlay must not
	 * fire either.
	 *
	 * @since 1.1.0
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}

		$mode = $render_context->settings['video_playback_mode'] ?? 'inline';
		if ( 'lightbox' !== $mode ) {
			return false;
		}

		$click = $render_context->behavior->click_behavior;
		return 'lightbox' !== $click && 'nothing' !== $click;
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Stamp the mini overlay theme + blur level so the CSS resolves the
	 * backdrop colour and blur (no inline colour / px from PHP).
	 *
	 * @since 1.1.0
	 * @param Render_Context $render_context Render context.
	 * @return array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$settings = $render_context->settings;

		$theme = is_string( $settings['lightbox_mini_theme'] ?? null ) && 'light' === $settings['lightbox_mini_theme']
			? 'light'
			: 'dark';

		$blur = is_string( $settings['lightbox_mini_overlay_blur'] ?? null )
			&& in_array( $settings['lightbox_mini_overlay_blur'], array( 'light', 'strong', 'none' ), true )
			? $settings['lightbox_mini_overlay_blur']
			: 'light';

		return array(
			'data-fg-mini-theme' => $theme,
			'data-fg-mini-blur'  => $blur,
		);
	}

	/**
	 * The mini overlay padding is a free-form length, so it stays a CSS
	 * variable fed from the gallery's responsive padding setting.
	 *
	 * @since 1.1.0
	 * @param Render_Context $render_context Render context.
	 * @return array<string, string>
	 */
	public function style_vars( Render_Context $render_context ): array {
		$padding_px = '24';
		$padding    = $render_context->settings['lightbox_mini_padding'] ?? null;
		if ( is_array( $padding ) ) {
			$desktop = $padding['desktop'] ?? null;
			if ( is_array( $desktop ) && isset( $desktop['value'] ) ) {
				$padding_px = (string) (int) $desktop['value'];
			} elseif ( is_numeric( $desktop ) ) {
				$padding_px = (string) (int) $desktop;
			}
		}

		return array(
			'--fg-lb-mini-padding' => $padding_px . 'px',
		);
	}

	/**
	 * Minimal lightbox CSS + JS.
	 *
	 * @since 1.1.0
	 * @param Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				// Shared, general-purpose mini overlay (also usable for images).
				'fotogrids-lightbox-mini' => new Asset_Decl(
					'lightbox/mini/lightbox-mini.css',
				),
			),
			array(
				'fotogrids-lightbox-mini'       => new Asset_Decl(
					'../../assets/js/lightbox-mini.js',
					array( 'fotogrids-runtime' ),
					true,
				),
				// Video glue: builds the player and hands it to the mini overlay.
				'fotogrids-video-lightbox-mini' => new Asset_Decl(
					'../../assets/js/video-lightbox-mini.js',
					array( 'fotogrids-runtime', 'fotogrids-lightbox-mini' ),
					true,
				),
			)
		);
	}
}
