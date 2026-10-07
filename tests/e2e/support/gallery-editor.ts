import { expect, type Locator, type Page } from '@playwright/test';

/** The gallery edit screen: its items metabox, its save controls and its list. */

const LIST = '/wp-admin/edit.php?post_type=fotogrids_gallery';
const ADD_NEW = '/wp-admin/post-new.php?post_type=fotogrids_gallery';

/** Past ajax-save.js's 2s autosave debounce, with room to spare. */
export const PAST_DEBOUNCE = 6000;

export class GalleryEditor {
	constructor( private readonly page: Page ) {}

	/** Open Add New, asserting the screen is still an auto-draft. */
	async openNew(): Promise< void > {
		await this.page.goto( ADD_NEW );
		await expect( this.title() ).toBeVisible( { timeout: 15000 } );
		await expect( this.page.locator( '#original_post_status' ) ).toHaveValue(
			'auto-draft'
		);
	}

	async open( galleryId: number ): Promise< void > {
		await this.page.goto( `/wp-admin/post.php?post=${ galleryId }&action=edit` );
		await expect( this.metabox() ).toBeVisible( { timeout: 15000 } );
	}

	/** Titles in the gallery list, so a failure names what appeared. */
	async listTitles(): Promise< string[] > {
		await this.page.goto( LIST );
		await expect( this.page.locator( '#the-list' ) ).toBeVisible( {
			timeout: 15000,
		} );
		return this.page
			.locator( '#the-list tr.type-fotogrids_gallery .row-title' )
			.allTextContents();
	}

	title(): Locator {
		return this.page.locator( '#title' );
	}

	metabox(): Locator {
		return this.page.locator( '.fotogrids-gallery-metabox' );
	}

	items(): Locator {
		return this.page.locator( '#fotogrids-items-grid .fotogrids-item-item' );
	}

	item( attachmentId: number ): Locator {
		return this.page.locator(
			`#fotogrids-items-grid .fotogrids-item-item[data-id="${ attachmentId }"]`
		);
	}

	/** Ids in grid order, which is the order the gallery will save. */
	itemOrder(): Promise< string[] > {
		return this.items().evaluateAll( ( elements ) =>
			elements.map( ( element ) => element.getAttribute( 'data-id' ) ?? '' )
		);
	}

	featured( attachmentId: number ): Locator {
		return this.item( attachmentId ).locator( '.fotogrids-item-featured-button' );
	}

	/** Featured state, read from aria-pressed rather than from a class. */
	async isFeatured( attachmentId: number ): Promise< boolean > {
		return (
			'true' ===
			( await this.featured( attachmentId ).getAttribute( 'aria-pressed' ) )
		);
	}

	async toggleFeatured( attachmentId: number ): Promise< void > {
		await this.featured( attachmentId ).click();
	}

	removeItem( attachmentId: number ): Locator {
		return this.item( attachmentId ).locator( '.fotogrids-remove-item' );
	}

	editItem( attachmentId: number ): Locator {
		return this.item( attachmentId ).locator( '.fotogrids-edit-item' );
	}

	removeAllButton(): Locator {
		return this.page.locator( '.fotogrids-items-remove-all' );
	}

	/** The Remove All confirmation, once open. */
	removeAllDialog(): Locator {
		return this.page.getByRole( 'dialog', { name: 'Remove all gallery items?' } );
	}

	addNewMenu(): Locator {
		return this.page.locator( '.fotogrids-add-new-toggle' );
	}

	unsavedBanner(): Locator {
		return this.page.locator( '#fotogrids-unsaved-changes' );
	}

	/**
	 * Dispatch the event every settings panel and the item grid send on a change.
	 *
	 * Used instead of typing in the title: WordPress core auto-saves a new post
	 * on title blur by itself, which masks what an autosave test is watching.
	 */
	async changeASetting(): Promise< void > {
		await this.page.evaluate( () => {
			document.dispatchEvent(
				new CustomEvent( 'fotogrids:setting_changed', {
					detail: { source: 'e2e' },
				} )
			);
		} );
	}

	/** The three ways a collection is saved. */
	quickSave(): Locator {
		return this.page.locator( '#fotogrids-quick-save' );
	}

	updateButton(): Locator {
		return this.page.locator( '#save-post' );
	}

	publishButton(): Locator {
		return this.page.locator( '#publish' );
	}

	/** Whether a save control is showing the unsaved-changes state. */
	async hasChanges(): Promise< boolean > {
		const control = this.page.locator( '#publish, #save-post' ).first();
		return ( await control.getAttribute( 'class' ) )?.includes(
			'fotogrids-has-changes'
		) ?? false;
	}
}
