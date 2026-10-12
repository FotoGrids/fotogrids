import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { wpEval } from './support/roles';
import { NAVIGATION, cached, rest, servedAndUncached, wp } from './support/album-header';

/**
 * An import that overwrites an album reaches the cached renders of its
 * galleries.
 *
 * Serial: an import flushes every cached render on the site.
 */

test( 'an import that overwrites the album reaches the next visitor', { tag: [ '@cache' ] }, async ( { browser, playwright } ) => {
	const gallery = galleryPage( { enable_cache: true } );
	const parent = album( [ gallery.id ], NAVIGATION );
	const slug = wp( [ 'post', 'get', String( parent.id ), '--field=post_name' ] );

	expect( ( await cached( browser, gallery.url, gallery.id ) ).back ).not.toBeNull();

	await rest( playwright, 'post', '/admin/tools/import-export/import', {
		phase: 'execute',
		format: 'json',
		include: [ 'albums' ],
		albums: 'overwrite',
		file: JSON.stringify( {
			meta: { version: wpEval( 'echo FOTOGRIDS_VERSION;' ).trim() },
			albums: [ { id: parent.id, title: 'Imported', slug, meta: { fotogrids_navigation_show_back_button: '0' } } ],
		} ),
	} );

	const [ seen, uncached ] = await servedAndUncached( browser, gallery );
	expect( seen ).toEqual( uncached );
	expect( seen.back ).toBeNull();
} );
