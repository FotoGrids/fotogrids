<?php
/**
 * Global sharing settings store.
 *
 * @package FotoGrids\Settings
 * @since   1.0.0
 */

namespace FotoGrids\Settings;

use FotoGrids\Hooks\Filters_Sharing;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Reads and writes the site-wide sharing configuration.
 *
 * Sharing is global: one configuration drives the lightbox, thumbnails and
 * View pages. Per-collection overrides layer on top of this baseline elsewhere.
 * Stored as a single option, following the Plugin_Settings_Store pattern.
 *
 * @since 1.0.0
 */
final class Sharing_Settings_Store {

	const OPTION = 'fotogrids_sharing_settings';

	/**
	 * Recognised placement tokens (where share controls may appear).
	 *
	 * @var string[]
	 */
	const PLACEMENTS = array( 'view_page', 'lightbox', 'thumbnail', 'full_image' );

	/**
	 * Recognised social networks.
	 *
	 * @var string[]
	 */
	const NETWORKS = array( 'facebook', 'x', 'pinterest', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'copy_link' );

	/**
	 * Default values for every sharing setting.
	 *
	 * @since 1.0.0
	 * @return array<string, mixed>
	 */
	public static function defaults(): array {
		$defaults = array(
			'enable_social_sharing' => false,
			'networks'              => array(
				'facebook'  => true,
				'x'         => true,
				'pinterest' => true,
				'linkedin'  => false,
				'whatsapp'  => false,
				'telegram'  => false,
				'reddit'    => false,
				'email'     => true,
				'copy_link' => true,
			),
			'button_style'          => 'icons_only',
			'button_size'           => 'medium',
			'placements'            => array( 'view_page', 'lightbox' ),
			'custom_text'           => '',
			'track_clicks'          => true,
			'deep_linking_enabled'  => true,
			'embedded_share_target' => 'image',
		);

		/**
		 * Filter the default sharing settings.
		 *
		 * @since 1.0.0
		 * @param array<string,mixed> $defaults
		 */
		return apply_filters( Filters_Sharing::DEFAULTS, $defaults );
	}

	/**
	 * Stored sharing settings merged over the defaults.
	 *
	 * @since 1.0.0
	 * @return array<string, mixed>
	 */
	public static function get(): array {
		$defaults = self::defaults();
		$stored   = get_option( self::OPTION, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$settings             = wp_parse_args( $stored, $defaults );
		$settings['networks'] = wp_parse_args(
			is_array( $stored['networks'] ?? null ) ? $stored['networks'] : array(),
			$defaults['networks']
		);

		/**
		 * Filter the resolved global sharing settings.
		 *
		 * @since 1.0.0
		 * @param array<string,mixed> $settings
		 */
		return apply_filters( Filters_Sharing::SETTINGS, $settings );
	}

	/**
	 * Sanitise a raw sharing settings map.
	 *
	 * @since 1.0.0
	 * @param mixed $value Raw input (REST params or POST).
	 * @return array<string, mixed>
	 */
	public static function sanitize( $value ): array {
		$defaults = self::defaults();
		$input    = is_array( $value ) ? $value : array();

		$networks_in = is_array( $input['networks'] ?? null ) ? $input['networks'] : array();
		$networks    = array();
		foreach ( self::NETWORKS as $network ) {
			$networks[ $network ] = self::truthy(
				$networks_in[ $network ] ?? $defaults['networks'][ $network ]
			);
		}

		$placements_in = is_array( $input['placements'] ?? null ) ? $input['placements'] : array();
		$placements    = array_values( array_intersect( self::PLACEMENTS, array_map( 'sanitize_key', $placements_in ) ) );
		if ( empty( $placements ) ) {
			$placements = $defaults['placements'];
		}

		$button_style = sanitize_key( $input['button_style'] ?? $defaults['button_style'] );
		if ( ! in_array( $button_style, array( 'icons_only', 'icons_labels', 'labels_only' ), true ) ) {
			$button_style = $defaults['button_style'];
		}

		$button_size = sanitize_key( $input['button_size'] ?? $defaults['button_size'] );
		if ( ! in_array( $button_size, array( 'small', 'medium', 'large' ), true ) ) {
			$button_size = $defaults['button_size'];
		}

		$embedded_target = sanitize_key( $input['embedded_share_target'] ?? $defaults['embedded_share_target'] );
		if ( ! in_array( $embedded_target, array( 'image', 'page' ), true ) ) {
			$embedded_target = $defaults['embedded_share_target'];
		}

		$sanitized = array(
			'enable_social_sharing' => self::truthy( $input['enable_social_sharing'] ?? $defaults['enable_social_sharing'] ),
			'networks'              => $networks,
			'button_style'          => $button_style,
			'button_size'           => $button_size,
			'placements'            => $placements,
			'custom_text'           => sanitize_text_field( $input['custom_text'] ?? $defaults['custom_text'] ),
			'track_clicks'          => self::truthy( $input['track_clicks'] ?? $defaults['track_clicks'] ),
			'deep_linking_enabled'  => self::truthy( $input['deep_linking_enabled'] ?? $defaults['deep_linking_enabled'] ),
			'embedded_share_target' => $embedded_target,
		);

		/**
		 * Filter the sanitised sharing settings. Pro adds sanitisation for its
		 * own keys here.
		 *
		 * @since 1.0.0
		 * @param array<string,mixed> $sanitized
		 * @param array<string,mixed> $input
		 */
		return apply_filters( Filters_Sharing::SANITIZE, $sanitized, $input );
	}

	/**
	 * Sanitise and persist sharing settings.
	 *
	 * @since 1.0.0
	 * @param mixed $value Raw input.
	 * @return array<string, mixed> The stored, merged settings.
	 */
	public static function save( $value ): array {
		update_option( self::OPTION, self::sanitize( $value ) );
		return self::get();
	}

	/**
	 * Resolve the effective sharing configuration for one collection.
	 *
	 * Starts from the global settings, then applies the collection's override
	 * when sharing_override is on. A collection that disables sharing, or a site
	 * with sharing turned off, resolves to enabled => false.
	 *
	 * @since 1.0.0
	 * @param int $collection_id Gallery or album ID.
	 * @return array<string, mixed>
	 */
	public static function resolve( int $collection_id ): array {
		$global = self::get();

		$resolved = array(
			'enabled'      => (bool) $global['enable_social_sharing'],
			'networks'     => $global['networks'],
			'placements'   => $global['placements'],
			'button_style' => $global['button_style'],
			'button_size'  => $global['button_size'],
			'custom_text'  => $global['custom_text'],
			'track_clicks' => (bool) $global['track_clicks'],
		);

		if ( $resolved['enabled'] && $collection_id > 0 ) {
			$override = self::truthy( get_post_meta( $collection_id, 'fotogrids_sharing_override', true ) );

			if ( $override ) {
				if ( self::truthy( get_post_meta( $collection_id, 'fotogrids_sharing_disabled_for_collection', true ) ) ) {
					$resolved['enabled'] = false;
				} else {
					$networks_override   = self::decode_array( get_post_meta( $collection_id, 'fotogrids_sharing_networks_override', true ) );
					$placements_override = self::decode_array( get_post_meta( $collection_id, 'fotogrids_sharing_placements_override', true ) );
					$text_override       = get_post_meta( $collection_id, 'fotogrids_sharing_custom_text_override', true );

					if ( ! empty( $networks_override ) ) {
						$networks = array();
						foreach ( self::NETWORKS as $network ) {
							$networks[ $network ] = in_array( $network, $networks_override, true );
						}
						$resolved['networks'] = $networks;
					}
					if ( ! empty( $placements_override ) ) {
						$resolved['placements'] = array_values( array_intersect( self::PLACEMENTS, $placements_override ) );
					}
					if ( is_string( $text_override ) && '' !== $text_override ) {
						$resolved['custom_text'] = sanitize_text_field( $text_override );
					}
				}
			}
		}

		/**
		 * Filter the resolved sharing configuration for a collection.
		 *
		 * @since 1.0.0
		 * @param array<string,mixed> $resolved
		 * @param int                 $collection_id
		 */
		return apply_filters( Filters_Sharing::RESOLVED, $resolved, $collection_id );
	}

	/**
	 * Decode a post-meta value that may be a JSON array or already an array.
	 *
	 * @since 1.0.0
	 * @param mixed $value
	 * @return array<int, string>
	 */
	private static function decode_array( $value ): array {
		if ( is_array( $value ) ) {
			return array_map( 'sanitize_key', $value );
		}
		if ( is_string( $value ) && '' !== $value ) {
			$decoded = json_decode( $value, true );
			if ( is_array( $decoded ) ) {
				return array_map( 'sanitize_key', $decoded );
			}
		}
		return array();
	}

	/**
	 * Coerce any truthy form posted by the UI into a strict bool.
	 *
	 * @since 1.0.0
	 * @param mixed $value
	 * @return bool
	 */
	public static function truthy( $value ): bool {
		return true === $value
			|| 1 === $value
			|| '1' === $value
			|| 'true' === $value
			|| 'on' === $value;
	}
}
