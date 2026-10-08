import { expect, type Locator, type Page } from '@playwright/test';
import type { GalleryRender } from './gallery-render';

/**
 * The classic lightbox.
 *
 * Built entirely by lightbox.js at runtime, so nothing here exists before the
 * first open. The triggers it opens from are server-rendered on the gallery.
 */
export class Lightbox {
	constructor( private readonly page: Page ) {}

	dialog(): Locator {
		return this.page.locator( 'dialog.fg-lightbox' );
	}

	/** Click a gallery item and wait for the dialog to build itself. */
	async openFrom( gallery: GalleryRender, index = 0 ): Promise< void > {
		await gallery.triggers().nth( index ).click();
		await expect( this.dialog() ).toBeVisible( { timeout: 15000 } );
		await expect( this.image() ).toHaveJSProperty( 'complete', true );
	}

	image(): Locator {
		return this.dialog().locator( '.fg-lb-img' );
	}

	/** The source currently on the stage, for asserting navigation moved. */
	currentSrc(): Promise< string | null > {
		return this.image().getAttribute( 'src' );
	}

	next(): Locator {
		return this.dialog().locator( '.fg-lb-next' );
	}

	prev(): Locator {
		return this.dialog().locator( '.fg-lb-prev' );
	}

	/**
	 * Which item is on the stage, from the active dot.
	 *
	 * Reading the image `src` instead looks simpler but is unreliable: the stage
	 * keeps the previous source through the crossfade, so a navigation that has
	 * visibly happened can still report the old one. Dots are off by default -
	 * a spec that navigates turns `lightbox_show_dots` on.
	 *
	 * @throws When dots are not enabled, rather than reporting -1 forever.
	 */
	async index(): Promise< number > {
		const dots = await this.dots().count();
		if ( 0 === dots ) {
			throw new Error(
				'The lightbox has no dots, so there is nothing to read the current item from. Create the gallery with lightbox_show_dots: true.'
			);
		}

		const active = await this.dots()
			.and( this.page.locator( '[aria-selected="true"]' ) )
			.getAttribute( 'data-lb-index' );

		return Number( active );
	}

	async goNext(): Promise< void > {
		await this.navigate( this.next() );
	}

	async goPrev(): Promise< void > {
		await this.navigate( this.prev() );
	}

	/**
	 * Click a navigation control and wait for the stage to move.
	 *
	 * Navigation is ignored while a crossfade is running, so a caller chaining
	 * two of these gives the first one time to finish.
	 */
	private async navigate( control: Locator ): Promise< void > {
		const before = await this.index();

		await control.click();
		await expect
			.poll( () => this.index(), { timeout: 15000 } )
			.not.toBe( before );
	}

	infoToggle(): Locator {
		return this.dialog().locator( '.fg-lb-info-toggle' );
	}

	info(): Locator {
		return this.dialog().locator( '.fg-lb-info' );
	}

	dots(): Locator {
		return this.dialog().locator( '.fg-lb-dot' );
	}

	thumbs(): Locator {
		return this.dialog().locator( '.fg-lb-thumb' );
	}

	closeButton(): Locator {
		return this.dialog().locator( '.fg-lb-close' );
	}

	async close(): Promise< void > {
		await this.closeButton().click();
		await expect( this.dialog() ).toBeHidden( { timeout: 15000 } );
	}
}
