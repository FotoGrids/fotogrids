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

	/**
	 * Per-user preferences the admin may save, keyed by preference name.
	 *
	 * Each entry holds a `validate` callable (string $value): ?string, which
	 * returns the value to store or null to refuse it, and a `save` callable
	 * (int $user_id, string $value): bool.
	 *
	 * @since 1.3.0
	 * @param array<string, array{validate: callable, save: callable}> $handlers Registered preferences.
	 */
	public const USER_PREFERENCES = 'fotogrids/admin/user_preferences';
}
