import { execFileSync } from 'child_process';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { wpCli, wpEval } from './support/roles';

/**
 * A view page's document head carries one title, one viewport meta, one
 * canonical link and one robots meta, in both layout modes, on a block theme
 * and on a classic one.
 *
 * Serial: it switches the active theme and the site-wide view page layout mode.
 */

test.describe.configure( { mode: 'serial' } );

const THEMES = [ 'twentytwentyfive', 'twentytwentyone' ] as const;
const MODES = [ 'integrated', 'standalone' ] as const;

type Target = { id: number; view: string };

let savedTheme = '';
let viewSettings: string | null;
let gallery: Target;
let albumTarget: Target;

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

function setLayoutMode( mode: string ): void {
	wpEval(
		`$s = get_option( 'fotogrids_view_settings', array() ); if ( ! is_array( $s ) ) { $s = array(); } $s['layout_mode'] = '${ mode }'; update_option( 'fotogrids_view_settings', $s );`
	);
}

/** The head tags a crawler reads, as the server sent them. */
async function head( request: APIRequestContext, url: string ) {
	const response = await request.get( url );
	expect( response.ok() ).toBe( true );

	const markup = ( await response.text() ).split( '</head>' )[ 0 ];
	const canonicals = markup.match( /<link[^>]+rel=["']canonical["'][^>]*>/g ) ?? [];
	const robots = markup.match( /<meta[^>]+name=["']robots["'][^>]*>/g ) ?? [];

	return {
		titles: ( markup.match( /<title[\s>]/g ) ?? [] ).length,
		viewports: ( markup.match( /<meta[^>]+name=["']viewport["']/g ) ?? [] ).length,
		canonicals: canonicals.map( ( tag ) => ( tag.match( /href=["']([^"']+)/ ) ?? [] )[ 1 ] ),
		robots: robots.map( ( tag ) => ( tag.match( /content=["']([^"']*)/ ) ?? [] )[ 1 ] ),
		ogTitles: ( markup.match( /property=["']og:title["']/g ) ?? [] ).length,
	};
}

test.use( { storageState: { cookies: [], origins: [] } } );

test.beforeAll( () => {
	savedTheme = wp( [ 'theme', 'list', '--status=active', '--field=name' ] );
	const installed = wp( [ 'theme', 'list', '--field=name' ] ).split( '\n' );
	for ( const theme of THEMES ) {
		if ( ! installed.includes( theme ) ) {
			wp( [ 'theme', 'install', theme ] );
		}
	}

	try {
		viewSettings = execFileSync( wpCli(), [ 'option', 'get', 'fotogrids_view_settings', '--format=json' ], {
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'ignore' ],
		} );
	} catch {
		viewSettings = null;
	}

	const made = galleryPage( {}, fixture< number[] >( 'F-small', 'items' ).slice( 0, 2 ), 'View page head' );
	gallery = { id: made.id, view: wpEval( `echo get_permalink( ${ made.id } );` ).trim() };

	const madeAlbum = album( [ made.id ], {}, 'View page head album' );
	albumTarget = { id: madeAlbum.id, view: madeAlbum.view };
} );

test.afterAll( () => {
	if ( savedTheme && savedTheme !== wp( [ 'theme', 'list', '--status=active', '--field=name' ] ) ) {
		wp( [ 'theme', 'activate', savedTheme ] );
	}

	if ( null === viewSettings ) {
		wpEval( `delete_option( 'fotogrids_view_settings' );` );
		return;
	}
	execFileSync( wpCli(), [ 'option', 'update', 'fotogrids_view_settings', '--format=json' ], {
		encoding: 'utf8',
		input: viewSettings,
	} );
} );

for ( const theme of THEMES ) {
	for ( const mode of MODES ) {
		test.describe( `${ theme }, ${ mode } layout`, () => {
			test.beforeAll( () => {
				if ( theme !== wp( [ 'theme', 'list', '--status=active', '--field=name' ] ) ) {
					wp( [ 'theme', 'activate', theme ] );
				}
				setLayoutMode( mode );
			} );

			test( 'a gallery and an album print each head tag once', { tag: [ '@critical', '@layout' ] }, async ( {
				request,
			} ) => {
				for ( const target of [ gallery, albumTarget ] ) {
					const tags = await head( request, target.view );

					expect( tags.titles, target.view ).toBe( 1 );
					expect( tags.viewports, target.view ).toBe( 1 );
					expect( tags.canonicals, target.view ).toEqual( [ target.view ] );
					expect( tags.robots, target.view ).toHaveLength( 1 );
					expect( tags.robots[ 0 ], target.view ).not.toContain( 'noindex' );
				}
			} );

			test( 'a canonical override replaces the permalink', { tag: [ '@critical', '@layout' ] }, async ( { request } ) => {
				const override = 'https://example.com/elsewhere/';
				wpEval( `update_post_meta( ${ gallery.id }, 'fotogrids_canonical_override', '${ override }' );` );

				try {
					expect( ( await head( request, gallery.view ) ).canonicals ).toEqual( [ override ] );
				} finally {
					wpEval( `delete_post_meta( ${ gallery.id }, 'fotogrids_canonical_override' );` );
				}
			} );

			test( 'a noindexed gallery carries the noindex in its one robots tag', { tag: [ '@critical', '@layout' ] }, async ( {
				request,
			} ) => {
				wpEval( `update_post_meta( ${ gallery.id }, 'fotogrids_noindex', '1' );` );

				try {
					const { robots } = await head( request, gallery.view );
					expect( robots ).toHaveLength( 1 );
					expect( robots[ 0 ] ).toContain( 'noindex' );
					expect( robots[ 0 ] ).toContain( 'nofollow' );
				} finally {
					wpEval( `delete_post_meta( ${ gallery.id }, 'fotogrids_noindex' );` );
				}
			} );

			test( 'deferring to an SEO plugin leaves the head to WordPress', { tag: [ '@critical', '@layout' ] }, async ( {
				request,
			} ) => {
				const seo = wpEval( `echo base64_encode( wp_json_encode( \\FotoGrids\\Settings\\SEO_Settings_Store::get() ) );` ).trim();
				wpEval(
					`\\FotoGrids\\Settings\\SEO_Settings_Store::save( array_merge( \\FotoGrids\\Settings\\SEO_Settings_Store::get(), array( 'defer_to_seo_plugins' => true ) ) );`
				);
				wpEval(
					`update_post_meta( ${ gallery.id }, 'fotogrids_canonical_override', 'https://example.com/elsewhere/' ); update_post_meta( ${ gallery.id }, 'fotogrids_noindex', '1' );`
				);

				try {
					const tags = await head( request, gallery.view );
					expect( tags.titles ).toBe( 1 );
					expect( tags.viewports ).toBe( 1 );
					expect( tags.canonicals ).toEqual( [ gallery.view ] );
					expect( tags.robots.join( ',' ) ).not.toContain( 'noindex' );
					expect( tags.ogTitles ).toBe( 0 );
				} finally {
					wpEval(
						`delete_post_meta( ${ gallery.id }, 'fotogrids_canonical_override' ); delete_post_meta( ${ gallery.id }, 'fotogrids_noindex' );`
					);
					wpEval( `\\FotoGrids\\Settings\\SEO_Settings_Store::save( json_decode( base64_decode( '${ seo }' ), true ) );` );
				}
			} );
		} );
	}
}
