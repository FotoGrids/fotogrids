<?php
/**
 * Freemius SDK bootstrap.
 *
 * @package FotoGrids\Licensing
 * @since   1.0.0
 */

namespace FotoGrids\Licensing;

use FotoGrids\Hooks\Actions_Licensing;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Loads and initialises the Freemius SDK for the Free plugin.
 *
 * Must be called from the main plugin file before plugins_loaded so the SDK
 * can register its early hooks. Idempotent.
 *
 * @since 1.0.0
 */
class Freemius_Bootstrap {

	/**
	 * Cached Freemius instance.
	 *
	 * @var \Freemius|null
	 */
	private static ?\Freemius $instance = null;

	/**
	 * Whether init() has already run.
	 *
	 * @var bool
	 */
	private static bool $initialized = false;

	/**
	 * Initialise the Freemius SDK.
	 *
	 * Returns null if the SDK files are not present at <plugin>/freemius/start.php
	 * or if SDK initialisation throws.
	 *
	 * @since  1.0.0
	 * @return \Freemius|null
	 */
	public static function init(): ?\Freemius {
		if ( self::$initialized ) {
			return self::$instance;
		}
		self::$initialized = true;

		$canonical_sdk_dir = self::canonical_sdk_dir();

		$sdk_path = ( null !== $canonical_sdk_dir )
			? $canonical_sdk_dir . '/start.php'
			: FOTOGRIDS_PLUGIN_DIR . 'freemius/start.php';

		if ( ! file_exists( $sdk_path ) ) {
			return null;
		}

		// Pin WP_FS__DIR to the canonical plugin path so the SDK's asset URLs
		// resolve against /wp-content/plugins/<plugin>/ rather than the resolved
		// realpath, which can leak filesystem paths under symlinked dev setups.
		if ( ! defined( 'WP_FS__DIR' ) && null !== $canonical_sdk_dir ) {
			define( 'WP_FS__DIR', $canonical_sdk_dir ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WP_FS__DIR is a Freemius SDK constant name, not ours to prefix.
		}

		require_once $sdk_path;

		if ( ! function_exists( 'fs_dynamic_init' ) ) {
			return null;
		}

		try {
			self::$instance = fs_dynamic_init( self::config() );
		} catch ( \Throwable $e ) {
			\FotoGrids\Debug_Log::write( 'license', 'Freemius init failed: ' . $e->getMessage() );
			return null;
		}

		/**
		 * Fires after the Freemius SDK instance is ready.
		 *
		 * @since 1.0.0
		 * @param \Freemius $instance
		 */
		do_action( Actions_Licensing::FREEMIUS_LOADED, self::$instance );

		return self::$instance;
	}

	/**
	 * Resolve the canonical (non-realpath) plugin SDK directory.
	 *
	 * @since  1.0.0
	 * @return string|null
	 */
	private static function canonical_sdk_dir(): ?string {
		if ( ! defined( 'WP_PLUGIN_DIR' ) || ! defined( 'FOTOGRIDS_PLUGIN_BASENAME' ) ) {
			return null;
		}

		$plugin_folder = explode( '/', FOTOGRIDS_PLUGIN_BASENAME )[0];
		$candidate     = WP_PLUGIN_DIR . '/' . $plugin_folder . '/freemius';

		return file_exists( $candidate . '/start.php' ) ? $candidate : null;
	}

	/**
	 * SDK configuration array.
	 *
	 * @since  1.0.0
	 * @return array<string,mixed>
	 */
	private static function config(): array {
		return array(
			'id'                  => '27760',
			'slug'                => 'fotogrids',
			'premium_slug'        => 'fotogrids-pro',
			'type'                => 'plugin',
			'public_key'          => 'pk_6a5e7b6d7191997f147022ce9002d',
			'is_premium'          => false,
			'has_premium_version' => true,
			'has_addons'          => true,
			'has_paid_plans'      => true,
			'is_org_compliant'    => true,
			'anonymous_mode'      => false,
			'wp_org_gatekeeper'   => 'OA7#BoRiBNqdf52FvzEf!!074aRLPs8fspif$7K1#4u4Csys1fQlCecVcUTOs2mcpeVHi#C2j9d09fOTvbC0HloPT7fFee5WdS3G',
			'menu'                => array(
				'slug'    => 'fotogrids-dashboard',
				'account' => true,
				'contact' => false,
				'support' => false,
				'pricing' => false,
			),
		);
	}
}
