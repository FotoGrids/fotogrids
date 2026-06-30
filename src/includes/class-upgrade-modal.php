<?php
/**
 * FotoGrids Upgrade Modal
 *
 * Handles the upgrade to pro modal content and functionality
 */

namespace FotoGrids;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Upgrade_Modal {

	/**
	 * Get all upgrade benefits data
	 *
	 * @return array Array of benefit objects
	 */
	public static function get_benefits() {
		return array(
			array(
				'key'        => 'advanced_layouts',
				'shortTitle' => __( 'Layouts', 'fotogrids' ),
				'title'      => __( 'Turn Browsers Into Buyers with', 'fotogrids' ),
				'subtitle'   => __( 'Advanced Layout Options!', 'fotogrids' ),
				'content'    => __( 'Carousel for hero sliders and lookbooks. Video Playlist for video-led galleries. Product Gallery for shop pages. Mixed Tiles for bento-style mosaics. Same builder, same controls - four more shapes to reach for.', 'fotogrids' ),
				'color'      => '#8b5cf6',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/advanced-layouts.svg',
			),
			array(
				'key'        => 'seo_optimization',
				'shortTitle' => __( 'SEO', 'fotogrids' ),
				'title'      => __( 'Get Discovered by Search Engines with', 'fotogrids' ),
				'subtitle'   => __( 'Built-in SEO Optimization!', 'fotogrids' ),
				'content'    => __( 'Rank higher and get found faster. FotoGrids gives you built-in SEO tools made specifically for galleries - metadata, structured data, optimized images, and clean markup - to boost visibility and organic traffic.', 'fotogrids' ),
				'color'      => '#6366f1',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/seo-optimization.svg',
			),
			array(
				'key'        => 'ecommerce_monetization',
				'shortTitle' => __( 'Monetization', 'fotogrids' ),
				'title'      => __( 'Turn Views Into Revenue with', 'fotogrids' ),
				'subtitle'   => __( 'E-commerce Integrations!', 'fotogrids' ),
				'content'    => __( 'Turn your galleries into sales machines. Integrate with WooCommerce, Easy Digital Downloads, and more to sell photos, prints, and digital products - turning every gallery visitor into a potential customer.', 'fotogrids' ),
				'color'      => '#22c55e',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/monetization.svg',
			),
			array(
				'key'        => 'custom_css',
				'shortTitle' => __( 'Styling', 'fotogrids' ),
				'title'      => __( 'Own Your Aesthetic with', 'fotogrids' ),
				'subtitle'   => __( 'Advanced Global Styling!', 'fotogrids' ),
				'content'    => __( 'Match your brand perfectly. From micro-details to full theme overhauls, gain complete visual freedom with Global Color Palette, Global Typography, advanced customization controls, and endless styling possibilities.', 'fotogrids' ),
				'color'      => '#06b6d4',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/custom-styling.svg',
			),
			array(
				'key'        => 'priority_support',
				'shortTitle' => __( 'Support', 'fotogrids' ),
				'title'      => __( 'Never Feel Stuck Again with', 'fotogrids' ),
				'subtitle'   => __( 'Priority Support!', 'fotogrids' ),
				'content'    => __( 'Enjoy peace of mind with lightning-fast help from our expert team. Get priority responses, personalized guidance, and solutions tailored to your setup - exactly when you need them most.', 'fotogrids' ),
				'color'      => '#10b981',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/priority-support.svg',
			),
			array(
				'key'        => 'analytics',
				'shortTitle' => __( 'Analytics', 'fotogrids' ),
				'title'      => __( 'Make Smarter Decisions with', 'fotogrids' ),
				'subtitle'   => __( 'Advanced Analytics!', 'fotogrids' ),
				'content'    => __( 'Understand exactly what your audience loves. Engagement tracking, user behavior insights, and traffic sources to optimize your galleries, improve conversions, and create content that actually performs.', 'fotogrids' ),
				'color'      => '#ef4444',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/analytics.svg',
			),
			array(
				'key'        => 'integrations',
				'shortTitle' => __( 'Integrations', 'fotogrids' ),
				'title'      => __( 'Connect Your Entire Workflow with', 'fotogrids' ),
				'subtitle'   => __( 'Powerful Integrations!', 'fotogrids' ),
				'content'    => __( 'Integrate seamlessly with Google Photos, Dropbox, Instagram, Lightroom, and other top platforms. Import faster, organize easier, and build galleries without breaking your creative flow.', 'fotogrids' ),
				'color'      => '#8b5cf6',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/integrations.svg',
			),
			array(
				'key'        => 'bulk_operations',
				'shortTitle' => __( 'Bulk Tools', 'fotogrids' ),
				'title'      => __( 'Save Hours of Work with', 'fotogrids' ),
				'subtitle'   => __( 'Bulk Operations!', 'fotogrids' ),
				'content'    => __( 'Manage large galleries in minutes, not hours. Edit multiple items at once, bulk-import from your favorite sources, and automate repetitive tasks so you can focus on what truly matters - creating and selling.', 'fotogrids' ),
				'color'      => '#06b6d4',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/bulk-operations.svg',
			),
			array(
				'key'        => 'templates',
				'shortTitle' => __( 'Templates', 'fotogrids' ),
				'title'      => __( 'Launch Polished Galleries with', 'fotogrids' ),
				'subtitle'   => __( 'Ready & Custom Templates!', 'fotogrids' ),
				'content'    => __( 'Start from professionally crafted gallery and album presets that look great out of the box, or save your own best-performing designs as reusable templates your whole team can apply in a click.', 'fotogrids' ),
				'color'      => '#f59e0b',
				'image'      => FOTOGRIDS_PLUGIN_URL . 'assets/admin/images/upgrade/templates.svg',
			),
		);
	}

	/**
	 * Get benefit by key
	 *
	 * @param string $key Benefit key
	 * @return array|null Benefit data or null if not found
	 */
	public static function get_benefit_by_key( $key ) {
		$benefits = self::get_benefits();
		foreach ( $benefits as $benefit ) {
			if ( $benefit['key'] === $key ) {
				return $benefit;
			}
		}
		return null;
	}

	/**
	 * Get benefit index by key
	 *
	 * @param string $key Benefit key
	 * @return int Benefit index or 0 if not found
	 */
	public static function get_benefit_index_by_key( $key ) {
		$benefits = self::get_benefits();
		foreach ( $benefits as $index => $benefit ) {
			if ( $benefit['key'] === $key ) {
				return $index;
			}
		}
		return 0;
	}

	/**
	 * Get modal strings for translation
	 *
	 * @return array Translatable strings
	 */
	public static function get_modal_strings() {
		return array(
			'close'        => __( 'Close', 'fotogrids' ),
			'upgradeNow'   => __( 'Upgrade Now', 'fotogrids' ),
			'freeVsPro'    => __( 'Free vs. Pro', 'fotogrids' ),
			'noCreditCard' => __( 'No credit card required', 'fotogrids' ),
			'startFree'    => __( 'Start now for free', 'fotogrids' ),
		);
	}

	/**
	 * Get upgrade and comparison URLs
	 *
	 * @return array URLs for upgrade and comparison
	 */
	public static function get_urls() {
		return array(
			'upgrade'    => Links::go( 'upgrade', 'upgrade-modal', 'upgrade' ),
			'comparison' => Links::go( 'free-vs-pro', 'upgrade-modal', 'comparison' ),
		);
	}

	/**
	 * Enqueue modal assets
	 */
	public static function enqueue_assets() {
		// This will be called when the modal needs to be displayed
		wp_enqueue_style( 'fotogrids-upgrade-modal' );
		wp_enqueue_script( 'fotogrids-upgrade-modal' );
	}

	/**
	 * Get all modal data for JavaScript
	 *
	 * @return array Complete modal data
	 */
	public static function get_modal_data() {
		return array(
			'benefits' => self::get_benefits(),
			'strings'  => self::get_modal_strings(),
			'urls'     => self::get_urls(),
		);
	}
}
