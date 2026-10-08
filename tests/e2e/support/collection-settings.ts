import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The collection settings panel, inside the gallery and album editors.
 *
 * Fields are addressed by catalog key through `data-fg-setting`, which every
 * field wrapper carries. There are around 519 keys across 23 tabs, so a panel
 * spec written against CSS selectors would break on any UI change.
 */
export class CollectionSettings {
	constructor( private readonly page: Page ) {}

	/** One field's wrapper, by the key the catalog gives it. */
	field( key: string ): Locator {
		return this.page.locator( `[data-fg-setting="${ key }"]` );
	}

	/** Whether a field is gated, rather than absent. */
	async isDisabled( key: string ): Promise< boolean > {
		return (
			( await this.field( key ).getAttribute( 'class' ) )?.includes(
				'fotogrids-setting--disabled'
			) ?? false
		);
	}

	/** A field's switch, for the toggle renderer. */
	switchIn( key: string ): Locator {
		return this.field( key ).locator( 'button[role="switch"]' );
	}

	async switchState( key: string ): Promise< string | null > {
		const control = this.switchIn( key );
		await expect( control ).toBeVisible( { timeout: 15000 } );
		return control.getAttribute( 'aria-checked' );
	}

	/** A field's text input, for the text and number renderers. */
	inputIn( key: string ): Locator {
		return this.field( key ).locator( 'input, textarea, select' ).first();
	}

	/** Token labels in a token select, in their saved order. */
	tokens( key: string ): Promise< string[] > {
		return this.field( key )
			.locator( '.fotogrids-token-select__token-label' )
			.allTextContents();
	}

	async removeToken( key: string, label: string ): Promise< void > {
		await this.field( key )
			.getByRole( 'button', { name: `Remove ${ label }`, exact: true } )
			.click();
	}

	/** Drag a token onto the left edge of another, placing it before that one. */
	async moveTokenBefore( key: string, label: string, before: string ): Promise< void > {
		const token = ( text: string ) =>
			this.field( key )
				.locator( '.fotogrids-token-select__token' )
				.filter( { hasText: text } );

		await token( label ).dragTo( token( before ), {
			targetPosition: { x: 4, y: 8 },
		} );
	}

	/**
	 * Switch tabs through the panel's own API rather than by clicking.
	 *
	 * The tab buttons carry no attribute naming their tab, and this takes the
	 * same catalog id the tab is defined with.
	 */
	async switchTab( tabId: string ): Promise< void > {
		await this.page.waitForFunction(
			() => !! window.FotoGridsCollectionSettings?.switchTab
		);
		await this.page.evaluate(
			( id ) => window.FotoGridsCollectionSettings.switchTab( id ),
			tabId
		);
	}

	/**
	 * Open a tab by clicking its label, as a user does. Unlike `switchTab`,
	 * this cannot be undone by the panel restoring its last tab on mount.
	 */
	async openTab( label: string ): Promise< void > {
		await this.page
			.locator( '.fotogrids-settings-tab__label' )
			.filter( { hasText: new RegExp( `^${ label }$` ) } )
			.click();
	}

	/** Visible tab labels, for asserting conditional visibility. */
	tabLabels(): Promise< string[] > {
		return this.page
			.locator( '.fotogrids-settings-tab__label' )
			.allTextContents();
	}

	/** Subtabs have no keyed attribute, so they are reached by their label. */
	subtab( label: string | RegExp ): Locator {
		return this.page
			.locator( '.fotogrids-lightbox-subtab' )
			.filter( { hasText: label } );
	}

	async openSubtab( label: string | RegExp ): Promise< void > {
		await this.subtab( label ).first().click();
	}

	/** The editor's own autosave switch, in the panel's docs strip. */
	autosaveToggle(): Locator {
		return this.page.locator(
			'.fotogrids-settings-docs-strip__autosave button[role="switch"]'
		);
	}
}

declare global {
	interface Window {
		FotoGridsCollectionSettings: { switchTab: ( tabId: string ) => void };
	}
}
