<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Gate evaluation result value object.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Gate_Result {

	public bool $passed;
	public string $blocked_html;
	public int $http_status;
	public string $inline_css;

	/**
	 * @since   1.0.0
	 * @param   bool   $passed Whether gate passed.
	 * @param   string $blocked_html Blocked response markup.
	 * @param   int    $http_status Response status.
	 * @param   string $inline_css Per-render CSS for the blocked screen (no <style> tags).
	 * @return  void
	 */
	private function __construct(
		bool $passed,
		string $blocked_html,
		int $http_status,
		string $inline_css = ''
	) {
		$this->passed       = $passed;
		$this->blocked_html = $blocked_html;
		$this->http_status  = $http_status;
		$this->inline_css   = $inline_css;
	}

	/**
	 * Returns a passing gate result.
	 *
	 * @since   1.0.0
	 * @return  self
	 */
	public static function pass(): self {
		return new self( true, '', 200 );
	}

	/**
	 * Returns a blocked gate result.
	 *
	 * @since   1.0.0
	 * @param   string $html Block HTML (pure markup, no <style> tags).
	 * @param   int    $http_status HTTP status code.
	 * @param   string $inline_css Per-render CSS for the blocked screen (no <style> tags).
	 * @return  self
	 */
	public static function block( string $html, int $http_status = 200, string $inline_css = '' ): self {
		return new self( false, $html, $http_status, $inline_css );
	}
}
