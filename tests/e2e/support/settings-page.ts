import { expect, type Locator, type Page, type Response } from '@playwright/test';

/** The plugin settings screen: its tabs, its toggles and its SaveBar. */

const SETTINGS = '/wp-admin/admin.php?page=fotogrids-settings';
const ADVANCED_REST = '/fotogrids/v1/admin/advanced-settings';

export type Tab =
	| 'media'
	| 'responsiveness'
	| 'defaults'
	| 'view_pages'
	| 'sharing'
	| 'watermark'
	| 'seo'
	| 'permissions_manager'
	| 'advanced'
	| 'maintenance'
	| 'setup_wizard';

export class SettingsPage {
	constructor( private readonly page: Page ) {}

	url( tab: Tab ): string {
		return `${ SETTINGS }&tab=${ tab }`;
	}

	/** Open a tab and wait for its SaveBar, so assertions see a mounted panel. */
	async open( tab: Tab ): Promise< void > {
		await this.page.goto( this.url( tab ) );
		await expect( this.saveBar() ).toBeVisible( { timeout: 20000 } );
	}

	/**
	 * Open Advanced and wait for its REST read.
	 *
	 * Without the wait, a toggle is read at first paint and reports the seeded
	 * value rather than the stored one.
	 */
	async openAdvanced(): Promise< void > {
		const read = this.read( ADVANCED_REST );
		await this.page.goto( this.url( 'advanced' ) );
		await read;
	}

	/** A toggle, by setting name with or without the `fotogrids_` prefix. */
	toggle( setting: string ): Locator {
		const id = setting.startsWith( 'fotogrids_' )
			? setting
			: `fotogrids_${ setting }`;
		return this.page.locator( `#${ id }[role="switch"]` );
	}

	async toggleState( setting: string ): Promise< string | null > {
		const toggle = this.toggle( setting );
		await expect( toggle ).toBeVisible( { timeout: 15000 } );
		return toggle.getAttribute( 'aria-checked' );
	}

	/**
	 * Set a toggle and wait for the write, whether autosave sent it or Save did.
	 *
	 * Pressing Save when autosave would have fired anyway is harmless, and makes
	 * this behave the same with the setting on or off.
	 */
	async setToggle( setting: string, on: boolean ): Promise< void > {
		const toggle = this.toggle( setting );
		await expect( toggle ).toBeVisible( { timeout: 15000 } );

		if ( ( await toggle.getAttribute( 'aria-checked' ) ) !== String( on ) ) {
			const write = this.write( ADVANCED_REST );
			await toggle.click();

			const save = this.saveButton();
			if ( await save.isEnabled() ) {
				await save.click();
			}

			await write;
		}

		await expect( toggle ).toHaveAttribute( 'aria-checked', String( on ) );
	}

	/** Set Autosave from the Advanced tab, opening it first. */
	async setAutosave( on: boolean ): Promise< void > {
		await this.openAdvanced();
		await this.setToggle( 'autosave', on );
	}

	saveBar(): Locator {
		return this.page.locator( '.fotogrids-save-bar' );
	}

	saveMessage(): Locator {
		return this.page.locator( '.fotogrids-save-bar__message' ).first();
	}

	/** The SaveBar's button. Tabs relabel it, so the name is a parameter. */
	saveButton( name: RegExp = /save changes/i ): Locator {
		return this.page.getByRole( 'button', { name } );
	}

	/** Where the SaveBar sits, for asserting one tab matches the others. */
	async saveBarParentClass(): Promise< string > {
		const bar = this.saveBar();
		await expect( bar ).toBeVisible( { timeout: 20000 } );
		return bar.evaluate( ( element ) => element.parentElement?.className ?? '' );
	}

	/** The Permissions Manager's first role mapping. */
	roleSelect(): Locator {
		return this.page
			.locator( '.fg-rpm__panel select, select[id^="fg-perm-"]' )
			.first();
	}

	write( path: string ): Promise< Response > {
		return this.response( path, 'POST' );
	}

	read( path: string ): Promise< Response > {
		return this.response( path, 'GET' );
	}

	/** Records every POST to a path, for asserting one has *not* happened yet. */
	recordWrites( path: string ): string[] {
		const seen: string[] = [];

		this.page.on( 'request', ( request ) => {
			const url = decodeURIComponent( request.url() );
			if ( 'POST' === request.method() && url.includes( path ) ) {
				seen.push( url );
			}
		} );

		return seen;
	}

	private response( path: string, method: string ): Promise< Response > {
		return this.page.waitForResponse(
			( response ) =>
				decodeURIComponent( response.url() ).includes( path ) &&
				response.request().method() === method,
			{ timeout: 30000 }
		);
	}
}

export { ADVANCED_REST };
