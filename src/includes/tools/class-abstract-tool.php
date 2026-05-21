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
	 * 'fotogrids_regen_thumbnails'. The Permissions Manager will
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
	 * Returns null — no script by default. Override to point at the
	 * tool's compiled JS file (typically FOTOGRIDS_PLUGIN_URL .
	 * 'includes/tools/{id}/assets/{id}.js' for built-in Free tools).
	 */
	public function get_script_url(): ?string {
		return null;
	}

	/**
	 * {@inheritdoc}
	 *
	 * Returns null — no stylesheet by default. Override only when the
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

		// Only when this tool is the active one — avoids loading every
		// tool's assets on every Tools page visit.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ( $_GET['tool'] ?? '' ) !== $this->get_id() ) {
			return;
		}

		$version    = defined( 'FOTOGRIDS_VERSION' ) ? FOTOGRIDS_VERSION : '1.0.0';
		$script_url = $this->get_script_url();
		$style_url  = $this->get_style_url();

		if ( $script_url ) {
			wp_enqueue_script(
				'fotogrids-tool-' . $this->get_id(),
				$script_url,
				[ 'wp-element', 'wp-i18n', 'wp-api-fetch', 'fotogrids-admin' ],
				$version,
				true // Load in footer — fotogrids-admin and the DOM are ready.
			);
		}

		if ( $style_url ) {
			wp_enqueue_style(
				'fotogrids-tool-' . $this->get_id(),
				$style_url,
				[ 'fotogrids-admin' ],
				$version
			);
		}
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
	 * on admin_enqueue_scripts — do not add_action here.
	 */
	public function init(): void {
		// No-op. Override in concrete tools to register REST routes.
	}
}
