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
	 * Points the SDK at the plugin's WordPress-visible directory.
	 *
	 * The SDK derives WP_FS__DIR from __FILE__, which PHP resolves through
	 * symlinks. Its own recovery only matches a symlink whose name equals its
	 * target's, so a differently named link leaves every SDK asset URL wrong.
	 * Must run before the SDK is loaded.
	 *
	 * @since  1.0.0
	 * @return void
	 */
	private static function maybe_define_sdk_dir(): void {
		if ( defined( 'WP_FS__DIR' ) || class_exists( '\\Freemius' ) ) {
			return;
		}

		$plugin_slug = dirname( FOTOGRIDS_PLUGIN_BASENAME );
		$sdk_dir     = wp_normalize_path( WP_PLUGIN_DIR . '/' . $plugin_slug . '/freemius' );
		$sdk_real    = realpath( $sdk_dir );

		if ( false === $sdk_real ) {
			return;
		}

		$sdk_real = wp_normalize_path( $sdk_real );

		if ( $sdk_real === $sdk_dir || basename( dirname( $sdk_real ) ) === $plugin_slug ) {
			return;
		}

		define( 'WP_FS__DIR', $sdk_dir ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Freemius SDK constant.
	}

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

		$sdk_path = FOTOGRIDS_PLUGIN_DIR . 'freemius/start.php';

		if ( ! file_exists( $sdk_path ) ) {
			return null;
		}

		self::maybe_define_sdk_dir();

		require_once $sdk_path;

		if ( ! function_exists( 'fs_dynamic_init' ) ) {
			return null;
		}

		try {
			// Config is passed inline (not via a helper) so the WordPress.org
			// compliance flags - is_premium => false and is_org_compliant => true -
			// are visible at the fs_dynamic_init() call site.
			self::$instance = fs_dynamic_init(
				array(
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
					// Start sites in anonymous mode so the SDK never overrides the
					// FotoGrids menu page with its own connect/opt-in screen. The
					// plugin owns onboarding via its setup wizard; no data reaches
					// Freemius until a user explicitly opts in.
					'anonymous_mode'      => true,
					'wp_org_gatekeeper'   => 'OA7#BoRiBNqdf52FvzEf!!074aRLPs8fspif$7K1#4u4Csys1fQlCecVcUTOs2mcpeVHi#C2j9d09fOTvbC0HloPT7fFee5WdS3G',
					'menu'                => array(
						'slug'    => 'fotogrids-dashboard',
						'account' => true,
						'contact' => false,
						'support' => false,
						'pricing' => false,
					),
				)
			);
		} catch ( \Throwable $e ) {
			\FotoGrids\Debug_Log::write( 'license', 'Freemius init failed: ' . $e->getMessage() );
			return null;
		}

		// FotoGrids owns the post-activation experience via its own setup
		// wizard, so suppress the SDK's own connect-screen redirect on
		// activation. Combined with anonymous_mode, the FotoGrids dashboard
		// renders instead of the Freemius opt-in screen.
		self::$instance->add_filter( 'redirect_on_activation', '__return_false' );

		/**
		 * Fires after the Freemius SDK instance is ready.
		 *
		 * @since 1.0.0
		 * @param \Freemius $instance
		 */
		do_action( Actions_Licensing::FREEMIUS_LOADED, self::$instance );

		return self::$instance;
	}
}
