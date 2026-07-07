<?php
declare(strict_types=1);

namespace FotoGrids\Render\Gates\Collection_Permissions;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Gate;
use FotoGrids\Render\Api\Gate_Card;
use FotoGrids\Render\Api\Gate_Renderer;
use FotoGrids\Render\Api\Gate_Result;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Setting_Helpers;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Collection view permissions.
 *
 * Blocks guest visitors when the gallery's "who can view" policy is set to
 * registered users only. Returns a ghost-grid placeholder with a login CTA
 * overlay via Gate_Renderer.
 *
 * @package FotoGrids\Render\Gates\Collection_Permissions
 * @since   1.0.0
 */
final class Collection_Permissions implements Gate {

	use Setting_Helpers;

	public function id(): string {
		return 'fotogrids/collection-permissions';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function extends_id(): ?string {
		return null;
	}

	/**
	 * Returns true when Free should enforce a view policy.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function supports( Render_Context $render_context ): bool {
		if ( $render_context->meta->is_preview ) {
			return false;
		}

		return $this->view_policy( $render_context ) === 'registered_users';
	}

	/**
	 * Blocks guests when the policy requires registration.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  Gate_Result
	 */
	public function evaluate( Render_Context $render_context ): Gate_Result {
		if ( is_user_logged_in() ) {
			return Gate_Result::pass();
		}

		return Gate_Result::block(
			$this->render_guest_only_screen( $render_context ),
			200,
			Gate_Renderer::build_css( $render_context )
		);
	}

	/**
	 * CSS assets: shared gate chrome + permissions-specific login-link styles.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array_merge(
				Gate_Renderer::shared_asset_decl(),
				array(
					'fotogrids-collection-permissions' => new Asset_Decl(
						'gates/collection-permissions/collection-permissions.css'
					),
				)
			)
		);
	}

	/**
	 * Resolves the current view policy from settings.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	private function view_policy( Render_Context $render_context ): string {
		return $this->setting_scalar( $render_context->settings['who_can_view'] ?? null, 'all' );
	}

	/**
	 * Builds a guest-only ghost-grid placeholder with a login CTA via Gate_Renderer.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	private function render_guest_only_screen( Render_Context $render_context ): string {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '/';
		$login_url   = wp_login_url( home_url( $request_uri ) );

		/* translators: heading shown when gallery requires login */
		$title = esc_html__( 'Login Required', 'fotogrids' );
		/* translators: message shown when gallery is visible to registered users only */
		$description = esc_html__( 'This gallery is available to registered users only. Please log in to continue.', 'fotogrids' );
		/* translators: button label for login action when gallery access is restricted */
		$cta_label = esc_html__( 'Log In', 'fotogrids' );

		$body_html = sprintf(
			'<p class="fg-permissions-actions">'
			. '<a class="fg-permissions-login-link" href="%1$s">%2$s</a>'
			. '</p>',
			esc_url( $login_url ),
			$cta_label
		);

		$card = new Gate_Card(
			$title,
			$description,
			$body_html,
			$title,
			'',
			'',
			array( 'data-fg-restricted' => 'registered-users' ),
		);

		return Gate_Renderer::render( $render_context, $card );
	}
}
