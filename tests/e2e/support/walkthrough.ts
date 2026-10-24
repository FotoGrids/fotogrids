import { expect, request, type Browser, type Locator, type Page } from '@playwright/test';
import path from 'path';
import { authDir, wpEval } from './roles';

/**
 * Walkthrough tours: throwaway first-time users, their stored tour state, and
 * the step bubble.
 */

export const STATE_META = 'fotogrids_walkthroughs';
const PASSWORD = 'fg-walkthrough-password';

export type Tour = 'gallery' | 'album' | 'dashboard';

/** A user who has made nothing yet, signed in, with no tour state. */
export type FreshUser = { login: string; id: number; page: Page; close: () => Promise< void > };

let counter = 0;

/**
 * Create a new user and open a signed-in page for them.
 *
 * @param browser Browser.
 * @param role    WordPress role.
 * @param meta    User meta to set before the first page load.
 */
export async function freshUser(
	browser: Browser,
	role = 'editor',
	meta: Record< string, string > = {}
): Promise< FreshUser > {
	counter += 1;
	const login = `fg-wt-${ Date.now() }-${ counter }`;
	const metaPhp = Object.entries( meta )
		.map( ( [ key, value ] ) => `update_user_meta( $id, ${ JSON.stringify( key ) }, ${ JSON.stringify( value ) } );` )
		.join( ' ' );
	const id = Number(
		wpEval(
			`$id = wp_insert_user( array( 'user_login' => '${ login }', 'user_pass' => '${ PASSWORD }', 'user_email' => '${ login }@example.com', 'role' => '${ role }' ) ); update_user_meta( $id, 'fotogrids_settings_mode', 'advanced' ); ${ metaPhp } echo $id;`
		).trim()
	);

	const baseURL = process.env.WP_BASE_URL;
	const api = await request.newContext( { baseURL } );
	await api.get( '/wp-login.php' );
	await api.post( '/wp-login.php', {
		form: { log: login, pwd: PASSWORD, 'wp-submit': 'Log In', redirect_to: '/wp-admin/', testcookie: '1' },
		maxRedirects: 0,
	} );
	const storageState = path.join( authDir(), `${ login }.json` );
	await api.storageState( { path: storageState } );
	await api.dispose();

	const context = await browser.newContext( { baseURL, storageState } );
	const page = await context.newPage();

	return {
		login,
		id,
		page,
		close: async () => {
			await context.close();
			wpEval( `require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user( ${ id } );` );
		},
	};
}

/** A user's stored tour states. */
export function tourStates( id: number ): Record< string, string > {
	const out = wpEval( `echo wp_json_encode( (array) get_user_meta( ${ id }, '${ STATE_META }', true ) );` ).trim();
	return JSON.parse( out || '{}' );
}

/** Wait until a tour's stored state is `state`. */
export async function expectTourState( id: number, tour: Tour, state: string | undefined ): Promise< void > {
	await expect.poll( () => tourStates( id )[ tour ], { timeout: 10000 } ).toBe( state );
}

/** The step bubble. */
export function bubble( page: Page ): Locator {
	return page.locator( '.fotogrids-walkthrough-bubble' );
}

/** The step bubble showing a given step title. */
export function step( page: Page, title: string ): Locator {
	return page.getByRole( 'dialog', { name: title, exact: true } );
}

/** A button inside the step bubble. */
export function bubbleButton( page: Page, name: string ): Locator {
	return bubble( page ).getByRole( 'button', { name, exact: true } );
}

/** Accept the intro card. */
export async function startFromIntro( page: Page ): Promise< void > {
	await page.getByRole( 'button', { name: 'Start the tour', exact: true } ).click( { timeout: 30000 } );
}
