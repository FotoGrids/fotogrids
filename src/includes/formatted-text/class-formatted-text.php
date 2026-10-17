<?php
/**
 * Formatted captions and descriptions: the entry point for rendering and saving.
 *
 * @package FotoGrids\Formatted_Text
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Formatted_Text;

use FotoGrids\Hooks\Filters_Formatted_Text;
use FotoGrids\Settings\Text_Formatting_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Formats stored captions and descriptions for display, converts them to
 * plain text, and applies the save rules.
 *
 * Context keys: profile, surface, field, item_id, gallery_id. Surfaces:
 * thumbnail, album_tile, lightbox, lightbox_mini, lightbox_grid, item_editor.
 *
 * @since 1.3.0
 */
final class Formatted_Text {

	/**
	 * Capability that allows adding formatting.
	 *
	 * @since 1.3.0
	 */
	const CAPABILITY = 'format_fotogrids_item_text';

	/**
	 * Places formatted text is shown or edited.
	 *
	 * @since 1.3.0
	 */
	const SURFACES = array( 'thumbnail', 'album_tile', 'lightbox', 'lightbox_mini', 'lightbox_grid', 'item_editor' );

	/**
	 * Resolved modes and link policies, keyed by profile, surface and gallery.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static array $resolved = array();

	/**
	 * Formats a stored value as safe HTML.
	 *
	 * @since 1.3.0
	 * @param string               $raw     Stored value.
	 * @param array<string, mixed> $context Profile, surface, field, item_id, gallery_id; plus
	 *                                      links (bool) and max_length (int).
	 * @return string
	 */
	public static function html( string $raw, array $context = array() ): string {
		$context = self::context( $context );
		$profile = Schema::profile( $context['profile'] );
		$resolve = self::resolve( $context );
		$links   = false !== ( $context['links'] ?? true );
		$options = array(
			'mode'       => $resolve['mode'],
			'links'      => $links,
			'policy'     => $links ? $resolve['policy'] : null,
			'max_length' => (int) ( $context['max_length'] ?? 0 ),
		);

		$nodes = Formatter::parse( $raw, $profile, $options )['nodes'];
		$html  = Formatter::to_html( $nodes, false, true );

		$output_context         = $context;
		$output_context['mode'] = $resolve['mode'];
		unset( $output_context['links'], $output_context['max_length'] );

		$filtered = apply_filters( Filters_Formatted_Text::OUTPUT, $html, $raw, $output_context );
		if ( is_string( $filtered ) && $filtered !== $html ) {
			$nodes = Formatter::parse(
				$filtered,
				$profile,
				array(
					'mode'       => $resolve['mode'],
					'links'      => $links,
					'policy'     => null,
					'max_length' => $options['max_length'],
				)
			)['nodes'];
		} elseif ( ! is_string( $filtered ) ) {
			$nodes = array();
		}

		if ( $links ) {
			$nodes = Formatter::add_screen_reader_text( $nodes, self::new_tab_label() );
		}

		return Formatter::to_html( $nodes, false, true );
	}

	/**
	 * Converts a stored value to plain text with "\n" line breaks.
	 *
	 * The result is text: escape it for its context.
	 *
	 * @since 1.3.0
	 * @param string               $raw     Stored value.
	 * @param array<string, mixed> $context Keys: profile, use (share, og, title_tag, aria, seo), item_id.
	 * @return string
	 */
	public static function plain_text( string $raw, array $context = array() ): string {
		$context = wp_parse_args(
			$context,
			array(
				'profile' => Schema::DEFAULT_PROFILE,
				'use'     => '',
				'item_id' => 0,
			)
		);
		$text    = Formatter::to_text(
			Formatter::parse( $raw, Schema::profile( (string) $context['profile'] ), array( 'mode' => 'plain' ) )['nodes']
		);

		$filtered = apply_filters( Filters_Formatted_Text::PLAIN_TEXT, $text, $raw, $context );
		return is_string( $filtered ) ? $filtered : $text;
	}

	/**
	 * Returns plain text on one line, for attributes and meta tags.
	 *
	 * @since 1.3.0
	 * @param string               $raw     Stored value.
	 * @param array<string, mixed> $context See plain_text().
	 * @return string
	 */
	public static function single_line( string $raw, array $context = array() ): string {
		return trim( (string) preg_replace( '/\s*\n\s*/', ' ', self::plain_text( $raw, $context ) ) );
	}

	/**
	 * Returns the canonical stored form of a value.
	 *
	 * @since 1.3.0
	 * @param string $raw     Value to normalize.
	 * @param string $mode    'basic' keeps allowed formatting, 'plain' keeps escaped text only.
	 * @param string $profile Profile name.
	 * @return array{html: string, lossy: bool}
	 */
	public static function normalize( string $raw, string $mode = 'basic', string $profile = Schema::DEFAULT_PROFILE ): array {
		$parsed = Formatter::parse(
			$raw,
			Schema::profile( $profile ),
			array(
				'mode'   => 'plain' === $mode ? 'plain' : 'basic',
				'links'  => true,
				'policy' => null,
			)
		);
		return array(
			'html'  => Formatter::to_html( $parsed['nodes'], true ),
			'lossy' => $parsed['lossy'],
		);
	}

	/**
	 * Applies the save rules to a submitted caption or description.
	 *
	 * Users with the formatting capability keep their markup, filtered by
	 * `wp_kses_post()` unless they hold `unfiltered_html`. Other users store
	 * escaped plain text.
	 *
	 * @since 1.3.0
	 * @param string               $value   Submitted value, unslashed.
	 * @param array<string, mixed> $context Keys: profile, field, item_id, user_id, source.
	 * @return string
	 */
	public static function sanitize_for_save( string $value, array $context = array() ): string {
		$context = wp_parse_args(
			$context,
			array(
				'profile' => Schema::DEFAULT_PROFILE,
				'field'   => '',
				'item_id' => 0,
				'user_id' => get_current_user_id(),
				'source'  => 'item_editor',
			)
		);

		$raw        = str_replace( array( "\r\n", "\r" ), "\n", $value );
		$user_id    = (int) $context['user_id'];
		$can_format = self::user_can_format( $user_id );

		if ( $can_format ) {
			$stored = user_can( $user_id, 'unfiltered_html' ) ? $raw : wp_kses_post( $raw );
		} else {
			$stored = self::normalize( $raw, 'plain', (string) $context['profile'] )['html'];
		}

		$context['can_format'] = $can_format;
		$filtered              = apply_filters( Filters_Formatted_Text::SANITIZE_FOR_SAVE, $stored, $value, $context );
		return is_string( $filtered ) ? $filtered : $stored;
	}

	/**
	 * Whether a user may add formatting through FotoGrids.
	 *
	 * @since 1.3.0
	 * @param int $user_id User ID; the current user when 0.
	 * @return bool
	 */
	public static function user_can_format( int $user_id = 0 ): bool {
		$user_id = $user_id > 0 ? $user_id : get_current_user_id();
		return $user_id > 0 && user_can( $user_id, self::CAPABILITY );
	}

	/**
	 * Formatting configuration for browser-rendered surfaces of one gallery.
	 *
	 * The profile is included only when a filter changed it; the browser
	 * formatter bundles the default.
	 *
	 * @since 1.3.0
	 * @param string $surface    Surface name.
	 * @param int    $gallery_id Gallery ID.
	 * @param string $profile    Profile name.
	 * @return array<string, mixed>
	 */
	public static function client_config( string $surface, int $gallery_id, string $profile = Schema::DEFAULT_PROFILE ): array {
		$resolve = self::resolve(
			self::context(
				array(
					'profile'    => $profile,
					'surface'    => $surface,
					'gallery_id' => $gallery_id,
				)
			)
		);

		$config = array(
			'mode'   => $resolve['mode'],
			'policy' => array(
				'newTab' => (bool) ( $resolve['policy']['new_tab'] ?? false ),
				'rel'    => array_values( $resolve['policy']['rel'] ?? array() ),
			),
			'labels' => array( 'newTab' => self::new_tab_label() ),
		);

		$custom = Schema::profile_for_client( $profile );
		if ( null !== $custom ) {
			$config['profile'] = $custom;
		}
		return $config;
	}

	/**
	 * Configuration for the item editor's caption and description fields.
	 *
	 * @since 1.3.0
	 * @param int    $gallery_id Gallery being edited, or 0.
	 * @param string $profile    Profile name.
	 * @return array<string, mixed>
	 */
	public static function editor_config( int $gallery_id = 0, string $profile = Schema::DEFAULT_PROFILE ): array {
		$resolve = self::resolve(
			self::context(
				array(
					'profile'    => $profile,
					'surface'    => 'item_editor',
					'gallery_id' => $gallery_id,
				)
			)
		);

		$config = array(
			'mode'         => $resolve['mode'],
			'canFormat'    => self::user_can_format(),
			'linkDefaults' => array(
				'newTab'   => (bool) $resolve['policy']['new_tab'],
				'nofollow' => in_array( 'nofollow', $resolve['policy']['rel'], true ),
			),
			'settingsUrl'  => current_user_can( 'manage_fotogrids_settings' )
				? admin_url( 'admin.php?page=fotogrids-settings&tab=gallery_items' )
				: '',
		);

		$custom = Schema::profile_for_client( $profile );
		if ( null !== $custom ) {
			$config['profile'] = $custom;
		}
		return $config;
	}

	/**
	 * Clears per-request caches.
	 *
	 * @since 1.3.0
	 * @return void
	 */
	public static function reset(): void {
		self::$resolved = array();
		Schema::reset();
		Text_Formatting_Settings_Store::reset_cache();
	}

	/**
	 * Translated label read out after a link that opens in a new tab.
	 *
	 * @since 1.3.0
	 * @return string
	 */
	public static function new_tab_label(): string {
		return __( '(opens in a new tab)', 'fotogrids' );
	}

	/**
	 * Fills in context defaults.
	 *
	 * @since 1.3.0
	 * @param array<string, mixed> $context Context.
	 * @return array<string, mixed>
	 */
	private static function context( array $context ): array {
		$context = wp_parse_args(
			$context,
			array(
				'profile'    => Schema::DEFAULT_PROFILE,
				'surface'    => 'thumbnail',
				'field'      => '',
				'item_id'    => 0,
				'gallery_id' => 0,
			)
		);

		$context['profile']    = (string) $context['profile'];
		$context['surface']    = (string) $context['surface'];
		$context['field']      = (string) $context['field'];
		$context['item_id']    = (int) $context['item_id'];
		$context['gallery_id'] = (int) $context['gallery_id'];
		return $context;
	}

	/**
	 * Resolves the mode and link policy for a surface of a gallery.
	 *
	 * @since 1.3.0
	 * @param array<string, mixed> $context Context from context().
	 * @return array{mode: string, policy: array{new_tab: bool, rel: string[]}}
	 */
	private static function resolve( array $context ): array {
		$key = $context['profile'] . '|' . $context['surface'] . '|' . $context['gallery_id'];
		if ( isset( self::$resolved[ $key ] ) ) {
			return self::$resolved[ $key ];
		}

		$settings    = Text_Formatting_Settings_Store::get();
		$filter_args = array(
			'profile'    => $context['profile'],
			'surface'    => $context['surface'],
			'gallery_id' => $context['gallery_id'],
		);

		$mode = apply_filters( Filters_Formatted_Text::MODE, $settings['mode'], $filter_args );
		if ( ! is_string( $mode ) || ! in_array( $mode, Text_Formatting_Settings_Store::MODES, true ) ) {
			$mode = $settings['mode'];
		}

		$policy = apply_filters(
			Filters_Formatted_Text::LINK_POLICY,
			array(
				'new_tab' => $settings['links_new_tab'],
				'rel'     => $settings['links_nofollow'] ? array( 'nofollow' ) : array(),
			),
			$filter_args
		);

		$link_rel = Schema::floor()['linkRel'];
		$rel      = array();
		foreach ( is_array( $policy['rel'] ?? null ) ? $policy['rel'] : array() as $token ) {
			$token = is_string( $token ) ? strtolower( trim( $token ) ) : '';
			if ( in_array( $token, $link_rel, true ) && 'noopener' !== $token && ! in_array( $token, $rel, true ) ) {
				$rel[] = $token;
			}
		}

		self::$resolved[ $key ] = array(
			'mode'   => $mode,
			'policy' => array(
				'new_tab' => is_array( $policy ) && ! empty( $policy['new_tab'] ),
				'rel'     => $rel,
			),
		);
		return self::$resolved[ $key ];
	}
}
