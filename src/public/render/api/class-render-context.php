<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Immutable render context values for module execution.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Render_Context {

	public Render_Meta $meta;
	public Render_Layout $layout;
	public Render_Behavior $behavior;
	public array $settings;
	public array $items;
	public array $warnings;
	public ?int $via_album_id;

	/**
	 * @param array<string, mixed> $settings Render settings map.
	 * @param array<int, Item_View> $items Collection items.
	 * @param array<int, string> $warnings Preview warnings.
	 * @param int|null $via_album_id Resolved album the visitor reached this gallery from
	 *                               (visit-context). Sourced from the ?fg_via query var on
	 *                               normal page loads or from the via_album_id meta override
	 *                               on REST renders. Validated downstream by Breadcrumb_Resolver
	 *                               (a non-null value here doesn't guarantee the album really
	 *                               contains this gallery).
	 */
	public function __construct(
		Render_Meta $meta,
		Render_Layout $layout,
		Render_Behavior $behavior,
		array $settings,
		array $items,
		array $warnings = array(),
		?int $via_album_id = null
	) {
		$this->meta = $meta;
		$this->layout = $layout;
		$this->behavior = $behavior;
		$this->settings = $settings;
		$this->items = $items;
		$this->warnings = $warnings;
		$this->via_album_id = $via_album_id;
	}

	/**
	 * Returns a cloned context with selected fields replaced.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $changes Replacement values.
	 * @return  self
	 */
	public function with( array $changes ): self {
		$allowed_keys = array( 'items', 'settings', 'warnings', 'via_album_id' );

		foreach ( array_keys( $changes ) as $change_key ) {
			if ( ! in_array( $change_key, $allowed_keys, true ) ) {
				throw new \InvalidArgumentException( sprintf( "Render_Context::with() does not support replacing '%s'", esc_html( $change_key ) ) );
			}
		}

		return new self(
			$this->meta,
			$this->layout,
			$this->behavior,
			$changes['settings'] ?? $this->settings,
			$changes['items'] ?? $this->items,
			$changes['warnings'] ?? $this->warnings,
			array_key_exists( 'via_album_id', $changes ) ? $changes['via_album_id'] : $this->via_album_id,
		);
	}
}
