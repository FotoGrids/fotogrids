<?php
/**
 * View Page (standalone + integrated) action hooks.
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
 * View page action hooks.
 *
 * Standalone view-page template emits HEAD/BEFORE_SHELL/HEADER/BEFORE_GALLERY/
 * AFTER_GALLERY/FOOTER/AFTER_SHELL in order. INTEGRATED_* variants run when
 * the view is embedded into the active theme's singular template.
 */
final class Actions_View {

	/**
	 * Fires inside the `<head>` of the standalone view page.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post The gallery/album post being viewed.
	 */
	public const HEAD = 'fotogrids/view/head';

	/**
	 * Fires before the view page shell opens.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post Post being viewed.
	 */
	public const BEFORE_SHELL = 'fotogrids/view/before_shell';

	/**
	 * Fires after the view page shell closes.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post Post being viewed.
	 */
	public const AFTER_SHELL = 'fotogrids/view/after_shell';

	/**
	 * Fires inside the standalone view page header region.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post Post being viewed.
	 */
	public const HEADER = 'fotogrids/view/header';

	/**
	 * Fires immediately before the gallery is rendered on the view page.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post Post being viewed.
	 */
	public const BEFORE_GALLERY = 'fotogrids/view/before_gallery';

	/**
	 * Fires immediately after the gallery is rendered on the view page.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post Post being viewed.
	 */
	public const AFTER_GALLERY = 'fotogrids/view/after_gallery';

	/**
	 * Fires inside the view page footer region.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $fg_post Post being viewed.
	 */
	public const FOOTER = 'fotogrids/view/footer';

	/**
	 * Fires immediately before the gallery is rendered inside the theme
	 * (Integrated layout mode).
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post Post being viewed.
	 */
	public const INTEGRATED_BEFORE_GALLERY = 'fotogrids/view/integrated/before_gallery';

	/**
	 * Fires immediately after the gallery is rendered inside the theme
	 * (Integrated layout mode).
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post Post being viewed.
	 */
	public const INTEGRATED_AFTER_GALLERY = 'fotogrids/view/integrated/after_gallery';

	/**
	 * Fires after a view page render is tracked in the stats table.
	 *
	 * @since 1.0.0
	 * @param \WP_Post $post Post that was viewed.
	 */
	public const TRACKED = 'fotogrids/view/tracked';
}
