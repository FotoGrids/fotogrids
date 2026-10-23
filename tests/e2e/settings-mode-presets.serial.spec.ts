import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { CollectionSettings } from './support/collection-settings';
import { apiAs, roles, storageStateFor, wpEval } from './support/roles';
import { getOption, setOption } from './support/site';
import {
	ModeSwitch,
	SITE_MODE_OPTION,
	USER_MODE_META,
	presetGroup,
	presetOption,
	presetSelected,
	setUserMeta,
} from './support/settings-mode';

test.use( { storageState: storageStateFor( 'administrator' ) } );

/**
 * Easy mode's combined controls: each option writes every key it names, the
 * saved values select it again, and anything else leaves no option selected.
 *
 * Serial: writes the administrator's mode and the site default.
 */

type PresetOption = { value: string; label: string; values: Record< string, unknown > };
type Preset = { id: string; label: string; options: PresetOption[]; tab: string; subtab: string | null };

const EXPECTED = [ 'easy_spacing', 'easy_corners', 'easy_shadow', 'easy_caption_style' ];

const admin = () => roles().roles.administrator.user;

let savedSiteMode: string | null;

test.beforeAll( () => {
	savedSiteMode = getOption( SITE_MODE_OPTION );
} );

test.afterAll( () => {
	setOption( SITE_MODE_OPTION, savedSiteMode );
	setUserMeta( admin(), USER_MODE_META, null );
} );

test.beforeEach( () => {
	setOption( 'fotogrids_settings_mode_tip', null );
	setOption( SITE_MODE_OPTION, 'easy' );
	setUserMeta( admin(), USER_MODE_META, 'easy' );
} );

/** Every preset_group in the assembled gallery catalog, with where it lives. */
async function presets( playwright: Parameters< typeof apiAs >[ 0 ] ): Promise< Preset[] > {
	const { context, nonce } = await apiAs( playwright, 'administrator' );
	const response = await context.get( '/wp-json/fotogrids/v1/admin/catalog/entries?post_type=gallery', {
		headers: { 'X-WP-Nonce': nonce },
	} );
	expect( response.ok() ).toBe( true );
	const groups = ( await response.json() ).groups as Record< string, Record< string, unknown > >;
	await context.dispose();

	const found: Preset[] = [];
	const walk = ( node: unknown, tab: string, subtab: string | null ): void => {
		if ( Array.isArray( node ) ) {
			node.forEach( ( child ) => walk( child, tab, subtab ) );
			return;
		}
		if ( ! node || 'object' !== typeof node ) {
			return;
		}
		const entry = node as Record< string, unknown >;
		if ( 'preset_group' === entry.type ) {
			found.push( {
				id: String( entry.id ),
				label: String( entry.label ),
				options: entry.options as PresetOption[],
				tab,
				subtab,
			} );
			return;
		}
		if ( entry.subTabs && 'object' === typeof entry.subTabs ) {
			for ( const sub of Object.values( entry.subTabs as Record< string, Record< string, unknown > > ) ) {
				walk( sub.settings, tab, String( sub.label ?? '' ) );
			}
		}
		walk( entry.settings, tab, subtab );
	};

	for ( const [ tabId, tab ] of Object.entries( groups ) ) {
		walk( tab.settings, tabId, null );
		if ( tab.subTabs && 'object' === typeof tab.subTabs ) {
			for ( const sub of Object.values( tab.subTabs as Record< string, Record< string, unknown > > ) ) {
				walk( sub.settings, tabId, String( sub.label ?? '' ) );
			}
		}
	}

	return found;
}

const TRUE_VALUES = [ true, 1, '1', 'true', 'on' ];
const FALSE_VALUES = [ false, 0, '0', 'false', '', 'off', null ];

/** Saved value equals a preset value: numbers loosely, responsive per breakpoint present. */
function sameValue( expected: unknown, actual: unknown ): boolean {
	if ( expected && 'object' === typeof expected ) {
		const record = ( actual && 'object' === typeof actual ? actual : {} ) as Record< string, unknown >;
		return Object.entries( expected as Record< string, unknown > ).every( ( [ k, v ] ) => sameValue( v, record[ k ] ) );
	}
	if ( 'boolean' === typeof expected ) {
		return ( expected ? TRUE_VALUES : FALSE_VALUES ).includes( actual as never );
	}
	if ( 'number' === typeof expected ) {
		return '' !== actual && null !== actual && Number( actual ) === expected;
	}
	return String( actual ).replace( /\s+/g, '' ) === String( expected ).replace( /\s+/g, '' );
}

function storedSettings( id: number ): Record< string, unknown > {
	return JSON.parse(
		wpEval( `echo wp_json_encode( FotoGrids\\Galleries\\Gallery_Repository::get_settings( ${ id } ) );` )
	);
}

async function panelReady( page: Page ): Promise< void > {
	await expect( page.locator( '.fotogrids-settings-tab__label' ).first() ).toBeVisible( { timeout: 20000 } );
}

async function openPreset( page: Page, preset: Preset ): Promise< void > {
	const panel = new CollectionSettings( page );
	await panel.switchTab( preset.tab );
	// A tab left with one subtab in Easy shows no subtab bar.
	const subtab = page
		.locator( '.fotogrids-lightbox-subtab:visible' )
		.filter( { hasText: new RegExp( `^\\s*${ preset.subtab }\\s*$` ) } )
		.first();
	if ( preset.subtab && ( await subtab.count() ) > 0 ) {
		await subtab.click();
	}
	await expect( presetGroup( page, preset.label ) ).toBeVisible();
}

async function submit( page: Page ): Promise< void > {
	await Promise.all( [
		page.waitForResponse( ( r ) => 'POST' === r.request().method() && /\/wp-admin\/post\.php/.test( r.url() ) ),
		page.locator( '#publish' ).click(),
	] );
	await page.waitForLoadState( 'load' );
	await panelReady( page );
}

test( 'the catalog carries the four Easy presets', { tag: [ '@admin', '@settings' ] }, async ( { playwright } ) => {
	const ids = ( await presets( playwright ) ).map( ( preset ) => preset.id );
	expect( ids ).toEqual( expect.arrayContaining( EXPECTED ) );
} );

test( 'each preset option saves every key it names and reads back as chosen', { tag: [ '@critical', '@admin', '@settings' ] }, async ( {
	page,
	playwright,
}, testInfo ) => {
	testInfo.setTimeout( 300_000 );
	const all = ( await presets( playwright ) ).filter( ( preset ) => EXPECTED.includes( preset.id ) );
	const { id } = galleryPage();

	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	await panelReady( page );
	await new ModeSwitch( page ).expectActive( 'easy' );

	for ( const preset of all ) {
		// Last option first, so the shipped default is never the one already selected.
		for ( const option of [ ...preset.options ].reverse() ) {
			await test.step( `${ preset.label }: ${ option.label }`, async () => {
				await openPreset( page, preset );
				await presetOption( page, preset.label, option.label ).click();
				await expect( presetOption( page, preset.label, option.label ) ).toHaveClass( /\bfg-is-active\b/ );
				await submit( page );

				const stored = storedSettings( id );
				for ( const [ key, value ] of Object.entries( option.values ) ) {
					expect(
						sameValue( value, stored[ key ] ),
						`${ preset.id }=${ option.value } should save ${ key }=${ JSON.stringify( value ) }, saved ${ JSON.stringify( stored[ key ] ) }`
					).toBe( true );
				}

				await openPreset( page, preset );
				await expect( presetOption( page, preset.label, option.label ) ).toHaveClass( /\bfg-is-active\b/ );
				await expect( presetSelected( page, preset.label ) ).toHaveCount( 1 );
			} );
		}
	}
} );

test( 'a new gallery shows a chosen option in every preset', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
	playwright,
} ) => {
	const all = ( await presets( playwright ) ).filter( ( preset ) => EXPECTED.includes( preset.id ) );
	const { id } = galleryPage();

	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	await panelReady( page );

	for ( const preset of all ) {
		await openPreset( page, preset );
		await expect( presetSelected( page, preset.label ) ).toHaveCount( 1 );
	}
} );

test( 'a saved value no preset matches selects no option and adds no text', { tag: [ '@admin', '@settings' ] }, async ( {
	page,
	playwright,
} ) => {
	const all = await presets( playwright );
	const corners = all.find( ( preset ) => 'easy_corners' === preset.id ) as Preset;
	const spacing = all.find( ( preset ) => 'easy_spacing' === preset.id ) as Preset;
	const { id } = galleryPage( {
		border_radius: { desktop: 3, tablet: 3, mobile: 3 },
		item_spacing: { desktop: 37, tablet: 37, mobile: 37 },
	} );
	const panel = new CollectionSettings( page );

	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	await panelReady( page );

	for ( const preset of [ spacing, corners ] ) {
		await openPreset( page, preset );
		const group = presetGroup( page, preset.label );
		await expect( presetSelected( page, preset.label ) ).toHaveCount( 0 );
		await expect( group ).not.toContainText( 'Custom' );
		await expect( group ).not.toContainText( 'Show in Advanced' );
		await expect( group.locator( '.fg-button-group__button' ) ).toHaveCount( preset.options.length );
	}

	await new ModeSwitch( page ).choose( 'advanced' );
	await expect( panel.field( 'border_radius' ) ).toBeVisible();
	await expect.poll( () => wpEval( `echo get_user_meta( get_user_by( 'login', '${ admin() }' )->ID, '${ USER_MODE_META }', true );` ).trim() ).toBe( 'advanced' );
} );
