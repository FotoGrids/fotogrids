<?php
declare(strict_types=1);

namespace FotoGrids\Render\Formatted_Text;

use FotoGrids\Formatted_Text\Formatted_Text;
use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Sanitization\Attribute_Value;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Shared pieces for modules that format captions and descriptions in the
 * browser: the per-gallery configuration attribute and the formatter assets.
 *
 * The browser formatter registers itself as FotoGrids.modules.formattedText.
 *
 * @package FotoGrids\Render\Formatted_Text
 * @since   1.3.0
 */
final class Formatted_Text_Client {

	const HANDLE = 'fotogrids-formatted-text';

	/**
	 * Attribute name that carries the configuration for a surface.
	 *
	 * @since 1.3.0
	 * @param string $surface Surface name, e.g. 'lightbox_mini'.
	 * @return string
	 */
	public static function attribute_name( string $surface ): string {
		return 'data-fg-text-' . str_replace( '_', '-', sanitize_key( $surface ) );
	}

	/**
	 * Wrapper attribute with the formatting configuration for a surface.
	 *
	 * @since 1.3.0
	 * @param string         $surface        Surface name.
	 * @param Render_Context $render_context Render context.
	 * @return array<string, string>
	 */
	public static function wrapper_attrs( string $surface, Render_Context $render_context ): array {
		return array(
			self::attribute_name( $surface ) => Attribute_Value::json(
				Formatted_Text::client_config( $surface, $render_context->meta->gallery_id )
			),
		);
	}

	/**
	 * Stylesheet declaration for the formatter.
	 *
	 * @since 1.3.0
	 * @return array<string, Asset_Decl>
	 */
	public static function css(): array {
		return array(
			self::HANDLE => new Asset_Decl( 'formatted-text/formatted-text.css' ),
		);
	}

	/**
	 * Script declaration for the formatter. Consumers list self::HANDLE as a
	 * dependency of their own script.
	 *
	 * @since 1.3.0
	 * @return array<string, Asset_Decl>
	 */
	public static function js(): array {
		return array(
			self::HANDLE => new Asset_Decl(
				'../../assets/js/formatted-text.js',
				array( 'fotogrids-runtime' ),
				true,
			),
		);
	}
}
