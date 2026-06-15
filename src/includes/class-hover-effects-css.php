<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Hover Effects CSS Generator
 *
 * Generates CSS for hover effects dynamically based on gallery settings
 */
class Hover_Effects_CSS {

	/**
	 * Get CSS for a specific hover effect
	 *
	 * @param string $gallery_id Gallery instance ID
	 * @param string $effect Effect name (e.g., 'slide-up', 'fade-both')
	 * @param array $settings Gallery settings
	 * @return string Generated CSS
	 */
	public static function get_effect_css( $gallery_id, $effect, $settings = array() ) {
		if ( empty( $effect ) || 'none' === $effect ) {
			return '';
		}

		$selector   = "#{$gallery_id} .fotogrids-gallery-item";
		$item_class = 'fotogrids-hover-' . sanitize_html_class( $effect );

		// Generate CSS variables based on settings
		$css_variables = self::generate_css_variables( $gallery_id, $settings );

		// Get effect-specific CSS
		$effect_css = self::get_effect_styles( $selector, $item_class, $effect );

		return $css_variables . $effect_css;
	}

	/**
	 * Generate CSS custom properties (variables) from settings
	 *
	 * @param string $gallery_id Gallery instance ID
	 * @param array $settings Gallery settings
	 * @return string CSS variables
	 */
	private static function generate_css_variables( $gallery_id, $settings ) {
		$vars = array();

		// Caption placement - affects overlay positioning
		$caption_placement                 = isset( $settings['caption_placement'] ) ? $settings['caption_placement'] : 'overlay';
		$vars['--hover-caption-placement'] = $caption_placement;

		// Caption colors
		$caption_color                 = isset( $settings['caption_color'] ) ? $settings['caption_color'] : '#ffffff';
		$vars['--hover-caption-color'] = $caption_color;

		$caption_bg                 = isset( $settings['caption_background'] ) ? $settings['caption_background'] : 'rgba(0, 0, 0, 0.7)';
		$vars['--hover-caption-bg'] = $caption_bg;

		// Caption sizes
		$title_size                 = isset( $settings['caption_title_size'] ) ? $settings['caption_title_size'] : '16px';
		$vars['--hover-title-size'] = is_numeric( $title_size ) ? $title_size . 'px' : $title_size;

		$description_size                 = isset( $settings['caption_description_size'] ) ? $settings['caption_description_size'] : '14px';
		$vars['--hover-description-size'] = is_numeric( $description_size ) ? $description_size . 'px' : $description_size;

		// Build CSS with gallery-scoped variables
		$css = "#{$gallery_id} {\n";
		foreach ( $vars as $var => $value ) {
			$css .= "    {$var}: {$value};\n";
		}
		$css .= "}\n";

		// Add caption placement-specific positioning
		if ( 'below' === $caption_placement ) {
			$css .= "#{$gallery_id} .fotogrids-item-overlay {\n";
			$css .= "    position: static;\n";
			$css .= "    transform: none !important;\n";
			$css .= "    margin-top: 8px;\n";
			$css .= "}\n";
		} elseif ( 'above' === $caption_placement ) {
			$css .= "#{$gallery_id} .fotogrids-item-overlay {\n";
			$css .= "    position: static;\n";
			$css .= "    transform: none !important;\n";
			$css .= "    margin-bottom: 8px;\n";
			$css .= "    order: -1;\n";
			$css .= "}\n";
		}
		// 'overlay' is the default, no special positioning needed

		return $css;
	}

	/**
	 * Get CSS styles for a specific effect
	 *
	 * @param string $selector Base selector (e.g., "#gallery-123 .fotogrids-gallery-item")
	 * @param string $item_class Item class (e.g., "fotogrids-hover-slide-up")
	 * @param string $effect Effect name
	 * @return string CSS
	 */
	private static function get_effect_styles( $selector, $item_class, $effect ) {
		$effects = self::get_all_effects();

		if ( ! isset( $effects[ $effect ] ) ) {
			return '';
		}

		$effect_data = $effects[ $effect ];
		$css         = '';

		// Apply item class
		$css .= "{$selector}.{$item_class} {\n";
		if ( isset( $effect_data['item_styles'] ) ) {
			foreach ( $effect_data['item_styles'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
		}
		$css .= "}\n";

		// Overlay styles
		if ( isset( $effect_data['overlay_styles'] ) ) {
			$css .= "{$selector}.{$item_class} .fotogrids-item-overlay {\n";
			foreach ( $effect_data['overlay_styles'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		// Hover styles
		if ( isset( $effect_data['hover_styles'] ) ) {
			$css .= "{$selector}.{$item_class}:hover {\n";
			foreach ( $effect_data['hover_styles'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		// Hover overlay styles
		if ( isset( $effect_data['hover_overlay_styles'] ) ) {
			$css .= "{$selector}.{$item_class}:hover .fotogrids-item-overlay {\n";
			foreach ( $effect_data['hover_overlay_styles'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		// Image hover styles
		if ( isset( $effect_data['hover_image_styles'] ) ) {
			$css .= "{$selector}.{$item_class}:hover img {\n";
			foreach ( $effect_data['hover_image_styles'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		// Animations
		if ( isset( $effect_data['animations'] ) ) {
			foreach ( $effect_data['animations'] as $name => $keyframes ) {
				$css .= "@keyframes {$name} {\n";
				foreach ( $keyframes as $percent => $frame_styles ) {
					$css .= "    {$percent} {\n";
					foreach ( $frame_styles as $property => $value ) {
						$css .= "        {$property}: {$value};\n";
					}
					$css .= "    }\n";
				}
				$css .= "}\n";
			}
		}

		// Special pseudo-elements
		if ( isset( $effect_data['pseudo_before'] ) ) {
			$css .= "{$selector}.{$item_class}::before {\n";
			$css .= "    content: '';\n";
			foreach ( $effect_data['pseudo_before'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		if ( isset( $effect_data['pseudo_after'] ) ) {
			$css .= "{$selector}.{$item_class}::after {\n";
			$css .= "    content: '';\n";
			foreach ( $effect_data['pseudo_after'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		if ( isset( $effect_data['hover_pseudo_before'] ) ) {
			$css .= "{$selector}.{$item_class}:hover::before {\n";
			foreach ( $effect_data['hover_pseudo_before'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		if ( isset( $effect_data['hover_pseudo_after'] ) ) {
			$css .= "{$selector}.{$item_class}:hover::after {\n";
			foreach ( $effect_data['hover_pseudo_after'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		// Inner element styles (for flip effect)
		if ( isset( $effect_data['inner_styles'] ) ) {
			$css .= "{$selector}.{$item_class} .fotogrids-item-inner {\n";
			foreach ( $effect_data['inner_styles'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		if ( isset( $effect_data['hover_inner_styles'] ) ) {
			$css .= "{$selector}.{$item_class}:hover .fotogrids-item-inner {\n";
			foreach ( $effect_data['hover_inner_styles'] as $property => $value ) {
				$css .= "    {$property}: {$value};\n";
			}
			$css .= "}\n";
		}

		return $css;
	}

	/**
	 * Get all hover effect definitions
	 *
	 * @return array All effect definitions
	 */
	private static function get_all_effects() {
		return array(
			'slide-up'       => array(
				'overlay_styles'       => array(
					'transform'  => 'translateY(100%)',
					'transition' => 'transform 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'transform' => 'translateY(0)',
				),
			),
			'fade-both'      => array(
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'slide-left'     => array(
				'overlay_styles'       => array(
					'transform'  => 'translateX(-100%)',
					'transition' => 'transform 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'transform' => 'translateX(0)',
				),
			),
			'scale'          => array(
				'item_styles'          => array(
					'transition' => 'transform 0.3s ease',
				),
				'hover_styles'         => array(
					'transform' => 'scale(1.05)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'rotate'         => array(
				'item_styles'          => array(
					'transition' => 'transform 0.3s ease',
				),
				'hover_styles'         => array(
					'transform' => 'rotate(2deg)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'slide-right'    => array(
				'overlay_styles'       => array(
					'transform'  => 'translateX(100%)',
					'transition' => 'transform 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'transform' => 'translateX(0)',
				),
			),
			'bounce'         => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-bounce 0.6s ease',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-bounce' => array(
						'0%, 100%' => array( 'transform' => 'translateY(0)' ),
						'50%'      => array( 'transform' => 'translateY(-10px)' ),
					),
				),
			),
			'slide-down'     => array(
				'overlay_styles'       => array(
					'transform'  => 'translateY(-100%)',
					'transition' => 'transform 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'transform' => 'translateY(0)',
				),
			),
			'opacity'        => array(
				'hover_image_styles'   => array(
					'opacity' => '0.7',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'blur'           => array(
				'hover_image_styles'   => array(
					'filter' => 'blur(2px)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'slide-diagonal' => array(
				'overlay_styles'       => array(
					'transform'  => 'translate(-20px, 20px)',
					'transition' => 'transform 0.3s ease, opacity 0.3s ease',
					'opacity'    => '0',
				),
				'hover_overlay_styles' => array(
					'transform' => 'translate(0, 0)',
					'opacity'   => '1',
				),
			),
			'pulse'          => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-pulse 1s ease infinite',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-pulse' => array(
						'0%, 100%' => array( 'transform' => 'scale(1)' ),
						'50%'      => array( 'transform' => 'scale(1.05)' ),
					),
				),
			),
			// Pro effects
			'zoom'           => array(
				'hover_image_styles'   => array(
					'transform' => 'scale(1.1)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transform'  => 'scale(0.8)',
					'transition' => 'all 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity'   => '1',
					'transform' => 'scale(1)',
				),
			),
			'flip'           => array(
				'item_styles'        => array(
					'perspective' => '1000px',
				),
				'inner_styles'       => array(
					'transform-style' => 'preserve-3d',
					'transition'      => 'transform 0.6s',
				),
				'hover_inner_styles' => array(
					'transform' => 'rotateY(180deg)',
				),
			),
			'3d'             => array(
				'item_styles'          => array(
					'perspective' => '1000px',
				),
				'hover_styles'         => array(
					'transform' => 'perspective(1000px) rotateX(5deg) rotateY(5deg)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transform'  => 'perspective(1000px) rotateX(-90deg)',
					'transition' => 'all 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity'   => '1',
					'transform' => 'perspective(1000px) rotateX(0deg)',
				),
			),
			'gradient'       => array(
				'pseudo_before'        => array(
					'position'   => 'absolute',
					'top'        => '0',
					'left'       => '0',
					'right'      => '0',
					'bottom'     => '0',
					'background' => 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.3) 100%)',
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
					'z-index'    => '1',
				),
				'hover_pseudo_before'  => array(
					'opacity' => '1',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
					'z-index'    => '2',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'shine'          => array(
				'item_styles'          => array(
					'position' => 'relative',
					'overflow' => 'hidden',
				),
				'pseudo_after'         => array(
					'position'   => 'absolute',
					'top'        => '-50%',
					'left'       => '-50%',
					'width'      => '200%',
					'height'     => '200%',
					'background' => 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.5) 50%, transparent 70%)',
					'transform'  => 'translateX(-100%) translateY(-100%) rotate(45deg)',
					'transition' => 'transform 0.6s',
					'z-index'    => '2',
				),
				'hover_pseudo_after'   => array(
					'transform' => 'translateX(100%) translateY(100%) rotate(45deg)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
					'z-index'    => '3',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'morph'          => array(
				'item_styles'          => array(
					'border-radius' => '50% 50% 50% 50% / 60% 60% 40% 40%',
					'transition'    => 'border-radius 0.3s ease',
				),
				'hover_styles'         => array(
					'border-radius' => '30% 70% 70% 30% / 30% 30% 70% 70%',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'glitch'         => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-glitch 0.3s ease infinite',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-glitch' => array(
						'0%, 100%' => array( 'transform' => 'translate(0)' ),
						'20%'      => array( 'transform' => 'translate(-2px, 2px)' ),
						'40%'      => array( 'transform' => 'translate(-2px, -2px)' ),
						'60%'      => array( 'transform' => 'translate(2px, 2px)' ),
						'80%'      => array( 'transform' => 'translate(2px, -2px)' ),
					),
				),
			),
			'ripple'         => array(
				'item_styles'          => array(
					'position' => 'relative',
					'overflow' => 'hidden',
				),
				'pseudo_before'        => array(
					'position'      => 'absolute',
					'top'           => '50%',
					'left'          => '50%',
					'width'         => '0',
					'height'        => '0',
					'border-radius' => '50%',
					'background'    => 'rgba(255, 255, 255, 0.2)',
					'transform'     => 'translate(-50%, -50%)',
					'transition'    => 'width 0.6s, height 0.6s',
					'z-index'       => '1',
				),
				'hover_pseudo_before'  => array(
					'width'  => '300px',
					'height' => '300px',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
					'z-index'    => '2',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'shadow'         => array(
				'item_styles'          => array(
					'box-shadow' => '0 2px 4px rgba(0, 0, 0, 0.1)',
					'transition' => 'box-shadow 0.3s ease',
				),
				'hover_styles'         => array(
					'box-shadow' => '0 8px 24px rgba(0, 115, 170, 0.3)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'border'         => array(
				'item_styles'          => array(
					'border'     => '2px solid transparent',
					'transition' => 'border-color 0.3s ease',
				),
				'pseudo_before'        => array(
					'position'      => 'absolute',
					'top'           => '0',
					'left'          => '0',
					'right'         => '0',
					'bottom'        => '0',
					'border'        => '2px solid var(--fg-blue)',
					'border-radius' => 'inherit',
					'opacity'       => '0',
					'transition'    => 'opacity 0.3s ease',
					'animation'     => 'fotogrids-border-pulse 1s ease infinite',
				),
				'hover_pseudo_before'  => array(
					'opacity' => '1',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-border-pulse' => array(
						'0%, 100%' => array(
							'transform' => 'scale(1)',
							'opacity'   => '1',
						),
						'50%'      => array(
							'transform' => 'scale(1.02)',
							'opacity'   => '0.8',
						),
					),
				),
			),
			'glow'           => array(
				'item_styles'          => array(
					'transition' => 'box-shadow 0.3s ease',
				),
				'hover_styles'         => array(
					'box-shadow' => '0 0 20px rgba(0, 115, 170, 0.5)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'split'          => array(
				'hover_image_styles'   => array(
					'clip-path' => 'inset(0 0 100% 0)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'clip-path'  => 'inset(0 100% 0 0)',
					'transition' => 'all 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity'   => '1',
					'clip-path' => 'inset(0 0 0 0)',
				),
			),
			'reveal'         => array(
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transform'  => 'scale(0)',
					'transition' => 'all 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity'   => '1',
					'transform' => 'scale(1)',
				),
			),
			'slide-rotate'   => array(
				'item_styles'          => array(
					'transition' => 'transform 0.3s ease',
				),
				'hover_styles'         => array(
					'transform' => 'rotate(2deg)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transform'  => 'translateX(-20px) rotate(-5deg)',
					'transition' => 'all 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity'   => '1',
					'transform' => 'translateX(0) rotate(0deg)',
				),
			),
			'elastic'        => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-elastic 0.6s ease',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-elastic' => array(
						'0%'   => array( 'transform' => 'scale(1)' ),
						'50%'  => array( 'transform' => 'scale(1.2)' ),
						'70%'  => array( 'transform' => 'scale(0.9)' ),
						'100%' => array( 'transform' => 'scale(1)' ),
					),
				),
			),
			'wobble'         => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-wobble 0.5s ease',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-wobble' => array(
						'0%, 100%' => array( 'transform' => 'rotate(0deg)' ),
						'25%'      => array( 'transform' => 'rotate(-3deg)' ),
						'75%'      => array( 'transform' => 'rotate(3deg)' ),
					),
				),
			),
			'shake'          => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-shake 0.5s ease',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-shake' => array(
						'0%, 100%' => array( 'transform' => 'translateX(0)' ),
						'25%'      => array( 'transform' => 'translateX(-5px)' ),
						'75%'      => array( 'transform' => 'translateX(5px)' ),
					),
				),
			),
			'spin'           => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-spin 0.6s ease',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-spin' => array(
						'from' => array( 'transform' => 'rotate(0deg)' ),
						'to'   => array( 'transform' => 'rotate(360deg)' ),
					),
				),
			),
			'flash'          => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-flash 0.5s ease',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-flash' => array(
						'0%, 100%' => array( 'opacity' => '1' ),
						'50%'      => array( 'opacity' => '0.3' ),
					),
				),
			),
			'wave'           => array(
				'hover_styles'         => array(
					'animation' => 'fotogrids-wave 0.6s ease',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
				'animations'           => array(
					'fotogrids-wave' => array(
						'0%, 100%' => array(
							'transform' => 'translateY(0) rotate(0deg)',
						),
						'25%'      => array(
							'transform' => 'translateY(-5px) rotate(2deg)',
						),
						'75%'      => array(
							'transform' => 'translateY(5px) rotate(-2deg)',
						),
					),
				),
			),
			'spiral'         => array(
				'item_styles'          => array(
					'transition' => 'transform 0.3s ease',
				),
				'hover_styles'         => array(
					'transform' => 'rotate(180deg) scale(0.8)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transform'  => 'rotate(-180deg) scale(0)',
					'transition' => 'all 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity'   => '1',
					'transform' => 'rotate(0deg) scale(1)',
				),
			),
			'matrix'         => array(
				'hover_styles'         => array(
					'text-shadow' => '0 0 10px var(--fg-blue), 0 0 20px var(--fg-blue)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'neon'           => array(
				'hover_styles'         => array(
					'box-shadow' => '0 0 5px var(--fg-blue), 0 0 10px var(--fg-blue), 0 0 15px var(--fg-blue), 0 0 20px var(--fg-blue)',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
			'hologram'       => array(
				'item_styles'          => array(
					'position' => 'relative',
				),
				'pseudo_before'        => array(
					'position'   => 'absolute',
					'top'        => '0',
					'left'       => '-100%',
					'width'      => '100%',
					'height'     => '100%',
					'background' => 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
					'transition' => 'left 0.5s',
					'z-index'    => '1',
				),
				'hover_pseudo_before'  => array(
					'left' => '100%',
				),
				'overlay_styles'       => array(
					'opacity'    => '0',
					'transition' => 'opacity 0.3s ease',
					'z-index'    => '2',
				),
				'hover_overlay_styles' => array(
					'opacity' => '1',
				),
			),
		);
	}
}
