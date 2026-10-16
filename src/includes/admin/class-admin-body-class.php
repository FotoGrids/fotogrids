<?php
/**
 * Body classes for the gallery and album admin screens.
 *
 * @package FotoGrids\Admin
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Admin;

use FotoGrids\Post_Types;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Adds body classes to the gallery and album list, edit and new screens.
 *
 * - `fotogrids-collection-screen` on every collection screen.
 * - `fotogrids-collection-screen--gallery` or `--album` for the kind.
 *
 * @since 1.3.0
 */
final class Admin_Body_Class {

	/**
	 * Class present on every gallery and album admin screen.
	 *
	 * @since 1.3.0
	 * @var string
	 */
	const COLLECTION_SCREEN = 'fotogrids-collection-screen';

	/**
	 * Register the filter.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function init(): void {
		add_filter( 'admin_body_class', array( __CLASS__, 'add' ) );
	}

	/**
	 * Append the collection-screen classes on gallery and album screens.
	 *
	 * @since  1.3.0
	 * @param  string $classes Space-separated admin body classes.
	 * @return string
	 */
	public static function add( $classes ): string {
		$classes = (string) $classes;
		$screen  = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

		if ( ! $screen || ! in_array( $screen->post_type, Post_Types::COLLECTION_TYPES, true ) ) {
			return $classes;
		}

		$kind = Post_Types::kind_of( $screen->post_type );

		return $classes . ' ' . self::COLLECTION_SCREEN . ' ' . self::COLLECTION_SCREEN . '--' . $kind;
	}
}
