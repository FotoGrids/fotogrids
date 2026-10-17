<?php
/**
 * Reaching post-new.php for galleries and albums, checked with core's own
 * admin-page access test against the menu the plugin registers.
 *
 * @package FotoGrids
 */

use FotoGrids\Admin_Init;

class CollectionAddNewAccessTest extends WP_UnitTestCase {

	private const TYPES = array( 'fotogrids_gallery', 'fotogrids_album' );

	private const MENU_GLOBALS = array(
		'menu',
		'submenu',
		'_wp_submenu_nopriv',
		'_wp_menu_nopriv',
		'_wp_real_parent_file',
		'_registered_pages',
		'_parent_pages',
		'admin_page_hooks',
		'pagenow',
		'typenow',
		'plugin_page',
		'parent_file',
		'post_type',
		'submenu_file',
	);

	private array $saved = array();

	public static function set_up_before_class(): void {
		parent::set_up_before_class();

		require_once ABSPATH . 'wp-admin/includes/plugin.php';
		require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-admin-init.php';
	}

	public function set_up(): void {
		parent::set_up();

		foreach ( self::MENU_GLOBALS as $name ) {
			$this->saved[ $name ] = $GLOBALS[ $name ] ?? null;
		}
	}

	public function tear_down(): void {
		foreach ( $this->saved as $name => $value ) {
			$GLOBALS[ $name ] = $value;
		}

		parent::tear_down();
	}

	/** A subscriber granted the caps a role editor gives a one-type role. */
	private function one_type_user( string $one, string $many ): int {
		$id   = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		$user = get_user_by( 'id', $id );
		foreach ( array( "edit_fotogrids_{$one}", "read_fotogrids_{$one}", "delete_fotogrids_{$one}", "edit_fotogrids_{$many}", "publish_fotogrids_{$many}", "delete_fotogrids_{$many}" ) as $cap ) {
			$user->add_cap( $cap );
		}

		return $id;
	}

	private function user( string $who ): int {
		switch ( $who ) {
			case 'gallery-only':
				return $this->one_type_user( 'gallery', 'galleries' );
			case 'album-only':
				return $this->one_type_user( 'album', 'albums' );
			default:
				return self::factory()->user->create( array( 'role' => $who ) );
		}
	}

	/**
	 * The menu as wp-admin/menu.php leaves it for $user_id: core's Posts menu,
	 * the FotoGrids menu, and entries the user cannot reach moved to the
	 * no-privilege list.
	 */
	private function build_menu( int $user_id ): void {
		global $menu, $submenu, $_wp_submenu_nopriv, $_wp_menu_nopriv, $_wp_real_parent_file, $_registered_pages, $_parent_pages, $admin_page_hooks;

		wp_set_current_user( $user_id );

		$menu                 = array( 5 => array( 'Posts', 'edit_posts', 'edit.php', '', 'menu-top menu-icon-post', 'menu-posts', 'dashicons-admin-post' ) );
		$submenu              = array(
			'edit.php' => array(
				5  => array( 'All Posts', 'edit_posts', 'edit.php' ),
				10 => array( 'Add New Post', 'edit_posts', 'post-new.php' ),
			),
		);
		$_wp_submenu_nopriv   = array();
		$_wp_menu_nopriv      = array();
		$_wp_real_parent_file = array();
		$_registered_pages    = array();
		$_parent_pages        = array();
		$admin_page_hooks     = array();

		Admin_Init::add_admin_menu();

		foreach ( $submenu as $parent => $items ) {
			foreach ( $items as $index => $item ) {
				if ( ! current_user_can( $item[1] ) ) {
					unset( $submenu[ $parent ][ $index ] );
					$_wp_submenu_nopriv[ $parent ][ $item[2] ] = true;
				}
			}
		}
	}

	/** Core's access check for post-new.php?post_type=$type. */
	private function can_access_add_new( string $type ): bool {
		global $pagenow, $typenow, $plugin_page, $parent_file;

		$pagenow     = 'post-new.php';
		$typenow     = $type;
		$plugin_page = null;
		$parent_file = null;

		return user_can_access_admin_page();
	}

	/** Whether $user_id may open each type's Add New: core's access check and post-new.php's own create_posts check. */
	private function add_new_access( int $user_id ): array {
		$this->build_menu( $user_id );

		$access = array();
		foreach ( self::TYPES as $type ) {
			$access[ $type ] = $this->can_access_add_new( $type )
				&& current_user_can( get_post_type_object( $type )->cap->create_posts );
		}

		return $access;
	}

	public function users(): array {
		return array(
			'gallery-only'  => array( 'gallery-only', true, false ),
			'album-only'    => array( 'album-only', false, true ),
			'administrator' => array( 'administrator', true, true ),
			'editor'        => array( 'editor', true, true ),
			'author'        => array( 'author', true, true ),
			'contributor'   => array( 'contributor', false, false ),
			'subscriber'    => array( 'subscriber', false, false ),
		);
	}

	/**
	 * @dataProvider users
	 */
	public function test_add_new_access( string $who, bool $gallery, bool $album ): void {
		$this->assertSame(
			array(
				'fotogrids_gallery' => $gallery,
				'fotogrids_album'   => $album,
			),
			$this->add_new_access( $this->user( $who ) )
		);
	}

	/**
	 * @dataProvider users
	 */
	public function test_each_add_new_follows_its_own_list( string $who, bool $gallery, bool $album ): void {
		global $submenu;

		$this->build_menu( $this->user( $who ) );

		$visible  = array_column( $submenu['fotogrids'] ?? array(), 2 );
		$expected = array();
		foreach ( array( 'fotogrids_gallery' => $gallery, 'fotogrids_album' => $album ) as $type => $can_create ) {
			if ( in_array( "edit.php?post_type=$type", $visible, true ) ) {
				$expected[] = "edit.php?post_type=$type";
			}
			if ( $can_create ) {
				$expected[] = "post-new.php?post_type=$type";
			}
		}

		$collection_entries = array_values(
			array_filter(
				$visible,
				static function ( $slug ) {
					return 1 === preg_match( '/^(edit|post-new)\.php\?post_type=fotogrids_/', $slug );
				}
			)
		);

		$this->assertSame( $expected, $collection_entries );
	}

	public function test_the_add_new_entry_is_labelled_add_new(): void {
		global $submenu;

		$this->build_menu( $this->user( 'administrator' ) );

		foreach ( $submenu['fotogrids'] as $item ) {
			if ( 0 === strpos( $item[2], 'post-new.php?post_type=fotogrids_' ) ) {
				$this->assertSame( 'Add New', $item[0], $item[2] );
			}
		}
	}

	public function screens(): array {
		return array(
			'gallery list'    => array( 'edit.php', 'fotogrids_gallery', 'edit.php?post_type=fotogrids_gallery' ),
			'gallery add new' => array( 'post-new.php', 'fotogrids_gallery', 'post-new.php?post_type=fotogrids_gallery' ),
			'gallery edit'    => array( 'post.php', 'fotogrids_gallery', 'edit.php?post_type=fotogrids_gallery' ),
			'album list'      => array( 'edit.php', 'fotogrids_album', 'edit.php?post_type=fotogrids_album' ),
			'album add new'   => array( 'post-new.php', 'fotogrids_album', 'post-new.php?post_type=fotogrids_album' ),
			'album edit'      => array( 'post.php', 'fotogrids_album', 'edit.php?post_type=fotogrids_album' ),
		);
	}

	/**
	 * @dataProvider screens
	 */
	public function test_the_current_screen_is_highlighted( string $screen, string $type, string $highlighted ): void {
		global $pagenow, $post_type, $parent_file, $submenu_file;

		$pagenow   = $screen;
		$post_type = $type;

		Admin_Init::fix_menu_highlighting();

		$this->assertSame( 'fotogrids', $parent_file );
		$this->assertSame( $highlighted, $submenu_file );
	}

	public function test_the_add_new_marker_is_styled_on_every_admin_screen(): void {
		Admin_Init::enqueue_admin_chrome_styles( 'index.php' );

		$css = implode( '', (array) wp_styles()->get_data( 'fotogrids-admin-chrome', 'after' ) );

		$this->assertStringContainsString( 'a[href^="post-new.php?post_type=fotogrids_"]::before', $css );
		$this->assertStringContainsString( '"\\21B3" / ""', $css );

		wp_deregister_style( 'fotogrids-admin-chrome' );
	}

	public function test_only_the_types_a_role_can_create_are_registered(): void {
		global $submenu;

		$this->build_menu( $this->user( 'gallery-only' ) );

		$registered = array();
		foreach ( $submenu as $items ) {
			foreach ( $items as $item ) {
				if ( 0 === strpos( $item[2], 'post-new.php?post_type=fotogrids_' ) ) {
					$registered[] = $item[2];
				}
			}
		}

		$this->assertSame( array( 'post-new.php?post_type=fotogrids_gallery' ), $registered );
	}

	public function test_without_the_entries_core_refuses_a_role_lacking_edit_posts(): void {
		global $submenu;

		$this->build_menu( $this->user( 'gallery-only' ) );

		foreach ( $submenu as $parent => $items ) {
			foreach ( $items as $index => $item ) {
				if ( 0 === strpos( $item[2], 'post-new.php?post_type=' ) ) {
					unset( $submenu[ $parent ][ $index ] );
				}
			}
		}

		$this->assertFalse( $this->can_access_add_new( 'fotogrids_gallery' ) );
	}
}
