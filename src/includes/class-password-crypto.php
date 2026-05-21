<?php
namespace FotoGrids;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Gallery Password Crypto
 *
 * Handles reversible AES-256-CBC encryption for gallery passwords so that
 * the original password can be retrieved (by authorised users) via the admin
 * eye-button, while still keeping it unreadable in plain-text inside the DB.
 *
 * Security model
 * --------------
 * - The encryption key is derived from two WordPress secret keys (AUTH_KEY and
 *   SECURE_AUTH_KEY) that live in wp-config.php — never in the database.
 * - Compromising the database alone is not enough to decrypt stored passwords;
 *   an attacker also needs read access to wp-config.php.
 * - A fresh random IV is generated per encryption so identical passwords
 *   produce different ciphertext.
 * - Verification uses hash_equals() (constant-time) to prevent timing attacks.
 *
 * Storage format
 * --------------
 * base64( iv [16 bytes] . ciphertext )
 * Stored in post meta under the key fotogrids_password.
 *
 * @package FotoGrids
 * @since   1.0.0
 */
final class Password_Crypto {

	/**
	 * OpenSSL cipher used for encryption.
	 *
	 * AES-256-CBC: widely supported, well-understood, appropriate for this use
	 * case where authenticated encryption (AEAD) is not strictly required and
	 * the ciphertext is not attacker-controlled.
	 *
	 * @since 1.0.0
	 */
	private const CIPHER = 'aes-256-cbc';

	/**
	 * IV length in bytes for AES-CBC (always 16).
	 *
	 * @since 1.0.0
	 */
	private const IV_LENGTH = 16;

	/**
	 * Context string mixed into the HMAC key derivation.
	 *
	 * Changing this would invalidate all stored passwords; treat as a constant.
	 *
	 * @since 1.0.0
	 */
	private const KEY_CONTEXT = 'fotogrids_gallery_password_v1';

	/**
	 * Encrypts a plaintext gallery password.
	 *
	 * Returns a base64-encoded string containing the IV prepended to the
	 * ciphertext. Returns an empty string on failure (e.g. if openssl is
	 * unavailable or the password is empty).
	 *
	 * @since  1.0.0
	 * @param  string $plaintext The raw password entered by the site owner.
	 * @return string            Encrypted value ready for post meta storage, or ''.
	 */
	public static function encrypt( string $plaintext ): string {
		if ( $plaintext === '' ) {
			return '';
		}

		$key = self::derive_key();
		if ( $key === '' ) {
			return '';
		}

		$iv = openssl_random_pseudo_bytes( self::IV_LENGTH );
		if ( $iv === false ) {
			return '';
		}

		$ciphertext = openssl_encrypt( $plaintext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv );
		if ( $ciphertext === false ) {
			return '';
		}

		return base64_encode( $iv . $ciphertext );
	}

	/**
	 * Decrypts a stored gallery password back to plaintext.
	 *
	 * Returns the original plaintext on success, or an empty string if the
	 * stored value is missing, malformed, or decryption fails.
	 *
	 * @since  1.0.0
	 * @param  string $stored The value read from post meta (base64 IV + ciphertext).
	 * @return string         Original plaintext password, or '' on failure.
	 */
	public static function decrypt( string $stored ): string {
		if ( $stored === '' ) {
			return '';
		}

		$key = self::derive_key();
		if ( $key === '' ) {
			return '';
		}

		$raw = base64_decode( $stored, true );
		if ( $raw === false || strlen( $raw ) <= self::IV_LENGTH ) {
			return '';
		}

		$iv         = substr( $raw, 0, self::IV_LENGTH );
		$ciphertext = substr( $raw, self::IV_LENGTH );

		$plaintext = openssl_decrypt( $ciphertext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv );
		if ( $plaintext === false ) {
			return '';
		}

		return $plaintext;
	}

	/**
	 * Verifies a submitted password against a stored encrypted value.
	 *
	 * Uses a constant-time comparison (hash_equals) to prevent timing attacks.
	 * This is safe because we compare fixed-length HMAC digests of both values
	 * rather than variable-length strings directly.
	 *
	 * @since  1.0.0
	 * @param  string $submitted The raw password submitted by the visitor.
	 * @param  string $stored    The value read from post meta.
	 * @return bool              True if the password matches.
	 */
	public static function verify( string $submitted, string $stored ): bool {
		if ( $submitted === '' || $stored === '' ) {
			return false;
		}

		$plaintext = self::decrypt( $stored );
		if ( $plaintext === '' ) {
			return false;
		}

		// Compare HMACs of both strings rather than the strings directly.
		// hash_equals requires equal-length inputs; HMAC-SHA256 always produces
		// 32 bytes, so the lengths are always equal regardless of input length.
		$hmac_key = self::derive_key();
		return hash_equals(
			hash_hmac( 'sha256', $plaintext, $hmac_key ),
			hash_hmac( 'sha256', $submitted, $hmac_key )
		);
	}

	/**
	 * Returns whether a stored value looks like an encrypted password.
	 *
	 * A lightweight check — does not attempt decryption. Used by the admin
	 * read path to populate the password_is_set flag without decrypting.
	 *
	 * @since  1.0.0
	 * @param  string $stored The value read from post meta.
	 * @return bool
	 */
	public static function is_encrypted( string $stored ): bool {
		if ( $stored === '' ) {
			return false;
		}

		$raw = base64_decode( $stored, true );
		// Must decode cleanly and be longer than a bare IV.
		return $raw !== false && strlen( $raw ) > self::IV_LENGTH;
	}

	/**
	 * Derives the encryption key from WordPress secret keys.
	 *
	 * The key is site-specific: an attacker needs wp-config.php access (not
	 * just DB access) to derive it. Returns an empty string if the required
	 * constants are not defined (unlikely on any real WordPress install).
	 *
	 * @since  1.0.0
	 * @return string 32-byte raw key, or '' on failure.
	 */
	private static function derive_key(): string {
		$auth_key        = defined( 'AUTH_KEY' )        ? AUTH_KEY        : '';
		$secure_auth_key = defined( 'SECURE_AUTH_KEY' ) ? SECURE_AUTH_KEY : '';

		if ( $auth_key === '' && $secure_auth_key === '' ) {
			return '';
		}

		// HMAC-SHA256 always produces 32 bytes — exactly the AES-256 key size.
		return hash_hmac(
			'sha256',
			self::KEY_CONTEXT,
			$auth_key . $secure_auth_key,
			true // raw binary output
		);
	}
}
