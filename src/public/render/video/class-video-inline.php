<?php
/**
 * Inline video playback feature module.
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
 * Ships the inline-playback assets for galleries set to play videos inline.
 *
 * Active when the gallery's video_playback_mode is "inline". The client swaps
 * a video tile's poster for a real player on click. Galleries set to
 * "lightbox" playback get their video experience from the lightbox / mini
 * lightbox modules instead, so this module's assets are not enqueued there.
 *
 * @package FotoGrids\Render\Video
 * @since   1.1.0
 */
final class Video_Inline implements Feature {

	public function id(): string {
		return 'fotogrids/video-inline';
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
	 * Active for galleries whose video playback mode is inline, unless item
	 * clicks are disabled ('nothing', e.g. the page-builder "Make items
	 * clickable" toggle is off).
	 *
	 * @since 1.1.0
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}

		if ( 'nothing' === $render_context->behavior->click_behavior ) {
			return false;
		}

		$mode = $render_context->settings['video_playback_mode'] ?? 'inline';
		return 'inline' === $mode;
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

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * Inline-playback CSS + JS.
	 *
	 * @since 1.1.0
	 * @param Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(
				'fotogrids-video-inline' => new Asset_Decl(
					'video/video-inline.css',
				),
			),
			array(
				'fotogrids-video-inline' => new Asset_Decl(
					'../../assets/js/video-inline.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}
}
