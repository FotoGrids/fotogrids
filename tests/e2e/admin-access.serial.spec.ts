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

/** The plugin's admin pages, by the capability each is registered under. */
const PAGES = {
	'fotogrids-dashboard': 'manage_fotogrids',
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

	// Library and Statistics sit under caps an editor holds; their parent does not.
	test( 'ROLE-02: reaches Library and Statistics without the parent menu', { tag: [ '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/' );

		const labels = ( await menuItems( page ).allInnerTexts() ).join( '\n' );

		expect( labels, 'the top-level FotoGrids menu is visible to an editor' ).not.toContain(
			'Dashboard'
		);

		expect( await reach( page, 'fotogrids-library' ) ).toBe( 'served' );
		expect( await reach( page, 'fotogrids-stats' ) ).toBe( 'served' );

		expect( await reach( page, 'fotogrids-settings' ) ).toBe( 'refused' );
		expect( await reach( page, 'fotogrids-tools' ) ).toBe( 'refused' );
	} );
} );

test.describe( 'an author', () => {
	test.use( {
		storageState: storageStateFor( 'author' ),
		allowConsoleErrors: 'a refused screen answers 403, which the browser logs',
	} );

	// The parent needs a cap an author lacks, so WordPress promotes the first
	// submenu they can reach, under the plugin's name.
	test( 'ROLE-03: the promoted menu entry points at Galleries', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		await page.goto( '/wp-admin/' );

		await expect(
			page.locator( '#adminmenu a[href*="fotogrids"]' ).first()
		).toHaveAttribute( 'href', /post_type=fotogrids_gallery/ );
	} );

	test( 'ROLE-03: reaches the gallery list that entry links to', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		test.fail(
			true,
			'the screen an author is offered answers 403 — FotoGrids/backstage#382'
		);

		const response = await page.goto( '/wp-admin/edit.php?post_type=fotogrids_gallery' );

		expect( response?.status() ).toBe( 200 );
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
		} );
	} );
}
