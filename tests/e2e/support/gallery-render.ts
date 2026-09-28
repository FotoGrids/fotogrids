import { expect, type Locator, type Page } from '@playwright/test';

/**
 * A rendered gallery on the front end.
 *
 * Addresses the wrapper by `data-fg-gallery-id` rather than by its `id`, which
 * carries a per-request counter (`fg-42-1`) and changes between renders.
 */
export class GalleryRender {
	readonly root: Locator;

	constructor(
		private readonly page: Page,
		readonly galleryId: number
	) {
		this.root = page.locator( `[data-fg-gallery-id="${ galleryId }"]` );
	}

	/** Wait for the wrapper, so a later read cannot race the render. */
	async waitFor(): Promise< void > {
		await expect( this.root ).toBeVisible();
	}

	/** The layout the render pipeline chose, e.g. `grid` or `masonry`. */
	layout(): Promise< string | null > {
		return this.root.getAttribute( 'data-fg-layout' );
	}

	/** Any wrapper attribute, for the ones a layout or decorator contributes. */
	attr( name: string ): Promise< string | null > {
		return this.root.getAttribute(
			name.startsWith( 'data-' ) ? name : `data-fg-${ name }`
		);
	}

	items(): Locator {
		return this.root.locator( '.fg-item' );
	}

	/** Lightbox triggers, present only when the lightbox is on. */
	triggers(): Locator {
		return this.root.locator( '[data-fg-lightbox-trigger]' );
	}

	/**
	 * A CSS custom property resolved on the wrapper.
	 *
	 * Column counts, gaps and aspect ratios reach the browser as `--fg-*`
	 * variables rather than attributes, so a settings-driven assertion about
	 * them has to read computed style.
	 */
	cssVar( name: string ): Promise< string > {
		const property = name.startsWith( '--' ) ? name : `--fg-${ name }`;

		return this.root.evaluate(
			( element, prop ) =>
				getComputedStyle( element ).getPropertyValue( prop ).trim(),
			property
		);
	}
}
