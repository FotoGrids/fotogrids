import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor } from './support/roles';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * The FotoGrids row on the Plugins screen keeps WordPress's action-link keys,
 * which WordPress renders as the class of each link's span.
 *
 * Serial: one test installs an mu-plugin that makes Pro look active.
 */

test.describe.configure( { mode: 'serial' } );

const MU_PLUGIN = path.join(
	process.env.WP_PATH ?? '',
	'wp-content',
	'mu-plugins',
	'fg-e2e-pro-active.php'
);

function row( page: Page ): Locator {
	return page.locator( 'tr[data-slug="fotogrids"] .row-actions > span' );
}

async function actionKeys( page: Page ): Promise< string[] > {
	await page.goto( '/wp-admin/plugins.php' );
	return row( page ).evaluateAll( ( spans ) => spans.map( ( span ) => span.className ) );
}

test.afterEach( () => {
	if ( existsSync( MU_PLUGIN ) ) {
		unlinkSync( MU_PLUGIN );
	}
} );

test( 'the row keeps its action-link keys in order', { tag: '@admin' }, async ( { page } ) => {
	expect( await actionKeys( page ) ).toEqual( [ 'settings', 'deactivate', 'get-pro' ] );

	await expect( page.locator( 'tr[data-slug="fotogrids"] .deactivate > a#deactivate-fotogrids' ) ).toHaveCount( 1 );
	await expect( row( page ).filter( { hasText: 'Settings' } ) ).toHaveClass( 'settings' );
	await expect( row( page ).filter( { hasText: 'Get FotoGrids Pro' } ) ).toHaveClass( 'get-pro' );
} );

test( 'with Pro active the row has no Get Pro link', { tag: '@admin' }, async ( { page } ) => {
	mkdirSync( path.dirname( MU_PLUGIN ), { recursive: true } );
	writeFileSync( MU_PLUGIN, "<?php\ndefine( 'FOTOGRIDS_PRO_VERSION', '0.0.0-e2e' );\n" );

	expect( await actionKeys( page ) ).toEqual( [ 'settings', 'deactivate' ] );
} );

test( 'Deactivate opens only the FotoGrids feedback dialog', { tag: '@admin' }, async ( { page } ) => {
	await page.goto( '/wp-admin/plugins.php' );
	await page.click( '#deactivate-fotogrids' );

	const dialog = page.getByRole( 'dialog' );
	await expect( dialog ).toHaveCount( 1 );
	await expect( dialog.getByRole( 'button', { name: 'Skip & Deactivate' } ) ).toBeVisible();
	await expect( page.locator( '.fs-modal:visible' ), 'the SDK deactivation form opened as well' ).toHaveCount( 0 );

	await dialog.getByRole( 'button', { name: 'Cancel' } ).click();
	await expect( dialog ).toHaveCount( 0 );
	await expect( page.locator( 'tr[data-slug="fotogrids"]' ) ).toHaveClass( /\bactive\b/ );
} );
