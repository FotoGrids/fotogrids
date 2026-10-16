import { test, expect } from './support/test';
import { album, galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { wpEval } from './support/roles';

/**
 * A view page whose slug two collections share.
 *
 * WordPress's unique-slug check is not atomic, so collections created at the
 * same moment can end up with one slug. The view page still renders one of
 * them, whole.
 *
 * scoped: each test makes its own collections and renames only those.
 */

const items = (): number[] => fixture<number[]>('F-small', 'items');

/** Give every id the same slug and return the view page URL they now share. */
function shareSlug(ids: number[]): string {
	const slug = `shared-slug-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

	return wpEval(`
		global $wpdb;
		foreach ( array( ${ids.join(', ')} ) as $id ) {
			$wpdb->update( $wpdb->posts, array( 'post_name' => '${slug}' ), array( 'ID' => $id ) );
			clean_post_cache( $id );
		}
		echo get_permalink( ${ids[0]} );
	`).trim();
}

test.describe('a view page two collections share a slug with', () => {
	test(
		'renders one of the galleries, with its share footer',
		{ tag: '@layout' },
		async ({ page }) => {
			const ids = [
				galleryPage({ layout: 'grid' }, items().slice(0, 2)).id,
				galleryPage({ layout: 'grid' }, items().slice(2, 4)).id,
			];

			await page.goto(shareSlug(ids));

			const wrapper = page.locator(
				'.fotogrids-gallery[data-fg-gallery-id]'
			);
			await expect(wrapper).toHaveCount(1);
			expect(ids).toContain(
				Number(await wrapper.getAttribute('data-fg-gallery-id'))
			);
			await expect(wrapper.locator('.fg-item')).toHaveCount(2);
			await expect(page.locator('[data-fg-share-footer]')).toHaveCount(1);
		}
	);

	test(
		'renders one of the albums, with its share footer',
		{ tag: '@layout' },
		async ({ page }) => {
			const child = (): number =>
				galleryPage({ layout: 'grid' }, items().slice(0, 2)).id;
			const ids = [album([child()]).id, album([child(), child()]).id];

			await page.goto(shareSlug(ids));

			const wrapper = page.locator('[data-fg-album-id]');
			await expect(wrapper).toHaveCount(1);
			const shown = Number(
				await wrapper.getAttribute('data-fg-album-id')
			);
			expect(ids).toContain(shown);
			await expect(wrapper.locator('.fg-item')).toHaveCount(
				shown === ids[0] ? 1 : 2
			);
			await expect(page.locator('[data-fg-share-footer]')).toHaveCount(1);
		}
	);
});
