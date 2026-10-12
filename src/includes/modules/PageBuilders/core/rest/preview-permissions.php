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
 * Permission gates for `/preview/*` and `/picker/items`.
 *
 * Previews require `manage_fotogrids`: the safe-preview pipeline bypasses
 * password gates. The picker listing is open to users who can edit posts.
 *
 * @since 1.0.0
 */
final class Preview_Permissions {

	/**
	 * Whether the current user can request a gallery / album preview.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function check_preview_read(): bool {
		return current_user_can( 'manage_fotogrids' );
	}

	/**
	 * Whether the current user can list galleries and albums in the picker.
	 *
	 * @since 1.3.0
	 * @return bool
	 */
	public static function check_picker_read(): bool {
		return current_user_can( 'edit_posts' );
	}
}
