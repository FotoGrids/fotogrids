<?php
namespace FotoGrids\Tools;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Tool Interface
 *
 * Every FotoGrids tool — built-in, Pro, or third-party — must implement
 * this interface. Tools are user-visible admin features with their own UI,
 * REST endpoints, and capability gates.
 *
 * Source (fotogrids / fotogrids-pro / third-party) is determined by the
 * registry from the tool's PHP namespace — the tool itself does not declare it.
 *
 * @since 1.0.0
 */
interface Tool_Interface {

	/**
	 * Unique tool identifier. Used as the URL slug (?tool=<id>)
	 * and as the REST route segment (/admin/tools/<id>/*).
	 *
	 * @return string e.g. 'regen-thumbnails'
	 */
	public function get_id(): string;

	/**
	 * Human-readable label shown in the sidebar nav and card grid.
	 *
	 * @return string e.g. 'Regenerate Thumbnails'
	 */
	public function get_label(): string;

	/**
	 * Short description shown on the tool card in the grid view.
	 *
	 * @return string
	 */
	public function get_description(): string;

	/**
	 * Icon identifier — dashicon slug (without 'dashicons-' prefix)
	 * or a FotoGrids icon id.
	 *
	 * @return string e.g. 'update'
	 */
	public function get_icon(): string;

	/**
	 * Optional illustration URL for the card grid.
	 * Return null to show only the icon.
	 *
	 * @return string|null
	 */
	public function get_image(): ?string;

	/**
	 * Logical grouping for future sidebar section headers.
	 * Use 'maintenance', 'data', 'general', or a custom slug.
	 *
	 * @return string
	 */
	public function get_group(): string;

	/**
	 * Minimum tier required to use this tool.
	 * Must be one of: 'free', 'pro_starter', 'pro_plus', 'agency'.
	 *
	 * The manifest endpoint resolves this to an access_state
	 * ('editable' / 'teaser' / 'locked') for the current user.
	 *
	 * @return string
	 */
	public function get_tier_required(): string;

	/**
	 * WordPress capability required to access this tool.
	 *
	 * Default is 'manage_fotogrids'. Override to declare a custom
	 * capability (e.g. 'fotogrids_regen_thumbnails') so the
	 * Permissions Manager can expose per-tool access control.
	 *
	 * @return string
	 */
	public function get_capability(): string;

	/**
	 * React component id the JS side should render for this tool.
	 * Defaults to get_id() — only override when the component name
	 * must differ from the tool id.
	 *
	 * @return string
	 */
	public function get_js_component(): string;

	/**
	 * Whether the tool is ready to be used.
	 *
	 * Return false for tools that are registered (so they appear in
	 * the grid) but not yet implemented (coming-soon state).
	 *
	 * @return bool
	 */
	public function is_available(): bool;

	/**
	 * Absolute URL to the tool's compiled JavaScript file.
	 *
	 * Return null (the default) if the tool ships no script — for example,
	 * a coming-soon stub that has no interactive UI yet.
	 *
	 * The infrastructure enqueues this URL on admin_enqueue_scripts,
	 * scoped to the Tools page when this tool is the active tool.
	 * The script is loaded in the footer, after fotogrids-admin, so
	 * window.FotoGridsToolsComponents is already available.
	 *
	 * Built-in Free tools point at FOTOGRIDS_PLUGIN_URL . 'includes/tools/{id}/assets/{id}.js'.
	 * Pro and third-party tools point at their own plugin's URL.
	 *
	 * @return string|null
	 */
	public function get_script_url(): ?string;

	/**
	 * Absolute URL to the tool's compiled CSS file.
	 *
	 * Return null (the default) if the tool needs no stylesheet beyond
	 * the shared admin styles already loaded by fotogrids-admin.
	 *
	 * @return string|null
	 */
	public function get_style_url(): ?string;

	/**
	 * Enqueue the tool's script and stylesheet.
	 *
	 * Called on admin_enqueue_scripts. The default implementation in
	 * Abstract_Tool guards to the Tools page and the active tool only,
	 * then enqueues whatever get_script_url() / get_style_url() return.
	 *
	 * Override only if you need non-standard enqueue behaviour (e.g.
	 * additional inline data via wp_localize_script).
	 *
	 * @param string $hook The current admin page hook suffix.
	 */
	public function enqueue_assets( string $hook ): void;

	/**
	 * Permission callback for the tool's REST routes.
	 *
	 * Returns true when the current user holds the tool's custom capability
	 * OR the global manage_fotogrids capability (fallback until the
	 * Permissions Manager has assigned per-tool capabilities to roles).
	 *
	 * Pass [ $this, 'check_permission' ] as the permission_callback on
	 * every register_rest_route() call inside init().
	 *
	 * @return bool
	 */
	public function check_permission(): bool;

	/**
	 * Register REST routes, hooks, and any other WordPress integrations.
	 * Called once when the tool is loaded by the registry.
	 */
	public function init(): void;
}
