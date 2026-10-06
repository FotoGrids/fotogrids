import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { roles as sessions, storageStateFor, wpEval } from './support/roles';
import type { Role } from './support/roles';
import { restoreRoles, snapshotRoles } from './support/site';

/**
 * MENU-01 to MENU-07. Reaching the Galleries and Albums screens through the
 * FotoGrids menu, for every role the menu is shown to.
 *
 * Serial: creates users, roles and collections, and grants capabilities.
 */

test.describe.configure( { mode: 'serial' } );

const PASSWORD = 'fg-menu-pass';

type Kind = 'fotogrids_gallery' | 'fotogrids_album';

const LISTS: Record< Kind, string > = {
	fotogrids_gallery: 'Galleries',
	fotogrids_album: 'Albums',
};

function fotogridsMenu( page: Page ) {
	return page
		.locator( '#adminmenu li.menu-top' )
		.filter( { has: page.locator( 'a.menu-top', { hasText: 'FotoGrids' } ) } );
}

/** Click a link and return the response the navigation lands on. */
async function follow( page: Page, click: () => Promise< void > ): Promise< Response > {
	const landed = page.waitForResponse(
		( r ) => r.request().isNavigationRequest() && r.request().frame() === page.mainFrame()
	);
	await click();
	return landed;
}

/** Open a FotoGrids submenu entry the way a user does: hover, then click. */
async function openFromMenu( page: Page, label: string ): Promise< Response > {
	await page.goto( '/wp-admin/' );

	const menu = fotogridsMenu( page );
	await menu.hover();

	return follow( page, () =>
		menu.locator( '.wp-submenu' ).getByRole( 'link', { name: label, exact: true } ).click()
	);
}

/** The list screen is served, titled, and highlighted in the menu. */
async function expectList( page: Page, response: Response, kind: Kind ) {
	expect( response.status(), `${ LISTS[ kind ] } answered ${ response.status() }` ).toBe( 200 );
	expect( page.url() ).toContain( `post_type=${ kind }` );
	await expect( page.locator( '.wrap h1' ).first() ).toContainText( LISTS[ kind ] );

	const menu = fotogridsMenu( page );
	await expect( menu ).toHaveClass( /wp-has-current-submenu/ );
	await expect( menu.locator( '.wp-submenu li.current a' ) ).toHaveText( LISTS[ kind ] );
}

/** Insert a published collection owned by `login`; returns its id. */
function insertCollection( kind: Kind, title: string, login: string ): number {
	return Number(
		wpEval(
			`echo wp_insert_post( array( 'post_type' => '${ kind }', 'post_status' => 'publish', 'post_title' => '${ title }', 'post_author' => get_user_by( 'login', '${ login }' )->ID ) );`
		).trim()
	);
}

function deletePosts( ids: number[] ): void {
	if ( ids.length ) {
		wpEval( `foreach ( array( ${ ids.join( ',' ) } ) as $id ) { wp_delete_post( $id, true ); }` );
	}
}

/** Row ids in the list table currently on screen. */
async function listedIds( page: Page ): Promise< number[] > {
	const ids = await page.locator( '#the-list tr[id^="post-"]' ).evaluateAll( ( rows ) =>
		rows.map( ( row ) => Number( row.id.replace( 'post-', '' ) ) )
	);
	return ids;
}

for ( const role of [ 'administrator', 'editor', 'author' ] as const satisfies readonly Role[] ) {
	test.describe( `as ${ role }`, () => {
		test.use( { storageState: storageStateFor( role ) } );

		test( `MENU-01: opens Galleries and Albums from the FotoGrids menu`, { tag: [ '@critical', '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			for ( const kind of Object.keys( LISTS ) as Kind[] ) {
				const response = await openFromMenu( page, LISTS[ kind ] );
				await expectList( page, response, kind );
			}
		} );

		test( `MENU-02: the top-level FotoGrids entry lands on a screen they can use`, { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			await page.goto( '/wp-admin/' );

			const top = fotogridsMenu( page ).locator( 'a.menu-top' );
			const response = await follow( page, () => top.click() );

			expect( response.status() ).toBe( 200 );

			if ( 'administrator' === role ) {
				expect( page.url() ).toContain( 'page=fotogrids-dashboard' );
			} else {
				await expectList( page, response, 'fotogrids_gallery' );
			}
		} );
	} );
}

test.describe( 'an author', () => {
	test.use( { storageState: storageStateFor( 'author' ) } );

	const created: number[] = [];

	test.afterAll( () => {
		deletePosts( created );
	} );

	test( 'MENU-03: the gallery list opens on their own galleries, and All shows the rest read-only', { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		const { author, administrator } = sessions().roles;

		const own = insertCollection( 'fotogrids_gallery', 'MENU-03 own gallery', author.user );
		const others = insertCollection(
			'fotogrids_gallery',
			'MENU-03 admin gallery',
			administrator.user
		);
		created.push( own, others );

		await page.goto( '/wp-admin/edit.php?post_type=fotogrids_gallery' );

		const mine = await listedIds( page );
		expect( mine ).toContain( own );
		expect( mine ).not.toContain( others );

		await page.goto( '/wp-admin/edit.php?post_type=fotogrids_gallery&all_posts=1' );

		expect( await listedIds( page ) ).toContain( others );
		await expect( page.locator( `#post-${ others } a.row-title` ) ).toHaveCount( 0 );
	} );

	test( 'MENU-04: a gallery they publish from Add New appears in their list', { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		const title = `MENU-04 ${ Date.now() }`;

		await page.goto( '/wp-admin/post-new.php?post_type=fotogrids_gallery' );
		await page.locator( '#title' ).fill( title );
		await follow( page, () => page.locator( '#publish' ).click() );

		const id = Number(
			wpEval(
				`$p = get_posts( array( 'post_type' => 'fotogrids_gallery', 'title' => '${ title }', 'fields' => 'ids', 'post_status' => 'any' ) ); echo $p ? $p[0] : 0;`
			).trim()
		);
		expect( id, 'the gallery was not saved' ).toBeGreaterThan( 0 );
		created.push( id );

		const response = await openFromMenu( page, 'Galleries' );
		await expectList( page, response, 'fotogrids_gallery' );
		expect( await listedIds( page ) ).toContain( id );
	} );
} );

test.describe( 'a role holding only one collection type', () => {
	// Signs in per test as a user created here.
	test.use( {
		storageState: { cookies: [], origins: [] },
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	let roles: string;

	test.beforeAll( () => {
		roles = snapshotRoles();
		wpEval( `
foreach ( array( 'gallery' => 'galleries', 'album' => 'albums' ) as $one => $many ) {
	$caps = array( 'read' => true );
	foreach ( array( "edit_fotogrids_{$one}", "read_fotogrids_{$one}", "delete_fotogrids_{$one}", "edit_fotogrids_{$many}", "publish_fotogrids_{$many}", "delete_fotogrids_{$many}" ) as $cap ) {
		$caps[ $cap ] = true;
	}
	add_role( "fg_menu_{$one}_only", "FG {$one} only", $caps );
	$id = username_exists( "fg-menu-{$one}" ) ?: wp_insert_user( array( 'user_login' => "fg-menu-{$one}", 'user_pass' => '${ PASSWORD }', 'user_email' => "fg-menu-{$one}@example.com" ) );
	( new WP_User( $id ) )->set_role( "fg_menu_{$one}_only" );
	wp_set_password( '${ PASSWORD }', $id );
}` );
	} );

	test.afterAll( () => {
		wpEval( `
require_once ABSPATH . 'wp-admin/includes/user.php';
foreach ( array( 'gallery', 'album' ) as $one ) {
	$id = username_exists( "fg-menu-{$one}" );
	if ( $id ) { wp_delete_user( $id ); }
}` );
		restoreRoles( roles );
	} );

	async function signIn( page: Page, login: string ) {
		await page.goto( '/wp-login.php' );
		await page.locator( '#user_login' ).fill( login );
		await page.locator( '#user_pass' ).fill( PASSWORD );
		await follow( page, () => page.locator( '#wp-submit' ).click() );
	}

	for ( const [ one, kind, other ] of [
		[ 'gallery', 'fotogrids_gallery', 'fotogrids_album' ],
		[ 'album', 'fotogrids_album', 'fotogrids_gallery' ],
	] as const ) {
		test( `MENU-05: a ${ one }-only role - the menu leads to their list and nowhere else`, { tag: [ '@admin', '@permissions' ] }, async ( {
			page,
		} ) => {
			await signIn( page, `fg-menu-${ one }` );
			await page.goto( '/wp-admin/' );

			const links = await fotogridsMenu( page )
				.locator( '.wp-submenu a' )
				.allInnerTexts();
			expect( links ).toEqual( [ LISTS[ kind ] ] );

			const top = fotogridsMenu( page ).locator( 'a.menu-top' );
			const response = await follow( page, () => top.click() );
			await expectList( page, response, kind );

			const refused = await page.goto( `/wp-admin/edit.php?post_type=${ other }` );
			expect( refused?.status() ).toBe( 403 );

			const dashboard = await page.goto( '/wp-admin/admin.php?page=fotogrids' );
			expect( dashboard?.status() ).toBe( 403 );
		} );
	}
} );

test.describe( 'an editor granted manage_fotogrids', () => {
	test.use( { storageState: storageStateFor( 'editor' ) } );

	let roles: string;

	test.beforeAll( () => {
		roles = snapshotRoles();
		wpEval( "get_role( 'editor' )->add_cap( 'manage_fotogrids' );" );
	} );

	test.afterAll( () => {
		restoreRoles( roles );
	} );

	test( 'MENU-06: gets the Dashboard back as the top-level entry', { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/' );

		const top = fotogridsMenu( page ).locator( 'a.menu-top' );
		await expect( top ).toHaveAttribute( 'href', /page=fotogrids-dashboard/ );

		const response = await follow( page, () => top.click() );
		expect( response.status() ).toBe( 200 );

		const dashboard = await page.goto( '/wp-admin/admin.php?page=fotogrids' );
		expect( dashboard?.status() ).toBe( 200 );
	} );
} );

test.describe( 'an editor and an author', () => {
	test.use( {
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	for ( const role of [ 'editor', 'author' ] as const satisfies readonly Role[] ) {
		test.describe( role, () => {
			test.use( { storageState: storageStateFor( role ) } );

			test( `MENU-07: ${ role } is refused the Dashboard by every URL`, { tag: [ '@admin', '@permissions' ] }, async ( {
				page,
			} ) => {
				for ( const slug of [ 'fotogrids', 'fotogrids-dashboard' ] ) {
					const response = await page.goto( `/wp-admin/admin.php?page=${ slug }` );
					expect( response?.status(), slug ).toBe( 403 );
				}
			} );
		} );
	}
} );
