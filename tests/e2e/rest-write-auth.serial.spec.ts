import { test, expect } from './support/test';
import type { APIRequestContext } from '@playwright/test';
import { fixture, firstItem } from './support/fixtures';
import { apiAnonymous, apiAs } from './support/roles';

/**
 * SEC-13. Every write route refuses a request carrying no REST nonce.
 *
 * Routes come from the namespace index. Each must be listed as public on
 * purpose, proven to refuse, or unexercisable; one in none of them fails.
 *
 * Serial: a route that fails this is performing the write.
 */

/** Routes that answer without a nonce on purpose, and why. */
const PUBLIC_ON_PURPOSE: Record< string, string > = {
	'/fotogrids/v1/stats/view': 'view counting is unauthenticated by design',
	'/fotogrids/v1/stats/share': 'share counting is unauthenticated by design',
	'/fotogrids/v1/gallery/(?P<id>\\d+)/unlock':
		'a visitor submits the gallery password before they have any session',
	'/fotogrids/v1/gallery/render': 'a read that uses POST for its argument size',
	'/fotogrids/v1/gallery/lightbox/slides':
		'a read, gated per gallery rather than by capability',
};

/** Routes rejected for their body before the permission callback runs. */
const UNPROVEN: Record< string, string > = {
	'/fotogrids/v1/admin/tools/migration/import': 'refs describe another install',
	'/fotogrids/v1/media/import/folder': 'files must name real paths on disk',
	'/fotogrids/v1/import/core-gallery': 'attachment_ids must be core gallery attachments',
	'/fotogrids/v1/admin/albums/(?P<id>\\d+)/galleries': 'gallery_ids is validated against the album',
	'/fotogrids/v1/admin/albums/(?P<id>\\d+)/galleries/reorder': 'gallery_ids must be the album’s own',
	'/fotogrids/v1/admin/galleries/(?P<id>\\d+)/albums': 'album_ids is validated against the gallery',
	'/fotogrids/v1/admin/galleries/(?P<id>\\d+)/items': 'item_ids is validated against the gallery',
};

/** Stand-ins for the route parameters, by the segment that owns them. */
function fillParams( route: string ): string {
	return route
		.replace( /\(\?P<gallery_id>[^)]*\)/g, String( fixture< number >( 'F-small', 'gallery' ) ) )
		.replace( /\(\?P<album_id>[^)]*\)/g, String( fixture< number >( 'F-album', 'album' ) ) )
		.replace( /\(\?P<type>[^)]*\)/g, 'tags' )
		.replace( /\(\?P<id>\[a-zA-Z0-9_-\]\+\)/g, 'clean-grid' )
		.replace( /\(\?P<id>[^)]*\)/g, () => {
			if ( route.includes( '/items/embed/' ) ) {
				// An embed id, or the route 404s before checking anything.
				return String( fixture< number >( 'F-orphan', 'embed' ) );
			}
			if ( route.includes( '/album' ) ) {
				return String( fixture< number >( 'F-album', 'album' ) );
			}
			if ( route.includes( '/items/' ) || route.includes( '/metadata/item/' ) ) {
				return String( firstItem( 'F-small' ) );
			}
			return String( fixture< number >( 'F-small', 'gallery' ) );
		} );
}

type ArgSchema = {
	required?: boolean;
	type?: string | string[];
	enum?: unknown[];
	default?: unknown;
};

/** A value the route will accept, so the request reaches its permission callback. */
function sampleArg( name: string, schema: ArgSchema ): unknown {
	if ( Array.isArray( schema.enum ) && schema.enum.length ) {
		return schema.enum[ 0 ];
	}
	if ( undefined !== schema.default ) {
		return schema.default;
	}

	const id = /album/.test( name )
		? fixture< number >( 'F-album', 'album' )
		: /item/.test( name )
		? firstItem( 'F-small' )
		: fixture< number >( 'F-small', 'gallery' );

	switch ( Array.isArray( schema.type ) ? schema.type[ 0 ] : schema.type ) {
		case 'integer':
		case 'number':
			return id;
		case 'boolean':
			return false;
		case 'array':
			return [ id ];
		case 'object':
			return {};
		default:
			return 'probe';
	}
}

type Endpoint = { route: string; method: string; data: Record< string, unknown > };

/** Every write endpoint in the namespace, with a body it should accept. */
async function writeEndpoints( request: APIRequestContext ): Promise< Endpoint[] > {
	const index = ( await ( await request.get( '/?rest_route=/fotogrids/v1' ) ).json() ) as {
		routes: Record<
			string,
			{ endpoints?: { methods?: string[]; args?: Record< string, ArgSchema > }[] }
		>;
	};

	const endpoints: Endpoint[] = [];

	for ( const [ route, info ] of Object.entries( index.routes ) ) {
		// Path parameters come from the URL, not the body.
		const inPath = [ ...route.matchAll( /\(\?P<(\w+)>/g ) ].map( ( m ) => m[ 1 ] );

		for ( const endpoint of info.endpoints ?? [] ) {
			const methods = ( endpoint.methods ?? [] ).filter( ( m ) =>
				[ 'POST', 'PUT', 'PATCH', 'DELETE' ].includes( m )
			);
			if ( ! methods.length ) {
				continue;
			}

			const data: Record< string, unknown > = {};
			for ( const [ name, schema ] of Object.entries( endpoint.args ?? {} ) ) {
				if ( schema.required && ! inPath.includes( name ) ) {
					data[ name ] = sampleArg( name, schema );
				}
			}

			for ( const method of methods ) {
				endpoints.push( { route, method, data } );
			}
		}
	}

	return endpoints;
}

test( 'SEC-13: every write route refuses a request with no nonce', { tag: [ '@api', '@permissions' ] }, async ( {
	playwright,
} ) => {
	const anon = await apiAnonymous( playwright );
	const endpoints = await writeEndpoints( anon );
	await anon.dispose();

	expect( endpoints.length, 'the namespace index listed no write routes' ).toBeGreaterThan( 20 );

	// Cookies without X-WP-Nonce: WordPress treats this as anonymous.
	const { context } = await apiAs( playwright, 'administrator' );

	const accepted: string[] = [];
	const errored: string[] = [];
	const unreached: string[] = [];
	const refused = new Set< string >();

	for ( const { route, method, data } of endpoints ) {
		if ( PUBLIC_ON_PURPOSE[ route ] ) {
			continue;
		}

		const response = await context.fetch(
			`/?rest_route=${ encodeURIComponent( fillParams( route ) ) }`,
			{ method, data, failOnStatusCode: false }
		);
		const status = response.status();
		const where = `${ method } ${ route } → ${ status }`;

		if ( status < 400 ) {
			accepted.push( where );
		} else if ( status >= 500 ) {
			errored.push( where );
		} else if ( 401 === status || 403 === status ) {
			refused.add( route );
		} else {
			unreached.push( where );
		}
	}

	await context.dispose();

	expect( accepted, 'write routes that answered without a nonce' ).toEqual( [] );
	expect( errored, 'write routes that raised a server error' ).toEqual( [] );

	// A route that never reached its permission callback has to be named above.
	expect(
		unreached.filter( ( entry ) => ! Object.keys( UNPROVEN ).some( ( r ) => entry.includes( r ) ) ),
		'write routes this test could not exercise, and UNPROVEN does not name'
	).toEqual( [] );

	// A named route that now refuses belongs in the proven set.
	expect(
		Object.keys( UNPROVEN ).filter( ( route ) => refused.has( route ) ),
		'UNPROVEN names routes that now refuse properly; remove them'
	).toEqual( [] );
} );

test( 'the routes that are public on purpose still are', { tag: [ '@api', '@permissions' ] }, async ( { playwright } ) => {
	const anon = await apiAnonymous( playwright );

	const response = await anon.post(
		`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/stats/view' ) }`,
		{
			data: {
				object_type: 'gallery',
				object_id: fixture< number >( 'F-small', 'gallery' ),
			},
		}
	);
	await anon.dispose();

	expect( response.status() ).toBe( 200 );
} );

test( 'a view is not recorded for an object that does not exist', { tag: [ '@api', '@permissions' ] }, async ( {
	playwright,
} ) => {
	const anon = await apiAnonymous( playwright );
	const response = await anon.post(
		`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/stats/view' ) }`,
		{ data: { object_type: 'gallery', object_id: 99999999 } }
	);
	await anon.dispose();

	expect( response.status() ).toBe( 404 );
} );

test( 'views and shares count only for published or private objects of the declared type', {
	tag: [ '@api', '@permissions' ],
}, async ( { playwright } ) => {
	const gallery = fixture< number >( 'F-small', 'gallery' );
	const album = fixture< number >( 'F-album', 'album' );
	const image = firstItem( 'F-small' );

	const cases: Array< [ string, string, number, number ] > = [
		[ 'view', 'gallery', gallery, 200 ],
		[ 'view', 'album', album, 200 ],
		[ 'view', 'item', image, 200 ],
		[ 'view', 'item', fixture< number >( 'F-mixed', 'video' ), 200 ],
		[ 'view', 'item', fixture< number >( 'F-mixed', 'youtube' ), 200 ],
		[ 'view', 'item', fixture< number >( 'F-mixed', 'vimeo' ), 200 ],
		[ 'share', 'item', fixture< number >( 'F-mixed', 'youtube' ), 200 ],
		[ 'view', 'gallery', fixture< number >( 'F-draft', 'private' ), 200 ],
		[ 'view', 'gallery', fixture< number >( 'F-draft', 'draft' ), 404 ],
		[ 'view', 'gallery', fixture< number >( 'F-draft', 'trashed' ), 404 ],
		[ 'view', 'gallery', album, 404 ],
		[ 'view', 'album', gallery, 404 ],
		[ 'view', 'item', gallery, 404 ],
		[ 'view', 'gallery', image, 404 ],
		[ 'share', 'item', 99999999, 404 ],
	];

	const anon = await apiAnonymous( playwright );
	const results: string[] = [];
	for ( const [ action, objectType, objectId ] of cases ) {
		const response = await anon.post(
			`/?rest_route=${ encodeURIComponent( `/fotogrids/v1/stats/${ action }` ) }`,
			{
				data: {
					object_type: objectType,
					object_id: objectId,
					...( 'share' === action ? { network: 'copy' } : {} ),
				},
			}
		);
		results.push( `${ action } ${ objectType } ${ objectId } -> ${ response.status() }` );
	}
	await anon.dispose();

	expect( results ).toEqual(
		cases.map( ( [ action, objectType, objectId, status ] ) => `${ action } ${ objectType } ${ objectId } -> ${ status }` )
	);
} );

test( 'a share is recorded on every network the share bar sends', {
	tag: [ '@api' ],
}, async ( { playwright } ) => {
	const image = firstItem( 'F-small' );
	const cases: Array< [ string, string, number, number ] > = [
		...[ 'facebook', 'twitter', 'pinterest', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'copy' ].map(
			( network ): [ string, string, number, number ] => [ network, 'item', image, 200 ]
		),
		[ 'linkedin', 'gallery', fixture< number >( 'F-small', 'gallery' ), 200 ],
		[ 'copy', 'album', fixture< number >( 'F-album', 'album' ), 200 ],
		[ 'myspace', 'item', image, 400 ],
	];

	const anon = await apiAnonymous( playwright );
	const results: string[] = [];
	for ( const [ network, objectType, objectId ] of cases ) {
		const response = await anon.post(
			`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/stats/share' ) }`,
			{ data: { object_type: objectType, object_id: objectId, network } }
		);
		results.push( `${ network } ${ objectType } -> ${ response.status() }` );
	}
	await anon.dispose();

	expect( results ).toEqual(
		cases.map( ( [ network, objectType, , status ] ) => `${ network } ${ objectType } -> ${ status }` )
	);
} );

test( 'item metadata has no write route of its own', { tag: [ '@api', '@permissions' ] }, async ( { playwright } ) => {
	const { context, nonce } = await apiAs( playwright, 'administrator' );

	const response = await context.post(
		`/?rest_route=${ encodeURIComponent(
			`/fotogrids/v1/metadata/item/${ firstItem( 'F-small' ) }`
		) }`,
		{ headers: { 'X-WP-Nonce': nonce }, data: { tags: [] } }
	);
	await context.dispose();

	expect( response.status() ).toBe( 404 );
} );

test( 'an author cannot add a tag to the library', { tag: [ '@api', '@permissions' ] }, async ( { playwright } ) => {
	const name = `Author tag ${ Date.now() }`;
	const author = await apiAs( playwright, 'author' );

	const response = await author.context.post(
		`/?rest_route=${ encodeURIComponent( '/fotogrids/v1/metadata/tags' ) }`,
		{ headers: { 'X-WP-Nonce': author.nonce }, data: { name } }
	);
	await author.context.dispose();

	expect( response.status() ).toBe( 403 );

	const admin = await apiAs( playwright, 'administrator' );
	const search = await admin.context.get(
		`/?rest_route=${ encodeURIComponent(
			'/fotogrids/v1/metadata/tags'
		) }&search=${ encodeURIComponent( name ) }`,
		{ headers: { 'X-WP-Nonce': admin.nonce } }
	);
	const found = ( await search.json() ) as Array< { name: string } >;
	await admin.context.dispose();

	expect( found.map( ( tag ) => tag.name ) ).not.toContain( name );
} );

test( 'an author can pick a tag that is already in the library', { tag: [ '@api', '@permissions' ] }, async ( {
	playwright,
} ) => {
	const name = `Shared tag ${ Date.now() }`;
	const tagsRoute = `/?rest_route=${ encodeURIComponent( '/fotogrids/v1/metadata/tags' ) }`;
	const admin = await apiAs( playwright, 'administrator' );

	const created = await admin.context.post( tagsRoute, {
		headers: { 'X-WP-Nonce': admin.nonce },
		data: { name },
	} );
	const tag = ( await created.json() ) as { id: number; name: string };
	expect( created.status() ).toBe( 200 );

	const author = await apiAs( playwright, 'author' );
	const picked = await author.context.post( tagsRoute, {
		headers: { 'X-WP-Nonce': author.nonce },
		data: { name: name.toLowerCase() },
	} );
	const body = ( await picked.json() ) as { id: number; name: string };
	await author.context.dispose();

	await admin.context.delete(
		`/?rest_route=${ encodeURIComponent(
			`/fotogrids/v1/library/tags/${ tag.id }`
		) }`,
		{ headers: { 'X-WP-Nonce': admin.nonce } }
	);
	await admin.context.dispose();

	expect( picked.status() ).toBe( 200 );
	expect( Number( body.id ) ).toBe( Number( tag.id ) );
	expect( body.name ).toBe( name );
} );
