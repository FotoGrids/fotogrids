<?php
/**
 * Shared helpers for video gallery items (file + embed).
 *
 * @package FotoGrids\Render\Video
 * @since   1.1.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Video;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Item-type detection and embed URL construction for video items.
 *
 * @package FotoGrids\Render\Video
 * @since   1.1.0
 */
final class Video_Item_Helpers {

	/**
	 * item_type for a Media Library video attachment.
	 *
	 * @since 1.1.0
	 * @var string
	 */
	public const TYPE_FILE = 'video_file';

	/**
	 * item_type for a YouTube embed (virtual item).
	 *
	 * @since 1.1.0
	 * @var string
	 */
	public const TYPE_YOUTUBE = 'video_youtube';

	/**
	 * item_type for a Vimeo embed (virtual item).
	 *
	 * @since 1.1.0
	 * @var string
	 */
	public const TYPE_VIMEO = 'video_vimeo';

	/**
	 * Determine whether an item_type identifier denotes any kind of video.
	 *
	 * @since 1.1.0
	 * @param string $item_type The stored item_type value.
	 * @return bool
	 */
	public static function is_video( string $item_type ): bool {
		return in_array(
			$item_type,
			array( self::TYPE_FILE, self::TYPE_YOUTUBE, self::TYPE_VIMEO ),
			true
		);
	}

	/**
	 * Determine whether an item_type identifier denotes an external embed.
	 *
	 * @since 1.1.0
	 * @param string $item_type The stored item_type value.
	 * @return bool
	 */
	public static function is_embed( string $item_type ): bool {
		return in_array(
			$item_type,
			array( self::TYPE_YOUTUBE, self::TYPE_VIMEO ),
			true
		);
	}

	/**
	 * Resolve the item_type for a Media Library attachment from its mime type.
	 *
	 * Returns TYPE_FILE for video/* attachments, otherwise 'image'. Embed
	 * items never pass through here - their item_type is stored explicitly.
	 *
	 * @since 1.1.0
	 * @param int $attachment_id The attachment post ID.
	 * @return string 'image' | 'video_file'
	 */
	public static function type_for_attachment( int $attachment_id ): string {
		$mime = (string) get_post_mime_type( $attachment_id );

		return str_starts_with( $mime, 'video/' ) ? self::TYPE_FILE : 'image';
	}

	/**
	 * Map an embed item_type to its short provider slug.
	 *
	 * @since 1.1.0
	 * @param string $item_type The stored item_type value.
	 * @return string 'youtube' | 'vimeo' | '' when not an embed.
	 */
	public static function provider_for_type( string $item_type ): string {
		if ( self::TYPE_YOUTUBE === $item_type ) {
			return 'youtube';
		}
		if ( self::TYPE_VIMEO === $item_type ) {
			return 'vimeo';
		}
		return '';
	}

	/**
	 * Extract the playback settings from a video item's stored custom_data.
	 *
	 * custom_data also carries the poster fields, which the poster resolver
	 * reads separately; only the playback keys belong in the markup the
	 * frontend players consume. An absent controls value defaults to true,
	 * matching the item editor; every other key defaults to off.
	 *
	 * @since 1.1.2
	 * @param array<string, mixed> $custom_data Stored item custom_data.
	 * @return array<string, bool>
	 */
	public static function playback_settings( array $custom_data ): array {
		return array(
			'autoplay' => ! empty( $custom_data['autoplay'] ),
			'mute'     => ! empty( $custom_data['mute'] ),
			'loop'     => ! empty( $custom_data['loop'] ),
			'controls' => ! isset( $custom_data['controls'] ) || (bool) $custom_data['controls'],
		);
	}

	/**
	 * Decide whether a video tile needs the FotoGrids play badge.
	 *
	 * The badge is the affordance of last resort: it is drawn only when the
	 * tile offers no other way to start playback. A file video that mounts a
	 * native player with its controls showing has one already, and a tile that
	 * starts playing on its own needs none. Every other case - a poster
	 * waiting for a click, an embed that has not loaded its iframe yet, or a
	 * tile that opens a lightbox - keeps it.
	 *
	 * @since 1.1.2
	 * @param string               $item_type     One of the video item_type values.
	 * @param string               $playback_mode The gallery's video_playback_mode.
	 * @param array<string, mixed> $settings      Per-item playback settings.
	 * @return bool
	 */
	public static function needs_play_badge( string $item_type, string $playback_mode, array $settings ): bool {
		if ( 'inline' !== $playback_mode ) {
			return true;
		}

		if ( ! empty( $settings['autoplay'] ) ) {
			return false;
		}

		if ( self::TYPE_FILE !== $item_type ) {
			return true;
		}

		return isset( $settings['controls'] ) && ! $settings['controls'];
	}

	/**
	 * Build the iframe src for an embed item, applying its stored settings.
	 *
	 * Uses the privacy-enhanced host (youtube-nocookie / player.vimeo) when
	 * privacy_mode is set. Player query parameters are derived from the
	 * per-item embed settings. The returned URL is not yet escaped - callers
	 * escape on output.
	 *
	 * @since 1.1.0
	 * @param string               $item_type One of the embed item_type values.
	 * @param string               $embed_id  The platform video ID.
	 * @param array<string, mixed> $settings  Per-item embed settings.
	 * @return string The iframe src URL, or empty string when not an embed.
	 */
	public static function build_embed_src( string $item_type, string $embed_id, array $settings ): string {
		if ( '' === $embed_id ) {
			return '';
		}

		if ( self::TYPE_YOUTUBE === $item_type ) {
			return self::build_youtube_src( $embed_id, $settings );
		}
		if ( self::TYPE_VIMEO === $item_type ) {
			return self::build_vimeo_src( $embed_id, $settings );
		}
		return '';
	}

	/**
	 * Build a YouTube iframe src with player parameters.
	 *
	 * @since 1.1.0
	 * @param string               $embed_id The YouTube video ID.
	 * @param array<string, mixed> $settings Per-item embed settings.
	 * @return string
	 */
	private static function build_youtube_src( string $embed_id, array $settings ): string {
		$privacy = ! empty( $settings['privacy_mode'] );
		$host    = $privacy ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
		$base    = $host . '/embed/' . rawurlencode( $embed_id );

		$args = array(
			'autoplay'       => ! empty( $settings['autoplay'] ) ? 1 : 0,
			'mute'           => ! empty( $settings['mute'] ) ? 1 : 0,
			'loop'           => ! empty( $settings['loop'] ) ? 1 : 0,
			'controls'       => isset( $settings['controls'] ) && ! $settings['controls'] ? 0 : 1,
			'cc_load_policy' => ! empty( $settings['captions'] ) ? 1 : 0,
			'rel'            => ( ( $settings['suggested_videos'] ?? 'channel' ) === 'any' ) ? 1 : 0,
			'playsinline'    => 1,
		);

		// YouTube loop requires an explicit playlist of the same video ID.
		if ( $args['loop'] ) {
			$args['playlist'] = $embed_id;
		}

		if ( ! empty( $settings['start_time'] ) ) {
			$args['start'] = (int) $settings['start_time'];
		}
		if ( ! empty( $settings['end_time'] ) ) {
			$args['end'] = (int) $settings['end_time'];
		}

		return add_query_arg( $args, $base );
	}

	/**
	 * Build a Vimeo iframe src with player parameters.
	 *
	 * @since 1.1.0
	 * @param string               $embed_id The Vimeo video ID.
	 * @param array<string, mixed> $settings Per-item embed settings.
	 * @return string
	 */
	private static function build_vimeo_src( string $embed_id, array $settings ): string {
		$base = 'https://player.vimeo.com/video/' . rawurlencode( $embed_id );

		$args = array(
			'autoplay'    => ! empty( $settings['autoplay'] ) ? 1 : 0,
			'muted'       => ! empty( $settings['mute'] ) ? 1 : 0,
			'loop'        => ! empty( $settings['loop'] ) ? 1 : 0,
			'dnt'         => ! empty( $settings['privacy_mode'] ) ? 1 : 0,
			'title'       => ! empty( $settings['intro_title'] ) ? 1 : 0,
			'portrait'    => ! empty( $settings['intro_portrait'] ) ? 1 : 0,
			'byline'      => ! empty( $settings['intro_byline'] ) ? 1 : 0,
			'playsinline' => 1,
		);

		if ( ! empty( $settings['start_time'] ) ) {
			$base .= '#t=' . (int) $settings['start_time'] . 's';
		}

		$color = $settings['controls_color'] ?? '';
		if ( is_string( $color ) && preg_match( '/^#[0-9a-fA-F]{3,6}$/', $color ) ) {
			$args['color'] = ltrim( $color, '#' );
		}

		return add_query_arg( $args, $base );
	}
}
