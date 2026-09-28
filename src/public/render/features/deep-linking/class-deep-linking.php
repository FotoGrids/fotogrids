<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Deep_Linking;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Settings\Sharing_Settings_Store;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Deep Linking feature module.
 *
 * Ships deep-linking.js, which opens the item named by a
 * `#fg-{galleryId}-{itemId}` URL and keeps the URL in sync with the open
 * Lightbox. Gated on the site-level `deep_linking_enabled` setting only.
 *
 * @package FotoGrids\Render\Features\Deep_Linking
 * @since   1.1.4
 */
final class Deep_Linking implements Feature {

	public function id(): string {
		return 'fotogrids/deep-linking';
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

	/**
	 * Active on gallery renders when deep linking is enabled. Album renders
	 * and admin previews are excluded.
	 *
	 * @since 1.1.4
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( $render_context->meta->is_preview ) {
			return false;
		}
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return false;
		}
		$settings = Sharing_Settings_Store::get();
		return ! empty( $settings['deep_linking_enabled'] );
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * Deep-linking client JS.
	 *
	 * @since 1.1.4
	 * @param Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(),
			array(
				'fotogrids-deep-linking' => new Asset_Decl(
					'../../assets/js/deep-linking.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}
}
