import { test, expect } from './support/test';
import { fixture } from './support/fixtures';
import { storageStateFor } from './support/roles';
import type { Role } from './support/roles';

/**
 * ROLE-01 to ROLE-05. Which admin screens each role sees and can reach.
 *
 * Menu and URL are separate questions: a submenu whose parent is hidden still
 * has a page behind it, so each role is checked both ways.
 *
 * Serial: five users against one site.
 */

test.describe.configure( { mode: 'serial' } );

/**
 * The plugin's admin pages, by the capability each is registered under. The
 * Dashboard follows the menu: the first of these the user holds.
 */
const PAGES = {
	'fotogrids-dashboard': 'manage_fotogrids | edit_fotogrids_galleries | edit_fotogrids_albums',
	'fotogrids-templates': 'manage_fotogrids',
	'fotogrids-library': 'manage_fotogrids_library',
	'fotogrids-stats': 'view_fotogrids_stats',
	'fotogrids-settings': 'manage_fotogrids_settings',
	'fotogrids-tools': 'manage_fotogrids',
} as const;

const MENU = '#adminmenu';

function menuItems( page: import( '@playwright/test' ).Page ) {
	return page.locator( `${ MENU } a[href*="fotogrids"]` );
}

/** Whether the screen was served. A refusal is 403; its wording is not a contract. */
async function reach(
	page: import( '@playwright/test' ).Page,
	slug: string
): Promise< 'served' | 'refused' > {
	const response = await page.goto( `/wp-admin/admin.php?page=${ slug }` );

	return 403 === response?.status() ? 'refused' : 'served';
}

/** The same question for a post type's list screen. */
async function reachList(
	page: import( '@playwright/test' ).Page,
	postType: 'fotogrids_gallery' | 'fotogrids_album'
): Promise< 'served' | 'refused' > {
	const response = await page.goto( `/wp-admin/edit.php?post_type=${ postType }` );

	return 403 === response?.status() ? 'refused' : 'served';
}

test.describe( 'an administrator', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	test( 'ROLE-01: sees the plugin menu and reaches every page behind it', { tag: [ '@critical', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/' );

		const labels = await menuItems( page ).allInnerTexts();
		for ( const label of [ 'Dashboard', 'Galleries', 'Albums', 'Templates', 'Library', 'Statistics', 'Settings', 'Tools' ] ) {
			expect( labels.join( '\n' ), `${ label } is missing from the menu` ).toContain( label );
		}

		for ( const slug of Object.keys( PAGES ) ) {
			expect( await reach( page, slug ), slug ).toBe( 'served' );
		}
	} );
} );

test.describe( 'an editor', () => {
	test.use( {
		storageState: storageStateFor( 'editor' ),
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	test( 'ROLE-02: sees the Dashboard and reaches it, Library and Statistics, not Templates, Settings or Tools', { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/' );

		const labels = ( await menuItems( page ).allInnerTexts() ).join( '\n' );

		expect( labels, "the Dashboard is missing from the editor's menu" ).toContain( 'Dashboard' );

		expect( await reach( page, 'fotogrids' ) ).toBe( 'served' );
		expect( await reach( page, 'fotogrids-dashboard' ) ).toBe( 'served' );
		expect( await reach( page, 'fotogrids-library' ) ).toBe( 'served' );
		expect( await reach( page, 'fotogrids-stats' ) ).toBe( 'served' );
		expect( await reachList( page, 'fotogrids_gallery' ) ).toBe( 'served' );
		expect( await reachList( page, 'fotogrids_album' ) ).toBe( 'served' );

		expect( await reach( page, 'fotogrids-templates' ) ).toBe( 'refused' );
		expect( await reach( page, 'fotogrids-settings' ) ).toBe( 'refused' );
		expect( await reach( page, 'fotogrids-tools' ) ).toBe( 'refused' );
	} );
} );

test.describe( 'an author', () => {
	test.use( {
		storageState: storageStateFor( 'author' ),
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	test( 'ROLE-03: the top-level menu entry points at the Dashboard', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		await page.goto( '/wp-admin/' );

		await expect(
			page.locator( '#adminmenu a[href*="fotogrids"]' ).first()
		).toHaveAttribute( 'href', /page=fotogrids-dashboard/ );
	} );

	test( 'ROLE-03: reaches the Dashboard, Statistics and both lists, not Templates, Library, Settings or Tools', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		expect( await reachList( page, 'fotogrids_gallery' ) ).toBe( 'served' );
		expect( await reachList( page, 'fotogrids_album' ) ).toBe( 'served' );
		expect( await reach( page, 'fotogrids' ) ).toBe( 'served' );
		expect( await reach( page, 'fotogrids-dashboard' ) ).toBe( 'served' );
		expect( await reach( page, 'fotogrids-stats' ) ).toBe( 'served' );

		for ( const slug of [ 'fotogrids-templates', 'fotogrids-library', 'fotogrids-settings', 'fotogrids-tools' ] ) {
			expect( await reach( page, slug ), slug ).toBe( 'refused' );
		}
	} );

	test( 'ROLE-04: cannot open a gallery someone else owns', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		const id = fixture< number >( 'F-small', 'gallery' );

		const response = await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );

		expect( response?.status(), 'an author was served a gallery they do not own' ).toBe(
			403
		);
	} );
} );

for ( const role of [ 'contributor', 'subscriber' ] as const satisfies readonly Role[] ) {
	test.describe( `a ${ role }`, () => {
		test.use( {
			storageState: storageStateFor( role ),
			allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
		} );

		test( `ROLE-05: is refused every plugin page`, { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
			for ( const slug of Object.keys( PAGES ) ) {
				expect( await reach( page, slug ), `${ role } reached ${ slug }` ).toBe(
					'refused'
				);
			}

			for ( const postType of [ 'fotogrids_gallery', 'fotogrids_album' ] ) {
				for ( const screen of [ 'edit.php', 'post-new.php' ] ) {
					const response = await page.goto( `/wp-admin/${ screen }?post_type=${ postType }` );
					expect( response?.status(), `${ role } reached ${ screen } for ${ postType }` ).toBe( 403 );
				}
			}
		} );
	} );
}
