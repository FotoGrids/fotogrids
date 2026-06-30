<?php
/**
 * Templates-module filter hooks.
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
 * Templates filter hooks.
 */
final class Filters_Templates {

	/**
	 * Component ID of the "Save as Template" metabox button.
	 *
	 * Pro returns its component ID here; Free leaves it null and the shell
	 * renders the upgrade CTA.
	 *
	 * @since 1.0.0
	 * @param string|null $component_id Component ID or null.
	 * @param \WP_Post    $post         Current post.
	 */
	public const SAVE_AS_TEMPLATE_BUTTON = 'fotogrids/templates/save_as_template_button';

	/**
	 * Preview handler descriptor for a template.
	 *
	 * Decides what the Templates-grid Preview button does for a given template.
	 * Free returns 'local' for free templates and a 'web' descriptor (new-tab
	 * link to the public preview page) for Pro templates. Pro hooks this to
	 * return 'local' for everything it can render in-admin.
	 *
	 * @since 1.1.0
	 * @param array $handler  ['mode' => 'local'|'web', 'url' => string].
	 * @param array $template Template data.
	 */
	public const PREVIEW_HANDLER = 'fotogrids/templates/preview_handler';

	/**
	 * Whether a template can be applied on the current site.
	 *
	 * Free returns true for free/user templates and for Pro templates when Pro
	 * is active. Pro or 3rd-party code may hook this to gate by tier or other
	 * licensing rules.
	 *
	 * @since 1.1.0
	 * @param bool  $can_apply Whether the template can be applied.
	 * @param array $template  Template data.
	 */
	public const CAN_APPLY = 'fotogrids/templates/can_apply';
}
