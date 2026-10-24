<?php
/**
 * Which tour a screen offers, and whether it opens by itself.
 *
 * @package FotoGrids\Modules\Walkthrough
 * @since   1.3.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\Walkthrough;

use FotoGrids\Gallery_Album_Relations;
use FotoGrids\Galleries\Gallery_Repository;
use FotoGrids\Post_Types;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Walkthrough_Screen
 *
 * Resolves the tour for the current admin screen: the gallery and album edit
 * screens and the FotoGrids Dashboard each have one.
 *
 * @package FotoGrids\Modules\Walkthrough
 * @since   1.3.0
 */
final class Walkthrough_Screen {

	/**
	 * Screen ids of the FotoGrids Dashboard.
	 *
	 * @var string[]
	 */
	const DASHBOARD_SCREENS = array( 'toplevel_page_fotogrids', 'fotogrids_page_fotogrids-dashboard' );

	/**
	 * Query argument that starts the screen's tour.
	 *
	 * @var string
	 */
	const START_ARG = 'fotogrids_walkthrough';

	/**
	 * Post statuses that count as a collection the user made.
	 *
	 * @var string[]
	 */
	const AUTHORED_STATUSES = array( 'publish', 'future', 'draft', 'pending', 'private', 'trash' );

	/**
	 * Resolved context for this request, once a screen is known.
	 *
	 * @var array{tour:string,auto_start:bool,resume:bool,forced:bool}|null
	 */
	private static $current = null;

	/**
	 * Whether a tour opens by itself for a first-time user.
	 *
	 * @since  1.3.0
	 * @param  string $state          Stored state for the tour ('' when it never ran).
	 * @param  bool   $is_empty       Whether the collection on screen holds nothing yet.
	 * @param  bool   $authored_other Whether the user made another collection of this kind.
	 * @return bool
	 */
	public static function auto_starts( string $state, bool $is_empty, bool $authored_other ): bool {
		return '' === $state && $is_empty && ! $authored_other;
	}

	/**
	 * Whether the "put it on a page" part of a tour opens on this screen.
	 *
	 * @since  1.3.0
	 * @param  string $state    Stored state for the tour.
	 * @param  bool   $is_saved Whether the collection on screen has been saved.
	 * @return bool
	 */
	public static function resumes( string $state, bool $is_saved ): bool {
		return Walkthrough_State::PUBLISH_PENDING === $state && $is_saved;
	}

	/**
	 * The tour id for a screen, or '' when it has none.
	 *
	 * @since  1.3.0
	 * @param  string $screen_id Screen id.
	 * @param  string $base      Screen base.
	 * @param  string $post_type Screen post type.
	 * @return string
	 */
	public static function tour_for( string $screen_id, string $base, string $post_type ): string {
		if ( in_array( $screen_id, self::DASHBOARD_SCREENS, true ) ) {
			return Walkthrough_State::TOUR_DASHBOARD;
		}

		if ( 'post' !== $base ) {
			return '';
		}

		$kind = Post_Types::kind_of( $post_type );

		return in_array( $kind, array( Walkthrough_State::TOUR_GALLERY, Walkthrough_State::TOUR_ALBUM ), true ) ? (string) $kind : '';
	}

	/**
	 * The tour context of the current screen, or null when it has no tour.
	 *
	 * @since  1.3.0
	 * @return array{tour:string,auto_start:bool,resume:bool,forced:bool}|null
	 */
	public static function current(): ?array {
		if ( null !== self::$current ) {
			return '' === self::$current['tour'] ? null : self::$current;
		}

		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen instanceof \WP_Screen ) {
			return null;
		}

		$tour = self::tour_for( (string) $screen->id, (string) $screen->base, (string) $screen->post_type );

		self::$current = array(
			'tour'       => $tour,
			'auto_start' => false,
			'resume'     => false,
			'forced'     => false,
		);

		if ( '' === $tour ) {
			return null;
		}

		$user_id = get_current_user_id();
		$state   = Walkthrough_State::get( $user_id, $tour );
		$post    = get_post();
		$post_id = $post instanceof \WP_Post ? (int) $post->ID : 0;

		if ( Walkthrough_State::TOUR_DASHBOARD === $tour ) {
			$auto_start = self::auto_starts( $state, true, self::has_authored( $user_id, Post_Types::GALLERY, 0 ) );
			$resume     = false;
		} else {
			$is_saved   = $post_id > 0 && 'auto-draft' !== $post->post_status;
			$auto_start = self::auto_starts(
				$state,
				self::is_empty( $tour, $post_id ),
				self::has_authored( $user_id, (string) $screen->post_type, $post_id )
			);
			$resume     = self::resumes( $state, $is_saved );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only flag that only opens the tour.
		$forced = isset( $_GET[ self::START_ARG ] );

		self::$current = array(
			'tour'       => $tour,
			'auto_start' => $auto_start,
			'resume'     => $resume,
			'forced'     => $forced,
		);

		return self::$current;
	}

	/**
	 * Whether the current screen opens its tour without the user asking.
	 *
	 * @since  1.3.0
	 * @return bool
	 */
	public static function opens_by_itself(): bool {
		$current = self::current();

		return null !== $current && ( $current['auto_start'] || $current['resume'] || $current['forced'] );
	}

	/**
	 * Forget the resolved context.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	public static function reset(): void {
		self::$current = null;
	}

	/**
	 * Whether the collection holds no items (gallery) or no galleries (album).
	 *
	 * @param  string $tour    Tour id.
	 * @param  int    $post_id Collection ID, 0 for a new one.
	 * @return bool
	 */
	private static function is_empty( string $tour, int $post_id ): bool {
		if ( $post_id <= 0 ) {
			return true;
		}

		if ( Walkthrough_State::TOUR_ALBUM === $tour ) {
			return array() === Gallery_Album_Relations::get_gallery_ids_for_album( $post_id );
		}

		return 0 === Gallery_Repository::get_item_count( $post_id );
	}

	/**
	 * Whether the user made a collection of the type other than `$exclude_id`.
	 *
	 * @param  int    $user_id    User ID.
	 * @param  string $post_type  Collection post type.
	 * @param  int    $exclude_id Collection to ignore, 0 for none.
	 * @return bool
	 */
	private static function has_authored( int $user_id, string $post_type, int $exclude_id ): bool {
		if ( $user_id <= 0 ) {
			return false;
		}

		$ids = get_posts(
			array(
				'post_type'        => $post_type,
				'author'           => $user_id,
				'post_status'      => self::AUTHORED_STATUSES,
				'post__not_in'     => $exclude_id > 0 ? array( $exclude_id ) : array(),
				'fields'           => 'ids',
				'posts_per_page'   => 1,
				'no_found_rows'    => true,
				'suppress_filters' => true,
			)
		);

		return ! empty( $ids );
	}
}
