import type { Page, Response } from '@playwright/test';
import { test, expect } from './support/test';
import { storageStateFor, wpEval } from './support/roles';
import { getOption, setOption } from './support/site';

/**
 * Recently Edited — the WordPress Dashboard widget and the FotoGrids Dashboard
 * card — and the Statistics tables and chart, for users who cannot edit, or
 * cannot read, every collection on the site; and the requests behind those
 * screens and the What's New panel, for users each screen admits.
 *
 * Serial: creates four users, writes both statistics tables and completes the
 * Dashboard setup checklist, and puts all three back.
 */

test.describe.configure( { mode: 'serial' } );

const PASSWORD = 'fg-recent-pass';
const VIEWER = 'fg-recent-viewer';
const AUTHOR = 'fg-recent-author';
const STATS_ONLY = 'fg-recent-stats';
const GALLERY_ONLY = 'fg-recent-galleries';

const OWN = 'Recent: the author’s own gallery';
const ADMIN_PUBLISHED = 'Recent: admin published gallery';
const ADMIN_PRIVATE = 'Recent: admin private gallery';
const ADMIN_PRIVATE_ALBUM = 'Recent: admin private album';
const NEWER = Array.from( { length: 5 }, ( _, i ) => `Recent: admin newer ${ i + 1 }` );

const SETUP_OPTIONS = [ 'fotogrids_watermark_settings', 'fotogrids_watermark_config_hash' ];

type Ids = { own: number; published: number; private: number; album: number; newer: number[] };

let ids: Ids;
let addedSetupOptions = false;

/**
 * Create a collection owned by `login`, modified `age` seconds ago. A negative
 * age dates it ahead of anything else the suite has written.
 */
function collection( login: string, type: string, status: string, title: string, age: number ): string {
	return `fg_recent_make( '${ login }', '${ type }', '${ status }', ${ JSON.stringify( title ) }, ${ age } )`;
}

test.beforeAll( () => {
	addedSetupOptions = null === getOption( SETUP_OPTIONS[ 0 ] );

	const made = wpEval( `
function fg_recent_make( $login, $type, $status, $title, $age ) {
	global $wpdb;
	$id = wp_insert_post( array( 'post_type' => $type, 'post_status' => $status, 'post_title' => $title, 'post_author' => get_user_by( 'login', $login )->ID ) );
	$at = gmdate( 'Y-m-d H:i:s', time() - $age );
	$wpdb->update( $wpdb->posts, array( 'post_modified' => $at, 'post_modified_gmt' => $at ), array( 'ID' => $id ) );
	clean_post_cache( $id );
	return $id;
}

foreach ( array( '${ VIEWER }' => 'subscriber', '${ AUTHOR }' => 'author' ) as $login => $role ) {
	$id = username_exists( $login ) ?: wp_insert_user( array( 'user_login' => $login, 'user_pass' => '${ PASSWORD }', 'user_email' => "$login@example.com", 'role' => $role ) );
	wp_set_password( '${ PASSWORD }', $id );
	( new WP_User( $id ) )->add_cap( 'manage_fotogrids' );
}
( new WP_User( username_exists( '${ AUTHOR }' ) ) )->add_cap( 'view_fotogrids_stats' );

foreach ( array( '${ STATS_ONLY }' => array( 'view_fotogrids_stats' ), '${ GALLERY_ONLY }' => array( 'edit_fotogrids_galleries', 'edit_fotogrids_gallery', 'read_fotogrids_gallery' ) ) as $login => $caps ) {
	$id = username_exists( $login ) ?: wp_insert_user( array( 'user_login' => $login, 'user_pass' => '${ PASSWORD }', 'user_email' => "$login@example.com", 'role' => 'subscriber' ) );
	wp_set_password( '${ PASSWORD }', $id );
	foreach ( $caps as $cap ) {
		( new WP_User( $id ) )->add_cap( $cap );
	}
}

${ addedSetupOptions ? '\\FotoGrids\\Settings\\Watermark_Settings_Store::save( \\FotoGrids\\Settings\\Watermark_Settings_Store::defaults() );' : '' }

$ids = array(
	'own'       => ${ collection( AUTHOR, 'fotogrids_gallery', 'publish', OWN, 3600 ) },
	'published' => ${ collection( 'admin', 'fotogrids_gallery', 'publish', ADMIN_PUBLISHED, 60 ) },
	'private'   => ${ collection( 'admin', 'fotogrids_gallery', 'private', ADMIN_PRIVATE, -200 ) },
	'album'     => ${ collection( 'admin', 'fotogrids_album', 'private', ADMIN_PRIVATE_ALBUM, -190 ) },
	'newer'     => array(),
);
foreach ( ${ JSON.stringify( NEWER ) } as $i => $title ) {
	$ids['newer'][] = fg_recent_make( 'admin', 'fotogrids_gallery', 'publish', $title, -100 - $i );
}

global $wpdb;
foreach ( array( $ids['own'], $ids['published'], $ids['private'] ) as $i => $id ) {
	$views = 900000 - $i;
	$wpdb->insert( $wpdb->prefix . 'fotogrids_statistics', array( 'object_type' => 'gallery', 'object_id' => $id, 'views' => $views, 'shares' => 0, 'last_viewed' => gmdate( 'Y-m-d H:i:s' ) ) );
	$wpdb->insert( $wpdb->prefix . 'fotogrids_statistics_daily', array( 'object_type' => 'gallery', 'object_id' => $id, 'viewed_date' => current_time( 'Y-m-d' ), 'views' => $views, 'shares' => 0 ) );
}

echo wp_json_encode( $ids );` );

	ids = JSON.parse( made.trim().split( '\n' ).pop() as string ) as Ids;
} );

test.afterAll( () => {
	const all = [ ids.own, ids.published, ids.private, ids.album, ...ids.newer ];
	wpEval( `
require_once ABSPATH . 'wp-admin/includes/user.php';
global $wpdb;
$ids = array( ${ all.join( ', ' ) } );
foreach ( array( 'fotogrids_statistics', 'fotogrids_statistics_daily' ) as $table ) {
	$wpdb->query( "DELETE FROM {$wpdb->prefix}{$table} WHERE object_id IN (" . implode( ',', array_map( 'intval', $ids ) ) . ')' );
}
foreach ( $ids as $id ) {
	wp_delete_post( $id, true );
}
foreach ( array( '${ VIEWER }', '${ AUTHOR }', '${ STATS_ONLY }', '${ GALLERY_ONLY }' ) as $login ) {
	$id = username_exists( $login );
	if ( $id ) {
		wp_delete_user( $id );
	}
}` );

	if ( addedSetupOptions ) {
		SETUP_OPTIONS.forEach( ( name ) => setOption( name, null ) );
	}
} );

/** Sign in and land on the WordPress Dashboard, never on profile.php. */
async function signIn( page: Page, login: string ): Promise< void > {
	await page.goto( '/wp-login.php?redirect_to=' + encodeURIComponent( '/wp-admin/' ) );
	await page.locator( '#user_login' ).fill( login );
	await page.locator( '#user_pass' ).fill( PASSWORD );
	await Promise.all( [ page.waitForURL( /\/wp-admin\/$/ ), page.locator( '#wp-submit' ).click() ] );
}

type Row = { title: string; href: string | null };

/** Every Recently Edited row in the Dashboard widget. */
async function widgetRows( page: Page ): Promise< Row[] > {
	const widget = page.locator( '#fotogrids_overview' );
	await expect( widget, 'the FotoGrids widget is not on the Dashboard' ).toBeVisible();

	return widget.locator( '.fotogrids-dw-recent-item-title a' ).evaluateAll( ( links ) =>
		links.map( ( a ) => ( { title: ( a.textContent ?? '' ).trim(), href: a.getAttribute( 'href' ) } ) )
	);
}

/** Every Recently Edited row on the FotoGrids Dashboard. */
async function dashboardRows( page: Page ): Promise< Row[] > {
	await page.goto( '/wp-admin/admin.php?page=fotogrids-dashboard' );

	const rows = page.locator( '.fg-abc-recently-edited-row a' );
	await expect( rows.first(), 'the Recently Edited card has no rows' ).toBeVisible();

	return rows.evaluateAll( ( links ) =>
		links.map( ( a ) => ( {
			title: ( a.querySelector( '.fg-abc-recently-edited-title' )?.textContent ?? '' ).trim(),
			href: a.getAttribute( 'href' ),
		} ) )
	);
}

function expectEveryRowLinked( rows: Row[], where: string ): void {
	for ( const row of rows ) {
		expect( row.href, `${ where }: "${ row.title }" has no edit link` ).toMatch( /\/wp-admin\/post\.php\?post=\d+&action=edit$/ );
	}
}

/** Open an edit link and report the title the editor loaded. */
async function editorTitle( page: Page, href: string ): Promise< string > {
	const response = await page.goto( href );
	expect( response?.status() ).toBe( 200 );

	return page.locator( '#title' ).inputValue();
}

type StatsRow = { title: string; linked: boolean };

/** The Statistics screen: both tables, and the labels the popular chart was given. */
async function statistics( page: Page ): Promise< { tables: StatsRow[][]; chart: string[] } > {
	const popular = page.waitForResponse( ( r: Response ) =>
		decodeURIComponent( r.url() ).includes( '/admin/stats/popular-galleries' )
	);
	const top = page.waitForResponse( ( r: Response ) =>
		decodeURIComponent( r.url() ).includes( '/admin/stats/top-content' )
	);

	await page.goto( '/wp-admin/admin.php?page=fotogrids-stats' );
	const chart = ( ( await ( await popular ).json() ) as { labels: string[] } ).labels;
	await top;

	const tables = page.locator( '.fg-stats-tables table' );
	await expect( tables ).toHaveCount( 2 );
	await expect( tables.first().locator( 'tbody tr' ).first() ).toBeVisible();

	return {
		chart,
		tables: await tables.evaluateAll( ( found ) =>
			found.map( ( table ) =>
				[ ...table.querySelectorAll( 'tbody tr' ) ].map( ( tr ) => ( {
					title: ( tr.querySelector( 'td' )?.textContent ?? '' ).trim(),
					linked: null !== tr.querySelector( 'a.fg-stats-title-link' ),
				} ) )
			)
		),
	};
}

/** Wait for a FotoGrids REST response while `act` runs, and return its status. */
async function restStatus( page: Page, route: string, act: () => Promise< unknown > ): Promise< number > {
	const response = page.waitForResponse( ( r: Response ) =>
		decodeURIComponent( r.url() ).includes( `/fotogrids/v1/${ route }` )
	);
	await act();

	return ( await response ).status();
}

test.describe( 'a user who can edit no collection', () => {
	test.use( { storageState: { cookies: [], origins: [] } } );

	test( 'sees an empty Recently Edited widget, and loading it logs no PHP notice', { tag: [ '@critical', '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await signIn( page, VIEWER );

		expect( await widgetRows( page ) ).toEqual( [] );
		await expect( page.locator( '#fotogrids_overview .fotogrids-dw-recent-list' ) ).toContainText(
			'No recently edited galleries or albums'
		);
	} );

	test( 'gets the widget’s News & Updates', { tag: [ '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		const status = await restStatus( page, 'admin/news', () => signIn( page, VIEWER ) );

		expect( status ).toBe( 200 );
		await expect( page.locator( '#fotogrids_overview' ) ).not.toContainText( 'Unable to load news' );
	} );

	test( 'gets past the setup checklist on the FotoGrids Dashboard to an empty Recently Edited card', { tag: [ '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await signIn( page, VIEWER );

		const status = await restStatus( page, 'admin/stats/overview', () =>
			page.goto( '/wp-admin/admin.php?page=fotogrids-dashboard' )
		);

		expect( status ).toBe( 200 );
		await expect( page.locator( '.fg-abc-recently-edited-empty' ) ).toHaveText(
			'No recently edited galleries or albums.'
		);
	} );
} );

test.describe( 'a user granted only the Statistics screen', () => {
	test.use( { storageState: { cookies: [], origins: [] } } );

	test( 'sees the Statistics screen filled, not refused', { tag: [ '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await signIn( page, STATS_ONLY );

		const { tables, chart } = await statistics( page );

		await expect( page.locator( '.fg-stats-error' ) ).toHaveCount( 0 );
		expect( chart ).toContain( ADMIN_PUBLISHED );
		expect( chart ).not.toContain( ADMIN_PRIVATE );
		for ( const rows of tables ) {
			expect( rows ).toContainEqual( { title: ADMIN_PUBLISHED, linked: false } );
		}
	} );
} );

test.describe( 'a user granted only galleries', () => {
	test.use( { storageState: { cookies: [], origins: [] } } );

	test( 'opens What’s New from the FotoGrids header and gets the news', { tag: [ '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await signIn( page, GALLERY_ONLY );
		await page.goto( '/wp-admin/edit.php?post_type=fotogrids_gallery' );

		const status = await restStatus( page, 'admin/news', () =>
			page.locator( '.fotogrids-splash-modal-open' ).first().click()
		);

		expect( status ).toBe( 200 );
		await expect( page.locator( '.fg-modal' ).last() ).not.toContainText( 'Unable to load the latest news' );
	} );
} );

test.describe( 'an author granted the FotoGrids screens', () => {
	test.use( { storageState: { cookies: [], origins: [] } } );

	test( 'sees only their own collection in Recently Edited, on the widget and the Dashboard, and each row opens it', { tag: [ '@critical', '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await signIn( page, AUTHOR );

		const widget = await widgetRows( page );
		expect( widget.map( ( row ) => row.title ) ).toEqual( [ OWN ] );
		expectEveryRowLinked( widget, 'widget' );

		const card = await dashboardRows( page );
		expect( card.map( ( row ) => row.title ) ).toEqual( [ OWN ] );
		expectEveryRowLinked( card, 'Dashboard' );

		expect( await editorTitle( page, widget[ 0 ].href as string ) ).toBe( OWN );
	} );

	test( 'does not see the titles of collections they cannot read in Statistics, and only their own rows link', { tag: [ '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await signIn( page, AUTHOR );

		const { tables, chart } = await statistics( page );

		expect( chart ).toContain( OWN );
		expect( chart ).toContain( ADMIN_PUBLISHED );
		expect( chart ).not.toContain( ADMIN_PRIVATE );

		for ( const rows of tables ) {
			const titles = rows.map( ( row ) => row.title );
			expect( titles ).not.toContain( ADMIN_PRIVATE );
			expect( rows ).toContainEqual( { title: OWN, linked: true } );
			expect( rows ).toContainEqual( { title: ADMIN_PUBLISHED, linked: false } );
		}
	} );
} );

test.describe( 'an administrator', () => {
	test.use( { storageState: storageStateFor( 'administrator' ) } );

	test( 'still sees and opens every collection, private ones included', { tag: [ '@api', '@admin', '@permissions' ] }, async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/' );

		const newest = [ ADMIN_PRIVATE, ADMIN_PRIVATE_ALBUM, NEWER[ 4 ], NEWER[ 3 ], NEWER[ 2 ] ];

		const widget = await widgetRows( page );
		expectEveryRowLinked( widget, 'widget' );
		expect( widget.map( ( row ) => row.title ) ).toEqual( newest );

		const card = await dashboardRows( page );
		expectEveryRowLinked( card, 'Dashboard' );
		expect( card.map( ( row ) => row.title ) ).toEqual( newest );

		expect( await editorTitle( page, widget[ 0 ].href as string ) ).toBe( ADMIN_PRIVATE );

		const { tables, chart } = await statistics( page );
		expect( chart ).toContain( ADMIN_PRIVATE );
		for ( const rows of tables ) {
			expect( rows ).toContainEqual( { title: ADMIN_PRIVATE, linked: true } );
			expect( rows ).toContainEqual( { title: OWN, linked: true } );
		}
	} );
} );
