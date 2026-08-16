<?php
/**
 * Admin-screen filter hooks.
 *
 * @package FotoGrids\Hooks
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Hooks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin filter hooks.
 */
final class Filters_Admin {

	/**
	 * The screen-hook strings recognised as FotoGrids admin pages.
	 *
	 * Extensions hook here to register their own pages under the FotoGrids
	 * menu so the shared admin assets load on them.
	 *
	 * @since 1.0.0
	 * @param string[] $page_hooks Screen-hook allowlist.
	 */
	public const PAGE_HOOKS = 'fotogrids/admin/page_hooks';
}
