<?php
namespace FotoGrids\Tools;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Abstract Tool
 *
 * Provides sensible defaults for Tool_Interface so concrete tools only
 * need to implement the fields that differ: get_id(), get_label(),
 * get_description(), get_icon(), and whatever else they customise.
 *
 * @since 1.0.0
 */
abstract class Abstract_Tool implements Tool_Interface {

	/**
	 * {@inheritdoc}
	 */
	public function get_image(): ?string {
		return null;
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_image_bg_color(): ?string {
		return null;
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_group(): string {
		return 'general';
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_tier_required(): string {
		return 'free';
	}

	/**
	 * {@inheritdoc}
	 *
	 * Override in your tool to declare a custom capability, e.g.
	 * 'fotogrids_regenerate_thumbnails'. The Permissions Manager will
	 * discover this capability via the registry.
	 */
	public function get_capability(): string {
		return 'manage_fotogrids';
	}

	/**
	 * {@inheritdoc}
	 */
	public function get_js_component(): string {
		return $this->get_id();
	}

	/**
	 * {@inheritdoc}
	 */
	public function is_available(): bool {
		return true;
	}

	/**
	 * {@inheritdoc}
	 *
	 * Returns null - no script by default. Override to point at the
	 * tool's compiled JS file (typically FOTOGRIDS_PLUGIN_URL .
	 * 'includes/tools/{id}/assets/{id}.js' for built-in Free tools).
	 */
	public function get_script_url(): ?string {
		return null;
	}

	/**
	 * {@inheritdoc}
	 *
	 * Returns null - no stylesheet by default. Override only when the
	 * tool needs styles beyond what fotogrids-admin already provides.
	 */
	public function get_style_url(): ?string {
		return null;
	}

	/**
	 * {@inheritdoc}
	 *
	 * Enqueues the script and stylesheet returned by get_script_url() and
	 * get_style_url(), scoped to the Tools page when this tool is active.
	 *
	 * The script handle is 'fotogrids-tool-{id}', with fotogrids-admin as
	 * a dependency so window.FotoGridsToolsComponents is ready when the
	 * tool script runs. The tool's entry point just calls:
	 *   FotoGridsToolsComponents.register('{id}', MyComponent);
	 */
	public function enqueue_assets( string $hook ): void {
		// Only on the FotoGrids Tools admin page.
		if ( ! str_contains( $hook, 'fotogrids-tools' ) ) {
			return;
		}

		$script_url = $this->get_script_url();
		$style_url  = $this->get_style_url();

		// Scripts are always enqueued on the Tools page - any tool can be
		// navigated to via SPA without a page reload, so the component must
		// be registered before ToolsPage first renders.
		if ( $script_url ) {
			wp_enqueue_script(
				'fotogrids-tool-' . $this->get_id(),
				$script_url,
				array( 'wp-element', 'wp-i18n', 'wp-api-fetch', 'fotogrids-admin' ),
				self::asset_version( $script_url ),
				true // Load in footer - fotogrids-admin and the DOM are ready.
			);
		}

		// Styles are also always enqueued on the Tools page for the same
		// reason as scripts - SPA navigation means any tool can become
		// active without a page reload.
		if ( $style_url ) {
			wp_enqueue_style(
				'fotogrids-tool-' . $this->get_id(),
				$style_url,
				array( 'fotogrids-admin' ),
				self::asset_version( $style_url )
			);
		}
	}

	/**
	 * Cache-busting version for a tool asset.
	 *
	 * FOTOGRIDS_VERSION does not change between builds during development, so a
	 * rebuilt asset would keep being served from the browser cache. When the URL
	 * resolves to a file inside this plugin, its modification time is used
	 * instead; anything else falls back to the plugin version.
	 *
	 * @since  1.0.0
	 * @param  string $url Absolute asset URL.
	 * @return string
	 */
	protected static function asset_version( string $url ): string {
		$fallback = defined( 'FOTOGRIDS_VERSION' ) ? FOTOGRIDS_VERSION : '1.0.0';

		if ( ! defined( 'FOTOGRIDS_PLUGIN_URL' ) || ! defined( 'FOTOGRIDS_PLUGIN_DIR' ) ) {
			return $fallback;
		}

		if ( ! str_starts_with( $url, FOTOGRIDS_PLUGIN_URL ) ) {
			return $fallback;
		}

		$path = FOTOGRIDS_PLUGIN_DIR . substr( $url, strlen( FOTOGRIDS_PLUGIN_URL ) );

		if ( ! file_exists( $path ) ) {
			return $fallback;
		}

		return (string) filemtime( $path );
	}

	/**
	 * {@inheritdoc}
	 *
	 * Falls back to manage_fotogrids until the Permissions Manager has
	 * had a chance to assign the custom capability to roles.
	 */
	public function check_permission(): bool {
		return current_user_can( $this->get_capability() )
			|| current_user_can( 'manage_fotogrids' );
	}

	/**
	 * {@inheritdoc}
	 *
	 * No-op by default. Override to register REST routes and hooks.
	 * Asset enqueueing is handled centrally by Tools_Registry::enqueue_all()
	 * on admin_enqueue_scripts - do not add_action here.
	 */
	public function init(): void {
		// No-op. Override in concrete tools to register REST routes.
	}
}
