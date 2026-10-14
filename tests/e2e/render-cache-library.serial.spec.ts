import type { APIRequestContext, Browser } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { apiAs, wpEval } from './support/roles';

/**
 * Library edits reach cached galleries.
 *
 * A tag filter is part of the cached render, so renaming, deleting or merging
 * a tag on the Library screen has to drop the cached HTML. Each test warms the
 * cache with a logged-out visit, edits a tag through the Library route, and
 * reads the filter buttons from the next logged-out visit.
 *
 * Serial: a Library edit flushes every cached render on the site, and these
 * write to the site-wide Library tables. The tags and attachments are the
 * spec's own and are removed afterwards.
 */

const PREFIX = `E2E Library cache ${ Date.now() }`;

const TAGS = {
	keep: `${ PREFIX } Keep`,
	rename: `${ PREFIX } Rename`,
	renamed: `${ PREFIX } Renamed`,
	remove: `${ PREFIX } Delete`,
	target: `${ PREFIX } Merge target`,
	source: `${ PREFIX } Merge source`,
};

/** Which tags each attachment carries, in gallery order. */
const ITEM_TAGS = [
	[ TAGS.keep, TAGS.rename ],
	[ TAGS.remove, TAGS.target ],
	[ TAGS.source ],
];

function route( path: string ): string {
	return `/?rest_route=${ encodeURIComponent( path ) }`;
}

function phpString( value: unknown ): string {
	return `json_decode( base64_decode( '${ Buffer.from( JSON.stringify( value ) ).toString( 'base64' ) }' ), true )`;
}

/** A new attachment, a copy of a seeded image, carrying the given tags. */
function taggedAttachment( tags: string[] ): number {
	return Number(
		wpEval( `
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$up   = wp_upload_dir();
			$name = wp_unique_filename( $up['path'], 'fg-library-cache.jpg' );
			$path = $up['path'] . '/' . $name;
			copy( wp_get_original_image_path( ${ fixture< number[] >( 'F-small', 'items' )[ 0 ] } ), $path );
			$id = wp_insert_attachment( array(
				'post_mime_type' => 'image/jpeg',
				'post_title'     => 'Library cache',
				'post_status'    => 'inherit',
			), $path );
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
			foreach ( ${ phpString( tags ) } as $tag ) {
				\\FotoGrids\\Metadata_Manager::add_tag_to_item( $id, $tag );
			}
			echo $id;
		` ).trim()
	);
}

function tagId( name: string ): number {
	return Number(
		wpEval(
			`$row = \\FotoGrids\\Metadata_Manager::find_metadata( 'tag', ${ phpString( name ) } ); echo $row ? (int) $row->id : 0;`
		).trim()
	);
}

function cachedRows( galleryId: number ): number {
	return Number(
		wpEval(
			`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${ galleryId } ) );`
		).trim()
	);
}

/** The tag filter a logged-out visitor is shown: button label to item count. */
async function filterButtons(
	browser: Browser,
	url: string,
	galleryId: number
): Promise< Record< string, number > > {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto( url );

	const buttons = await page
		.locator( `[data-fg-gallery-id="${ galleryId }"] .fg-filter-btn` )
		.evaluateAll( ( elements ) =>
			elements.map(
				( button ): [ string, number ] => [
					( button.firstChild?.textContent ?? '' ).trim(),
					Number( button.querySelector( '.fg-filter-count' )?.textContent ?? 0 ),
				]
			)
		);

	await context.close();
	return Object.fromEntries( buttons );
}

test.describe( 'Library edits and the render cache', { tag: [ '@critical', '@cache', '@api' ] }, () => {
	let admin: APIRequestContext;
	let headers: Record< string, string >;
	let attachments: number[] = [];

	/** A cached gallery of the spec's attachments, with a tag filter showing counts. */
	async function warmGallery( browser: Browser ): Promise< { id: number; url: string } > {
		const created = galleryPage(
			{
				enable_cache: true,
				filtering_enabled: true,
				filter_by: [ 'tags' ],
				filter_display_mode: 'always',
				filter_ui_style: 'buttons',
				show_filter_count: true,
			},
			attachments
		);

		await filterButtons( browser, created.url, created.id );
		expect( cachedRows( created.id ), 'the first visit was not cached' ).toBeGreaterThan( 0 );

		return created;
	}

	test.beforeAll( async ( { playwright } ) => {
		const session = await apiAs( playwright, 'administrator' );
		admin = session.context;
		headers = { 'X-WP-Nonce': session.nonce };
		attachments = ITEM_TAGS.map( taggedAttachment );
	} );

	test.afterAll( async () => {
		wpEval( `
			foreach ( ${ phpString( Object.values( TAGS ) ) } as $name ) {
				$row = \\FotoGrids\\Metadata_Manager::find_metadata( 'tag', $name );
				if ( $row ) {
					\\FotoGrids\\Metadata_Manager::delete_metadata( (int) $row->id );
				}
			}
			foreach ( ${ phpString( attachments ) } as $id ) {
				wp_delete_attachment( (int) $id, true );
			}
		` );
		await admin.dispose();
	} );

	test( 'a renamed tag shows its new name', async ( { browser } ) => {
		const { id, url } = await warmGallery( browser );
		expect( await filterButtons( browser, url, id ) ).toHaveProperty( [ TAGS.rename ], 1 );

		const response = await admin.patch( route( `/fotogrids/v1/library/tags/${ tagId( TAGS.rename ) }` ), {
			headers,
			data: { name: TAGS.renamed },
		} );
		expect( response.status() ).toBe( 200 );

		const buttons = await filterButtons( browser, url, id );
		expect( buttons ).toHaveProperty( [ TAGS.renamed ], 1 );
		expect( buttons ).not.toHaveProperty( [ TAGS.rename ] );
	} );

	test( 'a deleted tag is no longer offered', async ( { browser } ) => {
		const { id, url } = await warmGallery( browser );
		expect( await filterButtons( browser, url, id ) ).toHaveProperty( [ TAGS.remove ], 1 );

		const response = await admin.delete( route( `/fotogrids/v1/library/tags/${ tagId( TAGS.remove ) }` ), {
			headers,
		} );
		expect( response.status() ).toBe( 200 );

		const buttons = await filterButtons( browser, url, id );
		expect( buttons ).not.toHaveProperty( [ TAGS.remove ] );
		expect( buttons ).toHaveProperty( [ TAGS.keep ], 1 );
	} );

	test( 'a merged tag carries both counts', async ( { browser } ) => {
		const { id, url } = await warmGallery( browser );
		const before = await filterButtons( browser, url, id );
		expect( before ).toHaveProperty( [ TAGS.target ], 1 );
		expect( before ).toHaveProperty( [ TAGS.source ], 1 );

		const response = await admin.post( route( '/fotogrids/v1/library/tags/merge' ), {
			headers,
			data: { target_id: tagId( TAGS.target ), source_ids: [ tagId( TAGS.source ) ] },
		} );
		expect( response.status() ).toBe( 200 );

		const buttons = await filterButtons( browser, url, id );
		expect( buttons ).toHaveProperty( [ TAGS.target ], 2 );
		expect( buttons ).not.toHaveProperty( [ TAGS.source ] );
	} );
} );
