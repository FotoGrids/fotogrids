import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { firstItem } from './support/fixtures';
import { storageStateFor, wpEval } from './support/roles';
import { cloneAttachment, deleteAttachments } from './support/media';

test.use({ storageState: storageStateFor('administrator') });

/**
 * The Library tables: search, sort, paging, the unused filter, rename, delete,
 * recalculating counts, and the People and Locations extras.
 *
 * Serial: the Library is site-wide and Recalculate counts rewrites every
 * entry's count. Every entry here carries a per-run prefix and is removed.
 */

test.describe.configure({ mode: 'serial' });

const LIBRARY = '/wp-admin/admin.php?page=fotogrids-library';
const P = `e2e-lib-${process.pid}-`;
const TAGS = Array.from(
	{ length: 52 },
	(_, i) => `${P}t${String(i + 1).padStart(2, '0')}`
);

let items: number[] = [];
let galleryId = 0;

test.beforeAll(() => {
	items = [1, 2].map((n) =>
		cloneAttachment(
			firstItem('F-single'),
			`library-${n}-${process.pid}.jpg`
		)
	);
	galleryId = galleryPage({}, items).id;

	// t01 is on both items, t02 on one; the other fifty are unused.
	wpEval(`
		foreach ( ${JSON.stringify(TAGS).replace(/"/g, "'").replace(/^\[/, 'array( ').replace(/\]$/, ' )')} as $name ) {
			\\FotoGrids\\Metadata_Manager::add_or_get_tag( $name );
		}
		\\FotoGrids\\Metadata_Manager::add_tag_to_item( ${items[0]}, '${TAGS[0]}' );
		\\FotoGrids\\Metadata_Manager::add_tag_to_item( ${items[1]}, '${TAGS[0]}' );
		\\FotoGrids\\Metadata_Manager::add_tag_to_item( ${items[0]}, '${TAGS[1]}' );
	`);
});

test.afterAll(() => {
	wpEval(`
		global $wpdb;
		$ids = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}fotogrids_tags WHERE name LIKE %s", '${P}%' ) );
		foreach ( $ids as $id ) { \\FotoGrids\\Metadata_Manager::delete_metadata( (int) $id ); }
		wp_delete_post( ${galleryId}, true );
	`);
	deleteAttachments(items);
});

function rows(page: Page): Locator {
	return page.locator('.fotogrids-library-table tbody tr').filter({
		has: page.locator('.fotogrids-library-name-button'),
	});
}

function row(page: Page, name: string): Locator {
	return rows(page).filter({
		has: page.locator('.fotogrids-library-name-button', {
			hasText: new RegExp(`^${name}$`),
		}),
	});
}

function names(page: Page): Promise<string[]> {
	return rows(page).locator('.fotogrids-library-name-button').allInnerTexts();
}

async function openTab(page: Page, tab: string): Promise<void> {
	await page.goto(LIBRARY);
	await page
		.locator('.fotogrids-library-sidebar-tabs')
		.getByText(tab, { exact: true })
		.first()
		.click();
	await expect(page.locator('.fotogrids-library-table')).toBeVisible();
}

async function search(page: Page, label: string, text: string): Promise<void> {
	const list = page.waitForResponse((r) =>
		decodeURIComponent(r.url()).includes(`search=${text}`)
	);
	await page.getByPlaceholder(`Search ${label}…`).fill(text);
	await list;
	await expect(rows(page).first()).toBeVisible();
}

function stored(name: string): {
	slug: string;
	usage_count: string;
	meta: string | null;
} {
	return JSON.parse(
		wpEval(
			`global $wpdb; echo wp_json_encode( $wpdb->get_row( $wpdb->prepare( "SELECT slug, usage_count, meta FROM {$wpdb->prefix}fotogrids_tags WHERE name = %s", '${name}' ) ) );`
		)
	);
}

/**
 * LIB-01. Search narrows the list to matching names, fifty to a page with a
 * pager for the rest, and each column header sorts by its column, a second
 * click reversing it.
 */
test(
	'LIB-01: the Tags table searches, pages and sorts by name, slug and items',
	{ tag: '@admin' },
	async ({ page }) => {
		// One slug that sorts first though its name does not, as a renamed import leaves.
		wpEval(
			`global $wpdb; $wpdb->update( $wpdb->prefix . 'fotogrids_tags', array( 'slug' => '${P}a00' ), array( 'name' => '${TAGS[39]}' ) );`
		);

		await openTab(page, 'Tags');
		await search(page, 'tags', P);

		await expect(rows(page)).toHaveCount(50);
		await expect(
			page.locator('.fotogrids-library-pagination .displaying-num')
		).toHaveText('52 entries');
		await expect(
			page.locator('.fotogrids-library-pagination .paging-input')
		).toHaveText('1 of 2');
		expect(await names(page)).toEqual(TAGS.slice(0, 50));

		await page
			.locator('.fotogrids-library-pagination')
			.getByRole('button', { name: '›' })
			.click();
		await expect(
			page.locator('.fotogrids-library-pagination .paging-input')
		).toHaveText('2 of 2');
		await expect.poll(() => names(page)).toEqual(TAGS.slice(50));

		const sortBy = (column: string) =>
			page
				.locator('.fotogrids-library-sort', { hasText: column })
				.click();

		await sortBy('Name');
		await expect
			.poll(async () => (await names(page)).slice(0, 2))
			.toEqual([TAGS[51], TAGS[50]]);

		await sortBy('Slug');
		await expect
			.poll(async () => (await names(page)).slice(0, 2))
			.toEqual([TAGS[39], TAGS[0]]);

		await sortBy('Items');
		await sortBy('Items');
		await expect
			.poll(async () => (await names(page)).slice(0, 2))
			.toEqual([TAGS[0], TAGS[1]]);
		await expect(
			row(page, TAGS[0]).locator('.fotogrids-library-table__column-usage')
		).toHaveText('2');

		await page.getByPlaceholder('Search tags…').fill(`${P}t5`);
		await expect.poll(() => names(page)).toEqual(TAGS.slice(49));
		await expect(rows(page)).toHaveCount(3);
		await expect(page.locator('.fotogrids-library-pagination')).toHaveCount(
			0
		);
	}
);

/**
 * LIB-06. Unused only hides every entry an item carries.
 */
test(
	'LIB-06: Unused only leaves out the entries items carry',
	{ tag: '@admin' },
	async ({ page }) => {
		await openTab(page, 'Tags');
		await search(page, 'tags', P);
		await expect(row(page, TAGS[0])).toHaveCount(1);

		const list = page.waitForResponse((r) =>
			decodeURIComponent(r.url()).includes('unused_only=1')
		);
		await page
			.locator('.fotogrids-library-toolbar-filter')
			.getByText('Unused only')
			.click();
		await list;

		await expect(row(page, TAGS[0])).toHaveCount(0);
		await expect(row(page, TAGS[1])).toHaveCount(0);
		await expect(rows(page)).toHaveCount(50);
		expect(
			(
				await rows(page)
					.locator('.fotogrids-library-table__column-usage')
					.allInnerTexts()
			).every((n) => '0' === n.trim())
		).toBe(true);
	}
);

/**
 * LIB-02. Renaming inline saves the new name and derives a new slug from it,
 * both shown at once and both still there after a reload.
 */
test(
	'LIB-02: an inline rename saves the name and updates the slug',
	{ tag: '@admin' },
	async ({ page }) => {
		const renamed = `${P}Renamed Entry`;
		const slug = `${P}renamed-entry`;

		await openTab(page, 'Tags');
		await search(page, 'tags', P);
		await row(page, TAGS[2])
			.locator('.fotogrids-library-name-button')
			.click();
		await page
			.locator('.fotogrids-library-table tbody input[type=text]')
			.first()
			.fill(renamed);
		await page.keyboard.press('Enter');

		await expect(
			row(page, renamed).locator('.fotogrids-library-slug')
		).toHaveText(slug);
		expect(stored(renamed).slug).toBe(slug);

		await openTab(page, 'Tags');
		await search(page, 'tags', renamed);
		await expect(
			row(page, renamed).locator('.fotogrids-library-slug')
		).toHaveText(slug);
	}
);

/**
 * LIB-03. Deleting asks first, and says how many items lose the entry, or that
 * none use it.
 */
test(
	'LIB-03: the delete confirmation names the items an entry is on, or says it has none',
	{ tag: '@admin' },
	async ({ page }) => {
		await openTab(page, 'Tags');
		await search(page, 'tags', P);
		const popover = page.locator('.fotogrids-library-delete-popover');

		await row(page, TAGS[0])
			.getByRole('button', { name: 'Delete' })
			.click();
		await expect(popover.locator('p')).toHaveText(
			`Delete "${TAGS[0]}"? This will remove it from 2 items.`
		);
		await popover.getByRole('button', { name: 'Cancel' }).click();
		await expect(popover).toHaveCount(0);

		await row(page, TAGS[1])
			.getByRole('button', { name: 'Delete' })
			.click();
		await expect(popover.locator('p')).toHaveText(
			`Delete "${TAGS[1]}"? This will remove it from 1 item.`
		);
		await popover.getByRole('button', { name: 'Cancel' }).click();

		await row(page, TAGS[4])
			.getByRole('button', { name: 'Delete' })
			.click();
		await expect(popover.locator('p')).toHaveText(
			`Delete "${TAGS[4]}"? It is not used by any items.`
		);
		await popover.getByRole('button', { name: 'Cancel' }).click();

		expect(stored(TAGS[0])).not.toBeNull();
	}
);

/**
 * LIB-05. Recalculate counts recounts every entry from the items that carry
 * it, putting back counts that were written wrong.
 */
test(
	'LIB-05: Recalculate counts repairs corrupted item counts',
	{ tag: '@admin' },
	async ({ page }) => {
		wpEval(`
		global $wpdb;
		$t = $wpdb->prefix . 'fotogrids_tags';
		$wpdb->update( $t, array( 'usage_count' => 99 ), array( 'name' => '${TAGS[1]}' ) );
		$wpdb->update( $t, array( 'usage_count' => 7 ), array( 'name' => '${TAGS[5]}' ) );
	`);

		await openTab(page, 'Tags');
		await search(page, 'tags', P);
		const usage = (name: string) =>
			row(page, name).locator('.fotogrids-library-table__column-usage');
		await expect(usage(TAGS[1])).toHaveText('99');
		await expect(usage(TAGS[5])).toHaveText('7');

		const done = page.waitForResponse((r) =>
			decodeURIComponent(r.url()).includes('/tags/recalculate')
		);
		await page.getByRole('button', { name: 'Recalculate counts' }).click();
		expect((await done).status()).toBe(200);

		await expect(
			page.getByText(/^Recalculated counts for \d+ tags\.$/)
		).toBeVisible();
		await expect(usage(TAGS[1])).toHaveText('1');
		await expect(usage(TAGS[5])).toHaveText('0');
		expect(stored(TAGS[1]).usage_count).toBe('1');
		expect(stored(TAGS[0]).usage_count).toBe('2');
	}
);

/**
 * LIB-09. Deleting a tag takes it off its items and leaves the items, and the
 * gallery holding them, as they were.
 */
test(
	'LIB-09: deleting a used tag removes it from items without removing the items',
	{ tag: '@admin' },
	async ({ page }) => {
		await openTab(page, 'Tags');
		await search(page, 'tags', P);
		await row(page, TAGS[0])
			.getByRole('button', { name: 'Delete' })
			.click();
		const deleted = page.waitForResponse(
			(r) =>
				/\/library\/tags\/\d+/.test(decodeURIComponent(r.url())) &&
				'GET' !== r.request().method()
		);
		await page
			.locator('.fotogrids-library-delete-popover')
			.getByRole('button', { name: 'Delete' })
			.click();
		expect((await deleted).status()).toBe(200);
		await expect(row(page, TAGS[0])).toHaveCount(0);

		const after = JSON.parse(
			wpEval(`
			$out = array();
			foreach ( array( ${items.join(',')} ) as $id ) {
				$m = \\FotoGrids\\Metadata_Manager::get_item_metadata( $id );
				$out[] = array( 'type' => get_post_type( $id ), 'tags' => array_map( fn( $t ) => $t->name, $m['tags'] ?? array() ) );
			}
			echo wp_json_encode( array( 'items' => $out, 'gallery' => \\FotoGrids\\Galleries\\Gallery_Repository::get_item_ids( ${galleryId} ) ) );
		`)
		);

		expect(after.items).toEqual([
			{ type: 'attachment', tags: [TAGS[1]] },
			{ type: 'attachment', tags: [] },
		]);
		expect(after.gallery.map(Number)).toEqual(items);
	}
);

/**
 * LIB-07. A person's optional Details are saved with them and survive a
 * rename; a location with coordinates is plotted on the Geo Coverage map.
 */
test(
	'LIB-07: People keep their details through a rename and Locations plot their coordinates',
	{ tag: '@admin' },
	async ({ page }) => {
		const person = `${P}Person`;
		const renamed = `${P}Person Renamed`;
		const details = 'Second shooter, weddings only';

		await openTab(page, 'People');
		await page.getByRole('button', { name: 'Add Person' }).click();
		await page.fill('#fg-library-create-name', person);
		await page.fill('#fg-library-create-details', details);
		await page.getByRole('button', { name: 'Create', exact: true }).click();
		await expect(row(page, person)).toBeVisible();
		expect(JSON.parse(stored(person).meta ?? '{}')).toMatchObject({
			details,
		});

		await row(page, person)
			.locator('.fotogrids-library-name-button')
			.click();
		await page
			.locator('.fotogrids-library-table tbody input[type=text]')
			.first()
			.fill(renamed);
		await page.keyboard.press('Enter');
		await expect(row(page, renamed)).toBeVisible();
		expect(JSON.parse(stored(renamed).meta ?? '{}')).toMatchObject({
			details,
		});

		// Lisbon, made the most-used location so it is among the plotted ones.
		const place = `${P}Lisbon`;
		wpEval(`
		\\FotoGrids\\Metadata_Manager::add_or_get_location( '${place}', 38.7223, -9.1393 );
		global $wpdb;
		$wpdb->update( $wpdb->prefix . 'fotogrids_tags', array( 'usage_count' => 100000 ), array( 'name' => '${place}' ) );
	`);

		await openTab(page, 'Locations');
		const dot = page.locator('.fg-lib-geo-svg g').filter({
			has: page.locator('title', { hasText: `${place} (100000 items)` }),
		});
		await expect(dot).toHaveCount(1);
		const centre = await dot
			.locator('circle')
			.last()
			.evaluate((c) => [
				Number(c.getAttribute('cx')),
				Number(c.getAttribute('cy')),
			]);
		expect(centre[0]).toBeCloseTo(((-9.1393 + 180) / 360) * 300, 3);
		expect(centre[1]).toBeCloseTo(((90 - 38.7223) / 180) * 150, 3);
		await expect(
			row(page, place).locator('.fotogrids-library-table__column-extra')
		).toContainText('38.7223');
	}
);
