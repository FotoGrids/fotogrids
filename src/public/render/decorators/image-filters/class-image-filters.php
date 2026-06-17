<?php
declare(strict_types=1);

namespace FotoGrids\Render\Decorators\Image_Filters;

use FotoGrids\Render\Api\Decorator;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Responsive_Var;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Applies thumbnail and full-image filter CSS variables.
 *
 * Supports multiple simultaneous filter types selected via token_select.
 * Each type has its own per-filter amount setting. The resulting CSS
 * filter functions are concatenated in the order the user chose and
 * emitted as responsive CSS custom properties.
 *
 * @package FotoGrids\Render\Decorators\Image_Filters
 * @since   1.0.0
 */
final class Image_Filters implements Decorator {

	use Setting_Helpers;

	/** @var array<int, string> */
	private const ALLOWED_FILTER_TYPES = array(
		'grayscale',
		'sepia',
		'blur',
		'brightness',
		'contrast',
		'saturate',
		'invert',
		'opacity',
		'hue-rotate',
	);

	/**
	 * Maps each CSS filter type to its amount setting key suffix and CSS unit.
	 *
	 * Key  = CSS filter function name (e.g. 'blur', 'hue-rotate').
	 * suffix = the snake_case suffix appended after 'thumbnail_filter_amount_'
	 *           or 'full_image_filter_amount_'.  Note that 'hue-rotate' maps
	 *           to 'hue_rotate' (hyphen → underscore) to form a valid PHP/JS key.
	 * unit   = CSS unit string appended to the numeric value.
	 *
	 * @var array<string, array{suffix: string, unit: string}>
	 */
	private const FILTER_META = array(
		'grayscale'  => array(
			'suffix' => 'grayscale',
			'unit'   => '%',
		),
		'sepia'      => array(
			'suffix' => 'sepia',
			'unit'   => '%',
		),
		'blur'       => array(
			'suffix' => 'blur',
			'unit'   => 'px',
		),
		'brightness' => array(
			'suffix' => 'brightness',
			'unit'   => '%',
		),
		'contrast'   => array(
			'suffix' => 'contrast',
			'unit'   => '%',
		),
		'saturate'   => array(
			'suffix' => 'saturate',
			'unit'   => '%',
		),
		'invert'     => array(
			'suffix' => 'invert',
			'unit'   => '%',
		),
		'opacity'    => array(
			'suffix' => 'opacity',
			'unit'   => '%',
		),
		'hue-rotate' => array(
			'suffix' => 'hue_rotate',
			'unit'   => 'deg',
		),
	);

	public function id(): string {
		return 'fotogrids/image-filters';
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

	public function supports( Render_Context $render_context ): bool {
		$thumb_enabled = $this->setting_to_bool( $render_context->settings['thumbnail_filter_enabled'] ?? false );
		$full_enabled  = $this->setting_to_bool( $render_context->settings['full_image_filter_enabled'] ?? false );
		return $thumb_enabled || $full_enabled;
	}

	public function decorate_items( array $collection_items, Render_Context $render_context ): array {
		return $collection_items;
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		$attrs = array();

		$thumb_enabled = $this->setting_to_bool( $render_context->settings['thumbnail_filter_enabled'] ?? false );
		if ( $thumb_enabled ) {
			$types = $this->decode_filter_types( $render_context->settings['thumbnail_filter_type'] ?? array() );
			if ( ! empty( $types ) ) {
				$attrs['data-fg-filter'] = implode( ' ', $types );
			}
		}

		$full_enabled = $this->setting_to_bool( $render_context->settings['full_image_filter_enabled'] ?? false );
		if ( $full_enabled ) {
			$types = $this->decode_filter_types( $render_context->settings['full_image_filter_type'] ?? array() );
			if ( ! empty( $types ) ) {
				$attrs['data-fg-full-filter'] = implode( ' ', $types );
			}
		}

		return $attrs;
	}

	public function style_vars( Render_Context $render_context ): array {
		$vars     = array();
		$settings = $render_context->settings;

		// --- Thumbnail filters ---
		$thumb_enabled = $this->setting_to_bool( $settings['thumbnail_filter_enabled'] ?? false );
		if ( $thumb_enabled ) {
			$thumb_types = $this->decode_filter_types( $settings['thumbnail_filter_type'] ?? array() );

			if ( ! empty( $thumb_types ) ) {
				$vars['--fg-thumb-filter-regular'] = $this->build_responsive_filter_var(
					$settings,
					$thumb_types,
					'thumbnail_filter_amount_',
					false
				);
				$vars['--fg-thumb-filter-hover']   = $this->build_responsive_filter_var(
					$settings,
					$thumb_types,
					'thumbnail_filter_hover_amount_',
					false
				);
			}
		}

		// --- Full-image filters ---
		$full_enabled = $this->setting_to_bool( $settings['full_image_filter_enabled'] ?? false );
		if ( $full_enabled ) {
			$full_types = $this->decode_filter_types( $settings['full_image_filter_type'] ?? array() );
			if ( ! empty( $full_types ) ) {
				$vars['--fg-full-filter-regular'] = $this->build_responsive_filter_var(
					$settings,
					$full_types,
					'full_image_filter_amount_',
					false
				);
				$vars['--fg-full-filter-hover']   = $this->build_responsive_filter_var(
					$settings,
					$full_types,
					'full_image_filter_hover_amount_',
					false
				);
			}
		}

		return $vars;
	}

	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets();
	}

	/**
	 * Decode the filter_type setting into a validated array of CSS filter names.
	 *
	 * Accepts either:
	 *  - an already-decoded PHP array (from settings that went through json_decode)
	 *  - a JSON-encoded string (e.g. '["grayscale","blur"]')
	 *  - a legacy plain string (e.g. 'grayscale') for backwards compatibility
	 *
	 * @param  mixed $raw
	 * @return array<int, string>  Validated, ordered list of CSS filter names.
	 */
	private function decode_filter_types( $raw ): array {
		if ( is_string( $raw ) ) {
			// Try JSON first; fall back to treating it as a single legacy value.
			$decoded = json_decode( $raw, true );
			$raw     = is_array( $decoded ) ? $decoded : array( $raw );
		}

		if ( ! is_array( $raw ) ) {
			return array();
		}

		$valid = array();
		foreach ( $raw as $type ) {
			if ( is_string( $type ) && in_array( $type, self::ALLOWED_FILTER_TYPES, true ) ) {
				$valid[] = $type;
			}
		}

		return $valid;
	}

	/**
	 * Build a Responsive_Var whose per-breakpoint value is the combined CSS
	 * filter string for all requested filter types.
	 *
	 * Example output for desktop: "grayscale(50%) blur(3px)"
	 *
	 * @param  array<string, mixed> $settings     Full settings map.
	 * @param  array<int, string>   $filter_types Validated list of CSS filter names.
	 * @param  string               $key_prefix   e.g. 'thumbnail_filter_amount_'
	 * @param  bool                 $_unused      Reserved for future hover-specific logic.
	 * @return Responsive_Var
	 */
	private function build_responsive_filter_var(
		array $settings,
		array $filter_types,
		string $key_prefix,
		bool $_unused
	): Responsive_Var {
		$breakpoints = array( 'desktop', 'tablet', 'mobile' );
		$per_bp      = array();

		foreach ( $breakpoints as $bp ) {
			$parts = array();
			foreach ( $filter_types as $type ) {
				$meta = self::FILTER_META[ $type ] ?? null;
				if ( null === $meta ) {
					continue;
				}
				$key      = $key_prefix . $meta['suffix'];
				$resolved = $this->resolve_responsive_value( $settings[ $key ] ?? array(), $bp, $meta['unit'] );
				if ( '' !== $resolved ) {
					$parts[] = $type . '(' . $resolved . ')';
				}
			}
			$per_bp[ $bp ] = implode( ' ', $parts );
		}

		return new Responsive_Var(
			$per_bp['desktop'],
			$per_bp['tablet'],
			$per_bp['mobile'],
		);
	}
}
