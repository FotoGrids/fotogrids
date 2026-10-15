<?php
declare(strict_types=1);

namespace FotoGrids\Render\Gates\Password;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Collection_Kind;
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
 * Shows a password form in place of a protected gallery or album until the
 * visitor unlocks it.
 *
 * An unlock sets the fotogrids_unlocked_{id} cookie or, when visitors are not
 * remembered, returns a token sent back in the X-FotoGrids-Unlock header.
 *
 * @package FotoGrids\Render\Gates\Password
 * @since   1.0.0
 */
final class Password_Gate implements Gate {

	/**
	 * Settings key that keeps the gate on in a preview render.
	 *
	 * @since 1.3.0
	 */
	public const PREVIEW_KEEPS_GATE = '_preview_keeps_password_gate';

	public function id(): string {
		return 'fotogrids/password';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function extends_id(): ?string {
		return null;
	}

	/**
	 * Returns true when the collection is protected. Previews pass unless
	 * simulated or PREVIEW_KEEPS_GATE is set.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		$settings = $render_context->settings;

		$simulate = (string) ( $settings['_simulate_state'] ?? '' );
		if ( 'password_required' === $simulate ) {
			return true;
		}

		if ( $render_context->meta->is_preview && empty( $settings[ self::PREVIEW_KEEPS_GATE ] ) ) {
			return false;
		}

		$protect   = ! empty( $settings['password_protect'] );
		$has_crypt = \FotoGrids\Password_Crypto::is_encrypted(
			(string) ( $settings['_password_encrypted'] ?? '' )
		);

		return $protect && $has_crypt;
	}

	/**
	 * Passes on a valid unlock cookie or token; otherwise returns the lock screen.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return Gate_Result
	 */
	public function evaluate( Render_Context $render_context ): Gate_Result {
		$collection_id = self::collection_id( $render_context );
		$settings      = $render_context->settings;
		$simulate      = (string) ( $settings['_simulate_state'] ?? '' );

		if ( 'password_required' !== $simulate ) {
			$stored     = (string) ( $settings['_password_encrypted'] ?? '' );
			$cookie_key = 'fotogrids_unlocked_' . $collection_id;
			$cookie_val = sanitize_text_field( wp_unslash( $_COOKIE[ $cookie_key ] ?? '' ) );

			if (
				'' !== $cookie_val
				&& hash_equals(
					Gallery_Data::make_unlock_cookie_value( $collection_id, $stored ),
					$cookie_val
				)
			) {
				return Gate_Result::pass();
			}

			$token = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FOTOGRIDS_UNLOCK'] ?? '' ) );
			if ( '' !== $token && Gallery_Data::verify_unlock_token( $collection_id, $stored, $token ) ) {
				return Gate_Result::pass();
			}
		}

		return Gate_Result::block(
			$this->render_lock_screen( $render_context ),
			200,
			Gate_Renderer::build_css( $render_context )
		);
	}

	/**
	 * Returns the gate's styles and the lock form script.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array_merge(
				Gate_Renderer::shared_asset_decl(),
				array(
					'fotogrids-password-lock' => new Asset_Decl(
						'gates/password/password-lock.css'
					),
				)
			),
			array(
				'fotogrids-password-gate' => new Asset_Decl(
					'../../assets/js/password-gate.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}

	/**
	 * Builds the lock screen HTML.
	 *
	 * @since  1.0.0
	 * @param  Render_Context $render_context Render context.
	 * @return string
	 */
	private function render_lock_screen( Render_Context $render_context ): string {
		$is_album      = Collection_Kind::ALBUM === $render_context->meta->collection_kind;
		$collection_id = self::collection_id( $render_context );
		$route         = ( $is_album ? 'album/' : 'gallery/' ) . $collection_id . '/unlock';
		$rest_url      = esc_url( rest_url( 'fotogrids/v1/' . $route ) );
		$nonce         = esc_attr( wp_create_nonce( 'wp_rest' ) );

		if ( $is_album ) {
			/* translators: heading shown on the album password lock screen */
			$title = esc_html__( 'Album Protected', 'fotogrids' );
			/* translators: instruction text shown below the album lock screen heading */
			$description = esc_html__( 'Enter the password to view this album.', 'fotogrids' );
		} else {
			/* translators: heading shown on the gallery password lock screen */
			$title = esc_html__( 'Gallery Protected', 'fotogrids' );
			/* translators: instruction text shown below the lock screen heading */
			$description = esc_html__( 'Enter the password to view this gallery.', 'fotogrids' );
		}
		/* translators: placeholder text inside the password input on the lock screen */
		$placeholder = esc_attr__( 'Password', 'fotogrids' );
		/* translators: label/text for the submit button on the gallery lock screen */
		$submit_label = esc_html__( 'Unlock', 'fotogrids' );
		/* translators: error shown when the visitor enters an incorrect gallery password */
		$error_text = esc_html__( 'Incorrect password. Please try again.', 'fotogrids' );

		// Per-collection username for password managers, which ignore type="hidden".
		$credential_user = esc_attr( ( $is_album ? 'fotogrids-album-' : 'fotogrids-gallery-' ) . $collection_id );
		$id_attribute    = $is_album ? 'data-album-id' : 'data-gallery-id';

		$body_html = sprintf(
			'<form class="fg-lock-form" method="post"'
			. ' %8$s="%1$d"'
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
			$collection_id,
			$rest_url,
			$nonce,
			$placeholder,
			$submit_label,
			$error_text,
			$credential_user,
			$id_attribute
		);

		$card = new Gate_Card(
			$title,
			$description,
			$body_html,
			$title,
			$this->lock_icon_svg(),
		);

		return Gate_Renderer::render( $render_context, $card );
	}

	/**
	 * Returns the ID of the gallery or album being rendered.
	 *
	 * @since  1.3.0
	 * @param  Render_Context $render_context Render context.
	 * @return int
	 */
	private static function collection_id( Render_Context $render_context ): int {
		if ( Collection_Kind::ALBUM === $render_context->meta->collection_kind ) {
			return (int) $render_context->meta->album_id;
		}

		return $render_context->meta->gallery_id;
	}

	/**
	 * Returns the inline lock icon (Heroicons "lock-closed", MIT).
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
