<?php
/**
 * Hover-effect descriptor value object.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Describes a single hover effect: its identity, what it animates, the layouts
 * it hides on, and the CSS used to render and to preview it.
 *
 * @since 1.0.0
 */
final class Hover_Effect {

	const ANIMATES_MEDIA   = 'media';
	const ANIMATES_FRAME   = 'frame';
	const ANIMATES_CAPTION = 'caption';
	const ANIMATES_BOTH    = 'both';

	const COUPLING_MEDIA = 'media';
	const COUPLING_ITEM  = 'item';
	const COUPLING_NONE  = 'none';

	/**
	 * @var string
	 */
	public $id;

	/**
	 * @var string
	 */
	public $origin;

	/**
	 * @var string
	 */
	public $tier;

	/**
	 * @var string
	 */
	public $label;

	/**
	 * @var string
	 */
	public $animates;

	/**
	 * @var string
	 */
	public $coupling;

	/**
	 * @var bool
	 */
	public $requires_caption;

	/**
	 * @var array<int, string>
	 */
	public $hide_on_layouts;

	/**
	 * @var array<int, string>
	 */
	public $conflicts_css;

	/**
	 * @var bool
	 */
	public $is_teaser;

	/**
	 * @var string|null
	 */
	public $css_path;

	/**
	 * @var string|null
	 */
	public $preview_css_path;

	/**
	 * @var array<string, string>
	 */
	public $style_var_defaults;

	/**
	 * @var string|null
	 */
	public $preview_hint;

	/**
	 * @since 1.0.0
	 * @param array<string, mixed> $args Descriptor arguments.
	 */
	public function __construct( array $args ) {
		$this->id                 = (string) $args['id'];
		$this->origin             = (string) $args['origin'];
		$this->tier               = isset( $args['tier'] ) ? (string) $args['tier'] : 'free';
		$this->label              = isset( $args['label'] ) ? (string) $args['label'] : '';
		$this->animates           = isset( $args['animates'] ) ? (string) $args['animates'] : self::ANIMATES_MEDIA;
		$this->coupling           = isset( $args['coupling'] ) ? (string) $args['coupling'] : self::COUPLING_MEDIA;
		$this->requires_caption   = ! empty( $args['requires_caption'] );
		$this->hide_on_layouts    = isset( $args['hide_on_layouts'] ) ? (array) $args['hide_on_layouts'] : array();
		$this->conflicts_css      = isset( $args['conflicts_css'] ) ? (array) $args['conflicts_css'] : array();
		$this->is_teaser          = ! empty( $args['is_teaser'] );
		$this->css_path           = isset( $args['css_path'] ) ? (string) $args['css_path'] : null;
		$this->preview_css_path   = isset( $args['preview_css_path'] ) ? (string) $args['preview_css_path'] : null;
		$this->style_var_defaults = isset( $args['style_var_defaults'] ) ? (array) $args['style_var_defaults'] : array();
		$this->preview_hint       = isset( $args['preview_hint'] ) ? (string) $args['preview_hint'] : null;
	}

	/**
	 * Whether this descriptor carries the minimum required, valid fields.
	 *
	 * @since  1.0.0
	 * @return bool
	 */
	public function is_valid(): bool {
		if ( '' === $this->id || '' === $this->origin ) {
			return false;
		}

		$valid_animates = array(
			self::ANIMATES_MEDIA,
			self::ANIMATES_FRAME,
			self::ANIMATES_CAPTION,
			self::ANIMATES_BOTH,
		);
		$valid_coupling = array(
			self::COUPLING_MEDIA,
			self::COUPLING_ITEM,
			self::COUPLING_NONE,
		);

		return in_array( $this->animates, $valid_animates, true )
			&& in_array( $this->coupling, $valid_coupling, true );
	}
}
