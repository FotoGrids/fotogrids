<?php
/**
 * Core (Free) permission registrations.
 *
 * @package FotoGrids\Permissions
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Permissions;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Registers every permission Free knows about that isn't owned by a Tool or
 * a Module. Four buckets:
 *
 *   1. Plugin-level atomic caps (manage_fotogrids, manage_fotogrids_settings,
 *      manage_fotogrids_library, view_fotogrids_stats).
 *
 *   2. CPT atomic caps derived from Post_Types capability_type pairs - all 13
 *      gallery caps + all 13 album caps. Registered with panel 'none': they
 *      are never checked by name in plugin code, only reached when WordPress
 *      expands `edit_post` / `read_post` / `delete_post` through
 *      map_meta_cap, so the matrix represents them through bucket 3 instead
 *      of listing all 26.
 *
 *   3. Logical caps for Panel 2 (the matrix) - one row per action a site
 *      owner recognises, each mapping to the atomic CPT caps behind it.
 *
 *   4. Logical caps for Panel 1 (the "lowest role" dropdowns). Each maps to a
 *      subset of the CPT/plugin atomic caps.
 *
 * Pro registers additional caps via the 'fotogrids/permissions/register'
 * filter - never by editing this file.
 *
 * @since 1.0.0
 */
final class Core_Permissions {

	/**
	 * Atomic capability slugs for the gallery CPT (capability_type pair:
	 * fotogrids_gallery / fotogrids_galleries with map_meta_cap = true).
	 *
	 * @var string[]
	 */
	public const GALLERY_CAPS = array(
		'edit_fotogrids_gallery',
		'read_fotogrids_gallery',
		'delete_fotogrids_gallery',
		'edit_fotogrids_galleries',
		'edit_others_fotogrids_galleries',
		'publish_fotogrids_galleries',
		'read_private_fotogrids_galleries',
		'delete_fotogrids_galleries',
		'delete_private_fotogrids_galleries',
		'delete_published_fotogrids_galleries',
		'delete_others_fotogrids_galleries',
		'edit_private_fotogrids_galleries',
		'edit_published_fotogrids_galleries',
	);

	/**
	 * Atomic capability slugs for the album CPT.
	 *
	 * @var string[]
	 */
	public const ALBUM_CAPS = array(
		'edit_fotogrids_album',
		'read_fotogrids_album',
		'delete_fotogrids_album',
		'edit_fotogrids_albums',
		'edit_others_fotogrids_albums',
		'publish_fotogrids_albums',
		'read_private_fotogrids_albums',
		'delete_fotogrids_albums',
		'delete_private_fotogrids_albums',
		'delete_published_fotogrids_albums',
		'delete_others_fotogrids_albums',
		'edit_private_fotogrids_albums',
		'edit_published_fotogrids_albums',
	);

	/**
	 * Run all core registrations against the registry.
	 *
	 * Called once from Permission_Registry::boot(). Idempotent only because
	 * Permission_Registry::register() overwrites duplicates.
	 */
	public static function register(): void {
		self::register_plugin_caps();
		self::register_gallery_caps();
		self::register_album_caps();
		self::register_matrix_caps();
		self::register_logical_caps();
	}

	/**
	 * Plugin-level atomic caps. Shown in the matrix; not in Panel 1.
	 */
	private static function register_plugin_caps(): void {
		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'manage_fotogrids',
					'label'               => __( 'Access every FotoGrids feature', 'fotogrids' ),
					'description'         => __( 'Master capability. Grants every other FotoGrids permission as a fallback. Cannot be revoked from administrators.', 'fotogrids' ),
					'group'               => 'plugin',
					'panel'               => 'advanced',
					'order'               => 10,
					'default_lowest_role' => 'administrator',
					'is_core'             => true,
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'manage_fotogrids_settings',
					'label'               => __( 'Manage plugin settings', 'fotogrids' ),
					'description'         => __( 'Open the FotoGrids settings screen and change the defaults that apply site-wide.', 'fotogrids' ),
					'group'               => 'plugin',
					'panel'               => 'advanced',
					'order'               => 20,
					'default_lowest_role' => 'administrator',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'manage_fotogrids_library',
					'label'               => __( 'Manage library (tags, people, locations)', 'fotogrids' ),
					'description'         => __( 'Create, rename and delete the tags, people and locations that items are filed under.', 'fotogrids' ),
					'group'               => 'media',
					'panel'               => 'advanced',
					'default_lowest_role' => 'editor',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'view_fotogrids_stats',
					'label'               => __( 'View statistics', 'fotogrids' ),
					'description'         => __( 'Open the Statistics screen and see view and share counts for galleries, albums and items.', 'fotogrids' ),
					'group'               => 'stats',
					'panel'               => 'advanced',
					'default_lowest_role' => 'editor',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'manage_fotogrids_permissions',
					'label'               => __( 'Manage permissions', 'fotogrids' ),
					'description'         => __( 'Open the Permissions Manager, and change who holds each permission. Cannot be revoked from administrators.', 'fotogrids' ),
					'group'               => 'plugin',
					'panel'               => 'advanced',
					'order'               => 30,
					'default_lowest_role' => 'administrator',
					'is_core'             => true,
				)
			)
		);

		// Settings caps: separated from content caps so an admin can let an
		// editor create and edit galleries / albums without also letting them
		// change how galleries look, feel and behave.
		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'modify_fotogrids_gallery_settings',
					'label'               => __( 'Modify gallery settings', 'fotogrids' ),
					'description'         => __( 'Change layout, Lightbox, captions, SEO, password, sharing and custom CSS/JS on a gallery, and apply or save templates.', 'fotogrids' ),
					'group'               => 'gallery',
					'panel'               => 'advanced',
					'order'               => 50,
					'default_lowest_role' => 'administrator',
					'scopes'              => array( 'global', 'gallery' ),
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'modify_fotogrids_album_settings',
					'label'               => __( 'Modify album settings', 'fotogrids' ),
					'description'         => __( 'Change layout, behaviour, SEO, sharing and custom CSS/JS on an album, and apply or save templates.', 'fotogrids' ),
					'group'               => 'album',
					'panel'               => 'advanced',
					'order'               => 50,
					'default_lowest_role' => 'administrator',
					'scopes'              => array( 'global', 'album' ),
				)
			)
		);
	}

	/**
	 * Gallery atomic caps. Registered so the activator grants them and
	 * map_meta_cap can resolve them; rendered in neither panel.
	 *
	 * Defaults to author for the per-post caps and editor for the cross-author
	 * caps - mirrors the historical assignment in Activator::add_capabilities.
	 */
	private static function register_gallery_caps(): void {
		$defaults  = self::cpt_cap_defaults();
		$meta_caps = self::cpt_meta_cap_keys( 'gallery' );
		foreach ( self::GALLERY_CAPS as $cap ) {
			$lowest = $defaults[ $cap ] ?? 'administrator';
			Permission_Registry::register(
				new Permission_Definition(
					array(
						'key'                 => $cap,
						'label'               => self::humanise_cpt_cap( $cap, 'gallery' ),
						'description'         => '',
						'group'               => 'gallery',
						'panel'               => 'none',
						'default_lowest_role' => $lowest,
						'scopes'              => array( 'global', 'gallery' ),
						'is_meta_cap'         => in_array( $cap, $meta_caps, true ),
					)
				)
			);
		}
	}

	/**
	 * Album atomic caps. Registered but rendered in neither panel, for the
	 * same reason as the gallery caps.
	 */
	private static function register_album_caps(): void {
		$defaults  = self::cpt_cap_defaults();
		$meta_caps = self::cpt_meta_cap_keys( 'album' );
		foreach ( self::ALBUM_CAPS as $cap ) {
			$lowest = $defaults[ $cap ] ?? 'administrator';
			Permission_Registry::register(
				new Permission_Definition(
					array(
						'key'                 => $cap,
						'label'               => self::humanise_cpt_cap( $cap, 'album' ),
						'description'         => '',
						'group'               => 'album',
						'panel'               => 'none',
						'default_lowest_role' => $lowest,
						'scopes'              => array( 'global', 'album' ),
						'is_meta_cap'         => in_array( $cap, $meta_caps, true ),
					)
				)
			);
		}
	}

	/**
	 * The three singular CPT caps that WP `map_meta_cap` resolves to the
	 * primitive `edit_post` / `read_post` / `delete_post` checks and that
	 * require a post id when passed to current_user_can().
	 *
	 * @param string $kind 'gallery' | 'album'.
	 * @return string[]
	 */
	private static function cpt_meta_cap_keys( string $kind ): array {
		return array(
			"edit_fotogrids_{$kind}",
			"read_fotogrids_{$kind}",
			"delete_fotogrids_{$kind}",
		);
	}

	/**
	 * Matrix rows for the two collection CPTs.
	 *
	 * The 13 atomic caps WordPress derives per CPT are plumbing: no FotoGrids
	 * code checks them by name, and a site owner reading the matrix cannot act
	 * on the difference between `edit_published_fotogrids_galleries` and
	 * `edit_fotogrids_galleries`. Each row below groups the atomic caps behind
	 * one action, and is checked in the matrix only when a role holds every
	 * cap in `underlying_caps`.
	 */
	private static function register_matrix_caps(): void {
		foreach ( array( 'gallery', 'album' ) as $kind ) {
			foreach ( self::matrix_rows_for( $kind ) as $row ) {
				Permission_Registry::register( new Permission_Definition( $row ) );
			}
		}
	}

	/**
	 * Build the matrix row definitions for one collection type.
	 *
	 * @param string $kind 'gallery' | 'album'.
	 * @return array<int, array<string, mixed>>
	 */
	private static function matrix_rows_for( string $kind ): array {
		$is_gallery = 'gallery' === $kind;

		$rows = array(
			array(
				'key'                 => $is_gallery ? 'fg_gallery_create_edit' : 'fg_album_create_edit',
				'label'               => $is_gallery
					? __( 'Create and edit own galleries', 'fotogrids' )
					: __( 'Create and edit own albums', 'fotogrids' ),
				'description'         => $is_gallery
					? __( 'Create a gallery and edit the ones they own - title, items, captions and item details. Does not cover gallery settings.', 'fotogrids' )
					: __( 'Create an album and edit the ones they own - title and which galleries it holds. Does not cover album settings.', 'fotogrids' ),
				'order'               => 10,
				'default_lowest_role' => 'author',
				'underlying_caps'     => $is_gallery
					? array(
						'edit_fotogrids_gallery',
						'read_fotogrids_gallery',
						'edit_fotogrids_galleries',
						'edit_published_fotogrids_galleries',
					)
					: array(
						'edit_fotogrids_album',
						'read_fotogrids_album',
						'edit_fotogrids_albums',
						'edit_published_fotogrids_albums',
					),
			),
			array(
				'key'                 => $is_gallery ? 'fg_gallery_publish' : 'fg_album_publish',
				'label'               => $is_gallery
					? __( 'Publish galleries', 'fotogrids' )
					: __( 'Publish albums', 'fotogrids' ),
				'description'         => $is_gallery
					? __( 'Take a gallery out of draft so it renders on the front end. Without this a gallery can be built but only submitted for review.', 'fotogrids' )
					: __( 'Take an album out of draft so it renders on the front end. Without this an album can be built but only submitted for review.', 'fotogrids' ),
				'order'               => 20,
				'default_lowest_role' => 'author',
				'underlying_caps'     => $is_gallery
					? array( 'publish_fotogrids_galleries' )
					: array( 'publish_fotogrids_albums' ),
			),
			array(
				'key'                 => $is_gallery ? 'fg_gallery_delete' : 'fg_album_delete',
				'label'               => $is_gallery
					? __( 'Delete own galleries', 'fotogrids' )
					: __( 'Delete own albums', 'fotogrids' ),
				'description'         => $is_gallery
					? __( 'Move galleries they own to the trash, published ones included.', 'fotogrids' )
					: __( 'Move albums they own to the trash, published ones included. The galleries inside are not deleted.', 'fotogrids' ),
				'order'               => 30,
				'default_lowest_role' => 'author',
				'underlying_caps'     => $is_gallery
					? array(
						'delete_fotogrids_gallery',
						'delete_fotogrids_galleries',
						'delete_published_fotogrids_galleries',
					)
					: array(
						'delete_fotogrids_album',
						'delete_fotogrids_albums',
						'delete_published_fotogrids_albums',
					),
			),
			array(
				'key'                 => $is_gallery ? 'fg_gallery_manage_others' : 'fg_album_manage_others',
				'label'               => $is_gallery
					? __( 'Manage galleries created by others', 'fotogrids' )
					: __( 'Manage albums created by others', 'fotogrids' ),
				'description'         => $is_gallery
					? __( "Edit and delete other users' galleries, including private ones.", 'fotogrids' )
					: __( "Edit and delete other users' albums, including private ones.", 'fotogrids' ),
				'order'               => 40,
				'default_lowest_role' => 'editor',
				'underlying_caps'     => $is_gallery
					? array(
						'edit_others_fotogrids_galleries',
						'delete_others_fotogrids_galleries',
						'read_private_fotogrids_galleries',
						'edit_private_fotogrids_galleries',
						'delete_private_fotogrids_galleries',
					)
					: array(
						'edit_others_fotogrids_albums',
						'delete_others_fotogrids_albums',
						'read_private_fotogrids_albums',
						'edit_private_fotogrids_albums',
						'delete_private_fotogrids_albums',
					),
			),
		);

		foreach ( $rows as $index => $row ) {
			$rows[ $index ]['group']  = $kind;
			$rows[ $index ]['panel']  = 'advanced';
			$rows[ $index ]['scopes'] = array( 'global', $kind );
		}

		return $rows;
	}

	/**
	 * Logical caps for Panel 1 - the "lowest role" dropdowns.
	 *
	 * Each one maps to a curated subset of atomic caps. Writing one Panel 1
	 * dropdown writes every atomic cap in `underlying_caps`.
	 */
	private static function register_logical_caps(): void {
		// Galleries - content (create, add and edit items).
		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_gallery_content',
					'label'               => __( 'Create gallery, add and edit gallery items', 'fotogrids' ),
					'description'         => __( 'Lowest role that can create galleries and add, edit, reorder or delete items inside them. Does not include changing layout, lightbox, SEO or other gallery settings.', 'fotogrids' ),
					'group'               => 'gallery',
					'panel'               => 'simple',
					'underlying_caps'     => array(
						'edit_fotogrids_gallery',
						'read_fotogrids_gallery',
						'delete_fotogrids_gallery',
						'edit_fotogrids_galleries',
						'publish_fotogrids_galleries',
						'delete_fotogrids_galleries',
						'edit_published_fotogrids_galleries',
						'delete_published_fotogrids_galleries',
					),
					'default_lowest_role' => 'author',
				)
			)
		);

		// Galleries - settings (Collection Settings + Templates metabox).
		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_gallery_settings',
					'label'               => __( 'Modify gallery settings', 'fotogrids' ),
					'description'         => __( 'Lowest role that can change layout, lightbox, captions, SEO, password, sharing, custom CSS/JS, and apply or save templates on galleries.', 'fotogrids' ),
					'group'               => 'gallery',
					'panel'               => 'simple',
					'underlying_caps'     => array( 'modify_fotogrids_gallery_settings' ),
					'default_lowest_role' => 'administrator',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_others_galleries',
					'label'               => __( 'Manage galleries created by others', 'fotogrids' ),
					'description'         => __( "Lowest role that can edit and delete other users' galleries, including private ones.", 'fotogrids' ),
					'group'               => 'gallery',
					'panel'               => 'simple',
					'underlying_caps'     => array(
						'edit_others_fotogrids_galleries',
						'delete_others_fotogrids_galleries',
						'read_private_fotogrids_galleries',
						'edit_private_fotogrids_galleries',
						'delete_private_fotogrids_galleries',
					),
					'default_lowest_role' => 'editor',
				)
			)
		);

		// Albums - content (create, assign and unassign galleries).
		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_album_content',
					'label'               => __( 'Create album, assign and unassign galleries', 'fotogrids' ),
					'description'         => __( 'Lowest role that can create albums and add or remove galleries from them. Does not include changing album layout or other settings.', 'fotogrids' ),
					'group'               => 'album',
					'panel'               => 'simple',
					'underlying_caps'     => array(
						'edit_fotogrids_album',
						'read_fotogrids_album',
						'delete_fotogrids_album',
						'edit_fotogrids_albums',
						'publish_fotogrids_albums',
						'delete_fotogrids_albums',
						'edit_published_fotogrids_albums',
						'delete_published_fotogrids_albums',
					),
					'default_lowest_role' => 'author',
				)
			)
		);

		// Albums - settings (Collection Settings + Templates metabox).
		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_album_settings',
					'label'               => __( 'Modify album settings', 'fotogrids' ),
					'description'         => __( 'Lowest role that can change album layout, behaviour, SEO, sharing, custom CSS/JS, and apply or save templates on albums.', 'fotogrids' ),
					'group'               => 'album',
					'panel'               => 'simple',
					'underlying_caps'     => array( 'modify_fotogrids_album_settings' ),
					'default_lowest_role' => 'administrator',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_others_albums',
					'label'               => __( 'Manage albums created by others', 'fotogrids' ),
					'description'         => __( "Lowest role that can edit and delete other users' albums, including private ones.", 'fotogrids' ),
					'group'               => 'album',
					'panel'               => 'simple',
					'underlying_caps'     => array(
						'edit_others_fotogrids_albums',
						'delete_others_fotogrids_albums',
						'read_private_fotogrids_albums',
						'edit_private_fotogrids_albums',
						'delete_private_fotogrids_albums',
					),
					'default_lowest_role' => 'editor',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_library',
					'label'               => __( 'Manage library (tags, people, locations)', 'fotogrids' ),
					'description'         => __( 'Lowest role that can manage the FotoGrids media library.', 'fotogrids' ),
					'group'               => 'media',
					'panel'               => 'simple',
					'underlying_caps'     => array( 'manage_fotogrids_library' ),
					'default_lowest_role' => 'editor',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_view_stats',
					'label'               => __( 'View statistics', 'fotogrids' ),
					'description'         => __( 'Lowest role that can view gallery and album statistics.', 'fotogrids' ),
					'group'               => 'stats',
					'panel'               => 'simple',
					'underlying_caps'     => array( 'view_fotogrids_stats' ),
					'default_lowest_role' => 'editor',
				)
			)
		);

		Permission_Registry::register(
			new Permission_Definition(
				array(
					'key'                 => 'fg_manage_settings',
					'label'               => __( 'Manage plugin settings', 'fotogrids' ),
					'description'         => __( 'Lowest role that can change FotoGrids plugin settings.', 'fotogrids' ),
					'group'               => 'plugin',
					'panel'               => 'simple',
					'underlying_caps'     => array( 'manage_fotogrids_settings' ),
					'default_lowest_role' => 'administrator',
				)
			)
		);
	}

	/**
	 * Map every CPT atomic cap to its historical default lowest role.
	 *
	 * Returns: cap_slug => 'administrator' | 'editor' | 'author' | 'contributor'.
	 *
	 * Mirrors Activator::add_capabilities. Single source of truth for the
	 * activator going forward.
	 *
	 * @return array<string, string>
	 */
	public static function cpt_cap_defaults(): array {
		// Authors get basic per-post caps for their own content.
		$author_caps = array(
			'edit_fotogrids_gallery',
			'read_fotogrids_gallery',
			'delete_fotogrids_gallery',
			'edit_fotogrids_galleries',
			'publish_fotogrids_galleries',
			'delete_fotogrids_galleries',
			'edit_fotogrids_album',
			'read_fotogrids_album',
			'delete_fotogrids_album',
			'edit_fotogrids_albums',
			'publish_fotogrids_albums',
			'delete_fotogrids_albums',
		);

		$defaults = array();
		foreach ( array_merge( self::GALLERY_CAPS, self::ALBUM_CAPS ) as $cap ) {
			$defaults[ $cap ] = in_array( $cap, $author_caps, true ) ? 'author' : 'editor';
		}
		return $defaults;
	}

	/**
	 * Turn a CPT cap slug into a short human-readable label, used in the
	 * matrix UI.
	 */
	private static function humanise_cpt_cap( string $cap, string $kind ): string { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter -- Signature mandated by WordPress callback/hook contract; param intentionally unused here.
		// edit_fotogrids_gallery -> "Edit gallery"
		// delete_others_fotogrids_galleries -> "Delete others' galleries"
		$stripped = preg_replace( '/_fotogrids(_(gallery|galleries|album|albums))/', ' $2', $cap );
		$stripped = (string) $stripped;
		$stripped = str_replace( '_', ' ', $stripped );
		$stripped = trim( $stripped );

		// Tidy possessive.
		$stripped = str_replace( ' others ', " others' ", ' ' . $stripped . ' ' );
		$stripped = trim( $stripped );

		return ucfirst( $stripped );
	}
}
