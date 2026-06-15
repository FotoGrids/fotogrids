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
 * All Page Builders endpoints are admin-only: the safe-preview pipeline
 * intentionally bypasses password gates, which would be a privacy hole if
 * exposed to unauthenticated callers. The capability check is
 * `manage_fotogrids` - the same capability that controls the gallery editor.
 *
 * @since 1.0.0
 */
final class Preview_Permissions {

	/**
	 * Whether the current user can request a gallery / album preview or
	 * search the picker.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function check_preview_read(): bool {
		return current_user_can( 'manage_fotogrids' );
	}
}
