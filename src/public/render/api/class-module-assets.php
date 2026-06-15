<?php
declare(strict_types=1);

namespace FotoGrids\Render\Api;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Module asset declaration container.
 *
 * @package FotoGrids\Render\Api
 * @since   1.0.0
 */
final class Module_Assets {

	public array $css;
	public array $js;

	/**
	 * @param array<string, Asset_Decl> $css CSS asset declarations.
	 * @param array<string, Asset_Decl> $js JS asset declarations.
	 */
	public function __construct(
		array $css = array(),
		array $js = array()
	) {
		$this->css = $css;
		$this->js  = $js;
	}
}
