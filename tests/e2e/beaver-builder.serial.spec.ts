import { execFileSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import type { Browser, Frame, Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { roles, storageStateFor, wpCli, wpEval } from './support/roles';
import { GalleryRender } from './support/gallery-render';
import { Lightbox } from './support/lightbox';

/**
 * The Gallery and Album modules in Beaver Builder.
 *
 * Serial: activates a page builder for the whole site.
 */

test.describe.configure( { mode: 'serial' } );

const BUILDER = 'beaver-builder-lite-version';
const BUILDER_VERSION = '2.11.0.6';

let builderWasActive = false;

/** Pages this spec created, deleted afterwards. */
const createdPages: number[] = [];

type Module = [ string, Record< string, string > ];

function wp( args: string[] ): string {
	return execFileSync( wpCli(), args, { encoding: 'utf8' } ).trim();
}

/**
 * A published page whose Beaver Builder layout holds one row per module.
 *
 * @return The page id and URL.
 */
function builderPage( modules: Module[] ): { id: number; url: string } {
	const encoded = Buffer.from( JSON.stringify( modules ), 'utf8' ).toString( 'base64' );

	const page = JSON.parse(
		wpEval( `
			$modules = json_decode( base64_decode( '${ encoded }' ), true );
			$id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Beaver Builder modules' ) );
			update_post_meta( $id, '_fg_scoped', 1 );
			update_post_meta( $id, '_fl_builder_enabled', true );
			FLBuilderModel::set_post_id( $id );
			foreach ( $modules as $module ) {
				$row    = FLBuilderModel::add_row( '1-col' );
				$groups = FLBuilderModel::get_nodes( 'column-group', $row->node );
				$cols   = FLBuilderModel::get_nodes( 'column', reset( $groups )->node );
				$settings = clone FLBuilderModel::get_module_defaults( $module[0] );
				foreach ( $module[1] as $key => $value ) {
					$settings->$key = $value;
				}
				FLBuilderModel::add_module( $module[0], $settings, reset( $cols )->node );
			}
			FLBuilderModel::update_layout_data( FLBuilderModel::get_layout_data( 'published', $id ), 'draft', $id );
			FLBuilderModel::reset_post_id();
			echo wp_json_encode( array( 'id' => $id, 'url' => get_permalink( $id ) ) );
		` )
	);
	createdPages.push( page.id );

	return page;
}

/** A published page with no layout yet, for the builder to start from. */
function emptyPage(): { id: number; url: string } {
	const page = JSON.parse(
		wpEval(
			`$id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Beaver Builder empty' ) ); update_post_meta( $id, '_fg_scoped', 1 ); echo wp_json_encode( array( 'id' => $id, 'url' => get_permalink( $id ) ) );`
		)
	);
	createdPages.push( page.id );

	return page;
}

/** The URL that opens Beaver Builder on a page. */
function builderUrl( url: string ): string {
	return `${ url }${ url.includes( '?' ) ? '&' : '?' }fl_builder&fl_builder_ui`;
}

/**
 * A collection wrapper's server markup, without per-request values.
 */
async function serverMarkup( browser: Browser, url: string, selector: string ): Promise< string > {
	const context = await browser.newContext( { javaScriptEnabled: false } );
	const page = await context.newPage();
	await page.goto( url );
	const html = await page.locator( selector ).first().evaluate( ( node ) => node.outerHTML );
	await context.close();

	return html.replace( /fg-(\d+)-\d+/g, 'fg-$1-N' ).replace( /redirect_to=[^"&]*/g, 'redirect_to=' );
}

/** Open the builder and wait for its layout iframe. */
async function openBuilder( page: Page, url: string ): Promise< Frame > {
	await page.goto( builderUrl( url ) );
	await page.waitForFunction(
		() => {
			const frame = document.getElementById( 'fl-builder-ui-iframe' ) as HTMLIFrameElement | null;
			const win = frame?.contentWindow as ( Window & { FLBuilder?: unknown } ) | null | undefined;

			return !! win?.FLBuilder;
		},
		null,
		{ timeout: 60000 }
	);

	const frame = page.frame( { url: /fl_builder_ui_iframe/ } );
	if ( ! frame ) {
		throw new Error( 'The builder has no layout frame.' );
	}

	return frame;
}

/** WordPress's debug log, which the harness enables. */
function debugLog(): string {
	return path.join( process.env.WP_PATH ?? '', 'wp-content', 'debug.log' );
}

function debugLogSize(): number {
	return existsSync( debugLog() ) ? statSync( debugLog() ).size : 0;
}

/** PHP notices raised from FotoGrids files since the log had the given size. */
function fotogridsNoticesSince( from: number ): string[] {
	if ( ! existsSync( debugLog() ) ) {
		return [];
	}

	return readFileSync( debugLog(), 'utf8' )
		.slice( from )
		.split( '\n' )
		.filter( ( line ) => /PHP (Notice|Warning|Fatal error|Deprecated)/.test( line ) && /plugins\/fotogrids\//.test( line ) );
}

/** Drag a module from the builder's panel and drop it on the layout. */
async function dropModule( page: Page, frame: Frame, slug: string ): Promise< void > {
	const block = page.locator( `.fl-builder-block-module[data-type="${ slug }"]` );
	await block.scrollIntoViewIfNeeded();

	const from = await block.boundingBox();
	const frameBox = await page.locator( '#fl-builder-ui-iframe' ).boundingBox();
	const target = await frame.locator( '.fl-builder-content' ).first().boundingBox();
	if ( ! from || ! frameBox || ! target ) {
		throw new Error( `Cannot drag ${ slug }: the panel or the layout is not on screen.` );
	}

	const to = {
		x: frameBox.x + target.x + target.width / 2,
		y: frameBox.y + target.y + Math.min( target.height / 2, 200 ),
	};

	await page.mouse.move( from.x + from.width / 2, from.y + from.height / 2 );
	await page.mouse.down();
	for ( let step = 1; step <= 20; step++ ) {
		await page.mouse.move(
			from.x + ( ( to.x - from.x ) * step ) / 20,
			from.y + ( ( to.y - from.y ) * step ) / 20
		);
	}
	await page.mouse.up();
}

/** Publish from the builder's Done menu. */
async function publish( page: Page ): Promise< void > {
	await page.locator( '.fl-builder-done-button' ).click();
	await page.locator( '.fl-builder-publish-actions' ).getByText( 'Publish', { exact: true } ).click();
	await page.waitForURL( ( url ) => ! url.search.includes( 'fl_builder' ), { timeout: 30000 } );
}

test.beforeAll( () => {
	const installed = wp( [ 'plugin', 'list', '--field=name' ] ).split( '\n' );
	if ( ! installed.includes( BUILDER ) ) {
		wp( [ 'plugin', 'install', BUILDER, `--version=${ BUILDER_VERSION }` ] );
	}

	builderWasActive = 'active' === wp( [ 'plugin', 'get', BUILDER, '--field=status' ] );
	if ( ! builderWasActive ) {
		wp( [ 'plugin', 'activate', BUILDER ] );
	}

	// Skip the first-launch tour.
	for ( const user of [ process.env.WP_ADMIN_USER ?? 'admin', roles().roles.editor.user, roles().roles.contributor.user ] ) {
		wp( [ 'user', 'meta', 'update', user, '_fl_builder_launched', '1' ] );
	}
} );

test.afterAll( () => {
	if ( createdPages.length ) {
		wp( [ 'post', 'delete', ...createdPages.map( String ), '--force' ] );
	}

	if ( ! builderWasActive ) {
		wp( [ 'plugin', 'deactivate', BUILDER ] );
	}
} );

test.describe( 'on the published page', () => {
	test( 'the gallery module renders the gallery, styled and loaded', { tag: [ '@layout' ] }, async ( { page } ) => {
		const { id } = galleryPage();
		const { url } = builderPage( [ [ 'fotogrids-gallery', { gallery_id: String( id ) } ] ] );

		await page.goto( url );
		const gallery = new GalleryRender( page, id );
		await gallery.waitFor();

		await expect( page.locator( `.fl-module-fotogrids-gallery [data-fg-gallery-id="${ id }"]` ) ).toBeVisible();
		await expect( gallery.items() ).toHaveCount( 5 );
		expect( await gallery.cssVar( 'cols' ) ).not.toBe( '' );
		await expect( gallery.root.locator( '[data-fg-media-state="loaded"]' ) ).toHaveCount( 5 );
	} );

	test( 'the album module renders the album', { tag: [ '@layout' ] }, async ( { page } ) => {
		const first = galleryPage();
		const second = galleryPage();
		const { id } = album( [ first.id, second.id ] );
		const { url } = builderPage( [ [ 'fotogrids-album', { album_id: String( id ) } ] ] );

		await page.goto( url );

		const wrapper = page.locator( '.fl-module-fotogrids-album .fotogrids-album' );
		await expect( wrapper ).toBeVisible();
		await expect( wrapper.locator( '.fg-item' ) ).toHaveCount( 2 );
	} );

	test( 'an item opens the FotoGrids Lightbox, not Beaver Builder\'s', { tag: [ '@lightbox' ] }, async ( { page } ) => {
		const { id } = galleryPage();
		const { url } = builderPage( [ [ 'fotogrids-gallery', { gallery_id: String( id ) } ] ] );

		await page.goto( url );
		const gallery = new GalleryRender( page, id );
		await gallery.waitFor();

		await new Lightbox( page ).openFrom( gallery, 1 );
		await expect( page.locator( '.mfp-wrap' ) ).toHaveCount( 0 );
	} );

	test( 'a module renders exactly what the shortcode renders', { tag: [ '@layout' ] }, async ( { browser } ) => {
		const gallery = galleryPage();
		const gallerySelector = `[data-fg-gallery-id="${ gallery.id }"]`;
		const galleryModule = builderPage( [ [ 'fotogrids-gallery', { gallery_id: String( gallery.id ) } ] ] );

		expect( await serverMarkup( browser, galleryModule.url, gallerySelector ) ).toBe(
			await serverMarkup( browser, gallery.url, gallerySelector )
		);

		const collection = album( [ galleryPage().id ] );
		const albumModule = builderPage( [ [ 'fotogrids-album', { album_id: String( collection.id ) } ] ] );

		expect( await serverMarkup( browser, albumModule.url, '.fotogrids-album' ) ).toBe(
			await serverMarkup( browser, collection.url, '.fotogrids-album' )
		);
	} );

	test( 'a module without a collection renders nothing; a missing one renders the shortcode\'s error block, hidden from visitors', { tag: [ '@layout' ] }, async ( {
		page,
	} ) => {
		const { url } = builderPage( [
			[ 'fotogrids-gallery', { gallery_id: '' } ],
			[ 'fotogrids-gallery', { gallery_id: 'not-a-number' } ],
			[ 'fotogrids-gallery', { gallery_id: '999999' } ],
			[ 'fotogrids-album', { album_id: '' } ],
		] );

		await page.goto( url );

		const modules = page.locator( '.fl-module-content' );
		await expect( modules ).toHaveCount( 4 );
		await expect( modules.nth( 0 ) ).toBeEmpty();
		await expect( modules.nth( 1 ) ).toBeEmpty();
		await expect( modules.nth( 2 ).locator( '.fotogrids-error' ) ).toHaveCount( 1 );
		await expect( modules.nth( 2 ).locator( '.fotogrids-error' ) ).toBeHidden();
		await expect( modules.nth( 2 ) ).not.toContainText( '999999' );
		await expect( modules.nth( 3 ) ).toBeEmpty();
	} );

	test( 'module renders carry the Beaver Builder request source; a shortcode inside a module keeps its own', { tag: [ '@layout' ] }, () => {
		const viaModule = galleryPage().id;
		const viaShortcode = galleryPage().id;
		const page = builderPage( [
			[ 'fotogrids-gallery', { gallery_id: String( viaModule ) } ],
			[ 'rich-text', { text: `<p>[fotogrids_gallery id="${ viaShortcode }"]</p>` } ],
		] );

		const sources = JSON.parse(
			wpEval( `
				$sources = array();
				add_filter( 'fotogrids/render/anchor_attrs', function ( $attrs, $render ) use ( &$sources ) {
					$sources[ $render->meta->source ] = ( $sources[ $render->meta->source ] ?? 0 ) + 1;
					return $attrs;
				}, 10, 2 );
				FotoGrids\\FotoGrids_Cache::flush_for_gallery( ${ viaModule } );
				FotoGrids\\FotoGrids_Cache::flush_for_gallery( ${ viaShortcode } );
				ob_start();
				FLBuilder::render_content_by_id( ${ page.id } );
				ob_end_clean();
				echo wp_json_encode( $sources );
			` )
		);

		expect( sources ).toEqual( { beaver_builder: 5, shortcode: 5 } );
	} );
} );

test.describe( 'in the builder', () => {
	test.use( {
		storageState: storageStateFor( 'administrator' ),
		allowConsoleErrors: 'Beaver Builder\'s own UI logs errors, such as its welcome video failing to load',
		allowPhpNotices: 'Beaver Builder Lite logs its own notices while the builder is open; FotoGrids notices are asserted below',
	} );

	test( 'the modules are listed under FotoGrids, and a gallery picked for a dropped module publishes', { tag: [ '@admin', '@layout' ] }, async ( {
		page,
		browser,
	} ) => {
		const title = `Beaver Builder pick ${ Date.now() }`;
		const { id } = galleryPage( {}, undefined, title );
		const target = emptyPage();
		const logFrom = debugLogSize();
		const pageErrors: string[] = [];
		page.on( 'pageerror', ( error ) => pageErrors.push( error.message ) );

		const frame = await openBuilder( page, target.url );

		const listed = await page.evaluate( () => {
			const config = ( window as unknown as { FLBuilderConfig?: { contentItems?: { module?: Array< { slug: string; name: string; category: string } > } } } ).FLBuilderConfig;

			return ( config?.contentItems?.module ?? [] )
				.filter( ( item ) => item.slug.startsWith( 'fotogrids-' ) )
				.map( ( item ) => `${ item.slug }|${ item.name }|${ item.category }` )
				.sort();
		} );
		expect( listed ).toEqual( [
			'fotogrids-album|Album|FotoGrids',
			'fotogrids-gallery|Gallery|FotoGrids',
		] );

		await dropModule( page, frame, 'fotogrids-gallery' );

		const card = page.locator( 'form.fl-builder-settings .fg-pb-bb-picker__card' );
		await expect( card ).toContainText( 'No gallery selected yet.', { timeout: 15000 } );
		await expect( page.locator( 'form.fl-builder-settings input[name="gallery_id"]' ) ).toBeHidden();

		await card.getByRole( 'button', { name: 'Choose gallery' } ).click();
		const modal = page.locator( '.fg-modal' );
		await expect( modal ).toBeVisible();

		// Beaver Builder shortcuts: P previews, R enters responsive editing.
		await page.keyboard.press( 'p' );
		await page.keyboard.press( 'r' );
		await expect( page.locator( 'form.fl-builder-settings' ) ).toBeVisible();
		await expect( page.locator( 'body' ) ).not.toHaveClass( /fl-builder-ui-iframe-responsive-editing/ );
		for ( let press = 0; press < 20; press++ ) {
			await page.keyboard.press( 'Tab' );
		}
		await expect( modal.locator( ':focus' ) ).toHaveCount( 1 );

		await page.keyboard.press( 'Escape' );
		await expect( modal ).toHaveCount( 0 );
		await expect( page.locator( 'form.fl-builder-settings' ) ).toBeVisible();

		await card.getByRole( 'button', { name: 'Choose gallery' } ).click();
		await modal.locator( '.fg-pb-picker-card', { hasText: title } ).first().click();
		await expect( modal ).toHaveCount( 0 );
		await expect( page.locator( '.fg-pb-bb-picker__modal-host' ) ).toHaveCount( 0 );
		await expect( frame.locator( `.fl-module-fotogrids-gallery [data-fg-gallery-id="${ id }"]` ) ).toBeVisible( { timeout: 15000 } );
		await expect( card ).toContainText( title );
		await expect( card ).toContainText( '5 items' );
		await expect( card.getByRole( 'button', { name: 'Change gallery' } ) ).toBeVisible();

		await page.locator( '.fl-builder-settings-save' ).click();
		await expect( page.locator( 'form.fl-builder-settings' ) ).toHaveCount( 0 );
		await publish( page );

		const visitor = await browser.newContext();
		const published = await visitor.newPage();
		await published.goto( target.url );
		const gallery = new GalleryRender( published, id );
		await gallery.waitFor();
		await expect( gallery.items() ).toHaveCount( 5 );
		await visitor.close();

		expect( pageErrors ).toEqual( [] );
		expect( fotogridsNoticesSince( logFrom ) ).toEqual( [] );
	} );

	test( 'with both preview settings on, items and pagination respond, and the Lightbox keeps its keys', { tag: [ '@admin', '@lightbox' ] }, async ( { page } ) => {
		const { id } = galleryPage( {
			layout: 'grid',
			pagination_type: 'paginated',
			pagination_method: 'load_more',
			items_per_page: { desktop: 2, tablet: 2, mobile: 2 },
		} );
		const target = builderPage( [ [ 'fotogrids-gallery', { gallery_id: String( id ), preview_click_behavior: '1', preview_pagination: '1' } ] ] );

		const frame = await openBuilder( page, target.url );
		const module = frame.locator( '.fl-module-fotogrids-gallery' );
		await expect( module.locator( '.fg-item' ) ).toHaveCount( 2 );

		await module.getByRole( 'button', { name: 'Load More' } ).click();
		await expect( module.locator( '.fg-item' ) ).toHaveCount( 4 );
		await expect( page.locator( 'form.fl-builder-settings' ) ).toHaveCount( 0 );

		await module.locator( '.fg-item' ).first().click();
		const lightbox = frame.locator( 'dialog.fg-lightbox' );
		await expect( lightbox ).toBeVisible();
		await expect( page.locator( 'form.fl-builder-settings' ) ).toHaveCount( 0 );

		// R is Beaver Builder's responsive editing shortcut.
		await page.keyboard.press( 'r' );
		await page.keyboard.press( 'Escape' );
		await expect( lightbox ).toBeHidden();
		await expect( page.locator( 'body' ) ).not.toHaveClass( /fl-builder-ui-iframe-responsive-editing/ );
	} );

	test( 'with clicks off, an album cover opens the module settings and the album keeps its covers', { tag: [ '@admin', '@layout' ] }, async ( { page } ) => {
		const { id } = album( [ galleryPage().id, galleryPage().id ] );
		const target = builderPage( [ [ 'fotogrids-album', { album_id: String( id ) } ] ] );

		const frame = await openBuilder( page, target.url );
		const covers = frame.locator( '.fl-module-fotogrids-album .fg-item' );
		await expect( covers ).toHaveCount( 2 );

		await covers.first().click();
		await expect( page.locator( 'form.fl-builder-settings' ) ).toBeVisible();
		await expect( covers ).toHaveCount( 2 );
		await expect( frame.locator( '.fl-module-fotogrids-album .fotogrids-gallery' ) ).toHaveCount( 0 );
	} );
} );

/** Drop a gallery module and pick a gallery through its card. */
async function pickThroughCard( page: Page, frame: Frame, title: string, id: number ): Promise< Locator > {
	await dropModule( page, frame, 'fotogrids-gallery' );

	const card = page.locator( 'form.fl-builder-settings .fg-pb-bb-picker__card' );
	await expect( card ).toContainText( 'No gallery selected yet.', { timeout: 15000 } );
	await card.getByRole( 'button', { name: 'Choose gallery' } ).click();
	await page.locator( '.fg-modal .fg-pb-picker-card', { hasText: title } ).first().click();
	await expect( frame.locator( `.fl-module-fotogrids-gallery [data-fg-gallery-id="${ id }"]` ) ).toBeVisible( { timeout: 15000 } );
	await expect( card ).toContainText( title );

	return card;
}

test.describe( 'in the builder, for an editor', () => {
	test.use( {
		storageState: storageStateFor( 'editor' ),
		allowConsoleErrors: 'Beaver Builder\'s own UI logs errors, such as its welcome video failing to load',
		allowPhpNotices: 'Beaver Builder Lite logs its own notices while the builder is open; FotoGrids notices are asserted below',
	} );

	test( 'the card picks a gallery, which the editor can also edit', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		const title = `Beaver Builder editor pick ${ Date.now() }`;
		const { id } = galleryPage( {}, undefined, title );
		const logFrom = debugLogSize();
		const pageErrors: string[] = [];
		page.on( 'pageerror', ( error ) => pageErrors.push( error.message ) );

		const frame = await openBuilder( page, emptyPage().url );
		const card = await pickThroughCard( page, frame, title, id );

		await expect( card.getByRole( 'button', { name: 'Edit gallery' } ) ).toBeEnabled();
		await expect( card.getByRole( 'button', { name: 'Create new gallery' } ) ).toBeEnabled();
		await expect( card.locator( '.fg-pb-bb-picker__note' ) ).toHaveCount( 0 );

		expect( pageErrors ).toEqual( [] );
		expect( fotogridsNoticesSince( logFrom ) ).toEqual( [] );
	} );
} );

test.describe( 'in the builder, for a contributor', () => {
	test.use( {
		storageState: storageStateFor( 'contributor' ),
		allowConsoleErrors: 'Beaver Builder\'s own UI logs errors, such as its welcome video failing to load',
		allowPhpNotices: 'Beaver Builder Lite logs its own notices while the builder is open; FotoGrids notices are asserted below',
	} );

	test( 'the card picks a gallery and shows Edit and Create as unavailable', { tag: [ '@admin', '@permissions' ] }, async ( { page } ) => {
		const title = `Beaver Builder contributor pick ${ Date.now() }`;
		const { id } = galleryPage( {}, undefined, title );
		// Beaver Builder opens for contributors, on posts, only when an administrator allows it.
		test.info().annotations.push( {
			type: 'restore',
			description: wpEval( `echo base64_encode( serialize( array( get_option( '_fl_builder_post_types', null ), get_option( '_fl_builder_user_access', null ) ) ) );` ),
		} );
		wpEval( `update_option( '_fl_builder_post_types', array( 'page', 'post' ) ); update_option( '_fl_builder_user_access', array( 'builder_access' => array( 'contributor' => true ) ) );` );
		// Without unrestricted editing, the contributor edits modules already in the layout.
		const draft = JSON.parse(
			wpEval( `
				$user = get_user_by( 'login', '${ roles().roles.contributor.user }' );
				$id   = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'draft', 'post_title' => 'Beaver Builder contributor draft', 'post_author' => $user->ID ) );
				update_post_meta( $id, '_fl_builder_enabled', true );
				FLBuilderModel::set_post_id( $id );
				$row    = FLBuilderModel::add_row( '1-col' );
				$groups = FLBuilderModel::get_nodes( 'column-group', $row->node );
				$cols   = FLBuilderModel::get_nodes( 'column', reset( $groups )->node );
				FLBuilderModel::add_module( 'fotogrids-gallery', clone FLBuilderModel::get_module_defaults( 'fotogrids-gallery' ), reset( $cols )->node );
				FLBuilderModel::update_layout_data( FLBuilderModel::get_layout_data( 'published', $id ), 'draft', $id );
				FLBuilderModel::reset_post_id();
				echo wp_json_encode( array( 'id' => $id, 'url' => add_query_arg( 'p', $id, home_url( '/' ) ) ) );
			` )
		);
		createdPages.push( draft.id );
		const pageErrors: string[] = [];
		page.on( 'pageerror', ( error ) => pageErrors.push( error.message ) );

		const frame = await openBuilder( page, draft.url );
		await frame.locator( '.fl-module-fotogrids-gallery .fg-pb-bb-placeholder' ).click();
		const card = page.locator( 'form.fl-builder-settings .fg-pb-bb-picker__card' );
		await card.getByRole( 'button', { name: 'Choose gallery' } ).click( { timeout: 15000 } );
		await page.locator( '.fg-modal .fg-pb-picker-card', { hasText: title } ).first().click();
		await expect( frame.locator( `.fl-module-fotogrids-gallery [data-fg-gallery-id="${ id }"]` ) ).toBeVisible( { timeout: 15000 } );
		await expect( card ).toContainText( title );

		await expect( card.getByRole( 'button', { name: 'Edit gallery' } ) ).toBeDisabled();
		await expect( card.getByRole( 'button', { name: 'Create new gallery' } ) ).toBeDisabled();
		await expect( card.locator( '.fg-pb-bb-picker__note' ) ).toHaveText( 'Your role cannot edit or create galleries.' );

		expect( pageErrors ).toEqual( [] );
	} );

	test.afterEach( ( {}, testInfo ) => {
		const saved = testInfo.annotations.find( ( note ) => 'restore' === note.type );
		if ( saved?.description ) {
			wpEval(
				`$saved = unserialize( base64_decode( '${ saved.description }' ) ); foreach ( array( '_fl_builder_post_types', '_fl_builder_user_access' ) as $i => $name ) { null === $saved[ $i ] ? delete_option( $name ) : update_option( $name, $saved[ $i ] ); }`
			);
		}
	} );
} );
