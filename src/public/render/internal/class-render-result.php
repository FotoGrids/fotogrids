<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Value object returned by the render controller.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Render_Result {

	/**
	 * @param array<string, array<int, string>> $active_modules Active module IDs by category.
	 */
	public function __construct(
		public readonly string $html,
		public readonly string $instance_id,
		public readonly array $active_modules,
		public readonly int $http_status,
	) {}

	/**
	 * Returns a cloned render result with replacement HTML.
	 *
	 * @since   1.0.0
	 * @param   string $html Replacement HTML.
	 * @return  self
	 */
	public function with_html( string $html ): self {
		return new self(
			$html,
			$this->instance_id,
			$this->active_modules,
			$this->http_status,
		);
	}

	/**
	 * Builds an error result for graceful render failures.
	 *
	 * @since   1.0.0
	 * @param   string $message Error message.
	 * @param   int    $gallery_id Gallery identifier.
	 * @param   string $instance_id Instance identifier.
	 * @param   bool   $show_inline_error Whether to render visible error HTML.
	 * @param   int    $http_status HTTP status code.
	 * @return  self
	 */
	public static function error(
		string $message,
		int $gallery_id = 0,
		string $instance_id = '',
		bool $show_inline_error = false,
		int $http_status = 500
	): self {
		$error_context = sprintf(
			'gallery_id=%d instance_id=%s message=%s',
			$gallery_id,
			'' !== $instance_id ? $instance_id : 'n/a',
			$message
		);
		\FotoGrids\Debug_Log::write( 'render', $error_context );

		$html = '<div class="fotogrids-error" hidden></div>';
		if ( $show_inline_error ) {
			$html = '<div class="fotogrids-error">FotoGrids: ' . esc_html( $message ) . '</div>';
		}

		return new self(
			$html,
			$instance_id,
			array(),
			$http_status,
		);
	}
}
