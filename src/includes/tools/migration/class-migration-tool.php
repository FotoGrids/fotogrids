<?php
namespace FotoGrids\Tools\Migration;

use FotoGrids\Tools\Abstract_Tool;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Migration Tool
 *
 * Brings galleries created in other WordPress gallery plugins (Envira,
 * Modula, NextGEN, and WordPress core [gallery] / block galleries) into
 * FotoGrids.
 *
 * SCAFFOLD STATE: this first pass registers the tool and ships the admin
 * UI chrome only - a source-plugin picker with no functional import behind
 * it. No REST routes are registered yet; init() is intentionally a no-op.
 * See Plugin/docs/migration-tool-plan.md for the full design.
 *
 * REST routes (planned, NOT yet registered):
 *   GET  /fotogrids/v1/admin/tools/migration/sources
 *   GET  /fotogrids/v1/admin/tools/migration/scan
 *   POST /fotogrids/v1/admin/tools/migration/import
 *   GET  /fotogrids/v1/admin/tools/migration/log
 *
 * @since 1.0.0
 */
class Migration_Tool extends Abstract_Tool {

	public function get_id(): string {
		return 'migration';
	}

	public function get_label(): string {
		return __( 'Migrate from other plugins', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Import existing galleries from other plugins or WordPress core into FotoGrids, without rebuilding them manually.', 'fotogrids' );
	}

	public function get_icon(): string {
		return 'import';
	}

	public function get_image_bg_color(): ?string {
		return 'var(--fg-interactive-selected-bg-darker)';
	}

	/**
	 * Grouped with Import / Export - both are data-movement tools.
	 */
	public function get_group(): string {
		return 'data';
	}

	/**
	 * Custom capability so the Permissions Manager can expose per-tool
	 * access control independently of the global manage_fotogrids gate.
	 * Harvested automatically from the registry - no activator wiring needed.
	 */
	public function get_capability(): string {
		return 'fotogrids_migration';
	}

	/**
	 * Available = true so the tool renders its own React component (the
	 * source picker) rather than the registry's generic "coming soon"
	 * screen. The component itself communicates that import is not yet
	 * functional. Flip the per-source actions on as each reader lands.
	 */
	public function is_available(): bool {
		return true;
	}

	/**
	 * Absolute URL to the compiled tool script.
	 * Webpack entry: 'tool-migration'
	 * Output: dist/includes/tools/migration/assets/migration.js
	 */
	public function get_script_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/migration/assets/migration.js';
	}

	/**
	 * Absolute URL to the compiled tool stylesheet.
	 * Output: dist/includes/tools/migration/assets/migration.css
	 */
	public function get_style_url(): ?string {
		return FOTOGRIDS_PLUGIN_URL . 'includes/tools/migration/assets/migration.css';
	}

	/**
	 * No-op for now. REST routes will be registered here once the
	 * sources/ readers and the import writer are implemented. See the
	 * planned route list in this class's docblock.
	 */
	public function init(): void {
		// Intentionally empty - scaffold stage, no REST routes yet.
	}

}
