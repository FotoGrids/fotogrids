import { test } from './support/test';
import { album, galleryPage } from './support/collections';
import { GalleryRender } from './support/gallery-render';
import { PAYLOAD, expectInert } from './support/xss';

/**
 * SEC-15. Editor-supplied text is inert wherever the renderer puts it.
 *
 * Scoped: every gallery and album here is created by the test that reads it.
 */

test( 'a script payload in a settings string is inert in the button it renders', { tag: [ '@layout', '@settings' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( {
		items_per_page: { desktop: 2, tablet: 2, mobile: 2 },
		load_more_button_text: PAYLOAD,
	} );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	await expectInert( page, 'load_more_button_text' );
} );

// The schema is JSON inside a script block, so a title holding `</script>`
// would close the tag early. The emitter rewrites the sequence.
test( 'a title holding a closing script tag cannot break out of the JSON-LD', { tag: [ '@critical', '@layout', '@settings' ] }, async ( {
	page,
} ) => {
	const { id, url } = galleryPage( {}, undefined, PAYLOAD );
	album( [ id ], {
		navigation_show_breadcrumbs: true,
		navigation_show_breadcrumbs_on_direct_visit: true,
	} );
	const gallery = new GalleryRender( page, id );

	await page.goto( url );
	await gallery.waitFor();

	await expectInert( page, 'breadcrumb JSON-LD' );
} );
