<?php
declare(strict_types=1);

namespace FotoGrids\Render\Gates\Password;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Gate;
use FotoGrids\Render\Api\Gate_Card;
use FotoGrids\Render\Api\Gate_Renderer;
use FotoGrids\Render\Api\Gate_Result;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\REST\Gallery\Gallery_Data;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Password Gate
 *
 * Intercepts the render pipeline when a gallery is password-protected and the
 * visitor has not yet unlocked it. Returns a ghost-grid placeholder with a
 * centred password form overlay instead of the real gallery HTML.
 *
 * Rendering is delegated to Gate_Renderer, which owns the shared ghost-grid /
 * overlay / card-chrome template. This gate supplies the password form as the
 * Gate_Card body, plus its own CSS for form-specific styles.
 *
 * Unlock cookie
 * -------------
 * A successful unlock via POST /gallery/{id}/unlock sets an httpOnly cookie
 * named fotogrids_unlocked_{gallery_id}. This gate checks that cookie on every
 * render; if it is present and its HMAC matches the stored ciphertext, the gate
 * passes without any extra DB query.
 *
 * Preview bypass
 * --------------
 * The gate never blocks admin previews ($render_context->meta->is_preview).
 * The simulate_state='password_required' query parameter causes the gate to
 * render the lock screen even in preview mode (for design/QA purposes).
 *
 * @package FotoGrids\Render\Gates\Password
 * @since   1.0.0
 */
final class Password_Gate implements Gate {

	// -------------------------------------------------------------------------
	// Gate identity
	// -------------------------------------------------------------------------

	public function id(): string {
		return 'fotogrids/password';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function extends_id(): ?string {
		return null;
	}

	// -------------------------------------------------------------------------
	// Gate lifecycle
	// -------------------------------------------------------------------------

	/**
	 * Returns true when password protection is active for this gallery.
	 *
	 * Skips preview renders unless the simulate_state override is set, so
	 * admins always see their galleries while editing.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		$settings = $render_context->settings;

		// Allow simulate_state='password_required' to force the lock screen in
		// preview mode for design/QA purposes.
		$simulate = (string) ( $settings['_simulate_state'] ?? '' );
		if ( 'password_required' === $simulate ) {
			return true;
		}

		// Never block admin previews unless explicitly simulated (above).
		if ( $render_context->meta->is_preview ) {
			return false;
		}

		// Requires the toggle to be on AND an actual password to be stored.
		$protect   = ! empty( $settings['password_protect'] );
		$has_crypt = \FotoGrids\Password_Crypto::is_encrypted(
			(string) ( $settings['_password_encrypted'] ?? '' )
		);

		return $protect && $has_crypt;
	}

	/**
	 * Evaluates whether the current visitor has unlocked this gallery.
	 *
	 * Checks the unlock cookie set by POST /gallery/{id}/unlock. If the cookie
	 * is present and its HMAC matches the current stored ciphertext the gate
	 * passes. Otherwise it returns the lock screen HTML.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return Gate_Result
	 */
	public function evaluate( Render_Context $render_context ): Gate_Result {
		$gallery_id = $render_context->meta->gallery_id;
		$settings   = $render_context->settings;
		$simulate   = (string) ( $settings['_simulate_state'] ?? '' );

		// Simulated lock - always show the lock screen, skip cookie check.
		if ( 'password_required' !== $simulate ) {
			$stored     = (string) ( $settings['_password_encrypted'] ?? '' );
			$cookie_key = 'fotogrids_unlocked_' . $gallery_id;
			$cookie_val = sanitize_text_field( wp_unslash( $_COOKIE[ $cookie_key ] ?? '' ) );

			if (
				'' !== $cookie_val
				&& hash_equals(
					Gallery_Data::make_unlock_cookie_value( $gallery_id, $stored ),
					$cookie_val
				)
			) {
				return Gate_Result::pass();
			}
		}

		return Gate_Result::block(
			html:        $this->render_lock_screen( $render_context ),
			http_status: 200
		);
	}

	/**
	 * CSS assets: shared gate chrome + password-specific form styles.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			css: array_merge(
				Gate_Renderer::shared_asset_decl(),
				array(
					'fotogrids-password-lock' => new Asset_Decl(
						path: 'gates/password/password-lock.css'
					),
				)
			),
			js: array(
				'fotogrids-password-gate' => new Asset_Decl(
					path:      '../../assets/js/password-gate.js',
					deps:      array( 'fotogrids-runtime' ),
					in_footer: true,
				),
			)
		);
	}

	// -------------------------------------------------------------------------
	// HTML rendering
	// -------------------------------------------------------------------------

	/**
	 * Builds the lock screen HTML via Gate_Renderer.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	private function render_lock_screen( Render_Context $render_context ): string {
		$gallery_id = $render_context->meta->gallery_id;
		$rest_url   = esc_url( rest_url( 'fotogrids/v1/gallery/' . $gallery_id . '/unlock' ) );
		$nonce      = esc_attr( wp_create_nonce( 'wp_rest' ) );

		/* translators: heading shown on the gallery password lock screen */
		$title = esc_html__( 'Gallery Protected', 'fotogrids' );
		/* translators: instruction text shown below the lock screen heading */
		$description = esc_html__( 'Enter the password to view this gallery.', 'fotogrids' );
		/* translators: placeholder text inside the password input on the lock screen */
		$placeholder = esc_attr__( 'Password', 'fotogrids' );
		/* translators: label/text for the submit button on the gallery lock screen */
		$submit_label = esc_html__( 'Unlock', 'fotogrids' );
		/* translators: error shown when the visitor enters an incorrect gallery password */
		$error_text = esc_html__( 'Incorrect password. Please try again.', 'fotogrids' );

		// Per-gallery credential identity. Browsers key saved passwords on
		// (username + origin), so a hidden username field carrying a stable
		// per-gallery token makes the browser store and autofill the password
		// for THIS gallery specifically rather than offering one site-wide
		// credential on every lock screen. It is visually hidden (not
		// type="hidden") because credential managers ignore type="hidden"
		// fields - they need a real, autocomplete="username" input in the form.
		$credential_user = esc_attr( 'fotogrids-gallery-' . $gallery_id );

		$body_html = sprintf(
			'<form class="fg-lock-form" method="post"'
			. ' data-gallery-id="%1$d"'
			. ' data-unlock-url="%2$s"'
			. ' data-nonce="%3$s">'
			. '<input class="fg-lock-user" type="text" name="fg_gallery_user"'
			. ' value="%7$s" autocomplete="username" readonly tabindex="-1"'
			. ' aria-hidden="true" />'
			. '<div class="fg-lock-input-wrap">'
			. '<input class="fg-lock-input" type="password" name="password" placeholder="%4$s" autocomplete="current-password" required />'
			. '<button class="fg-lock-submit" type="submit">%5$s</button>'
			. '</div>'
			. '<p class="fg-lock-error" role="alert">%6$s</p>'
			. '</form>',
			$gallery_id,
			$rest_url,
			$nonce,
			$placeholder,
			$submit_label,
			$error_text,
			$credential_user
		);

		$card = new Gate_Card(
			title:       $title,
			description: $description,
			body_html:   $body_html,
			aria_label:  $title,
			icon_svg:    $this->lock_icon_svg(),
		);

		return Gate_Renderer::render( $render_context, $card );
	}

	/**
	 * Returns a self-contained SVG lock icon (no external dependency).
	 *
	 * Uses the Heroicons "lock-closed" outline path - MIT licensed, inline so
	 * no extra HTTP request is needed.
	 *
	 * @since  1.0.0
	 * @return string
	 */
	private function lock_icon_svg(): string {
		return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
			. '<rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>'
			. '<path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
			. '</svg>';
	}
}
