<?php
/**
 * Permission callbacks for the Page Builders preview REST endpoints.
 *
 * @package FotoGrids\Modules\PageBuilders\REST
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\REST;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Permission gates for `/preview/*`, `/picker/items` and `/import/core-gallery`.
 *
 * @since 1.0.0
 */
final class Preview_Permissions {

	/**
	 * Whether the current user can list galleries and albums in the picker
	 * and preview them. Each collection is checked again by the handler.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function check_preview_read(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Whether the current user can turn a core gallery into a FotoGrids gallery.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public static function check_import(): bool {
		return current_user_can( 'manage_fotogrids' );
	}
}
