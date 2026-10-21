import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage, type Settings } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';

/**
 * Sort orders: date, title and filename with their directions, random
 * reorder and uncached modes, the seed bound, and the sorters' fallbacks.
 *
 * scoped: the galleries and the attachments sorted here are the spec's own,
 * and the attachments are removed afterwards.
 */

type Spec = { title: string; date: string; modified: string; file: string };

/** Four items whose title, dates and filename each put them in a different order. */
const SPECS: Spec[] = [
	{
		title: 'delta',
		date: '2020-01-03 10:00:00',
		modified: '2021-05-02 10:00:00',
		file: 'kilo.jpg',
	},
	{
		title: 'Bravo',
		date: '2020-01-01 10:00:00',
		modified: '2021-05-04 10:00:00',
		file: 'Echo.jpg',
	},
	{
		title: 'alpha',
		date: '2020-01-04 10:00:00',
		modified: '2021-05-01 10:00:00',
		file: 'zulu.jpg',
	},
	{
		title: 'Charlie',
		date: '2020-01-02 10:00:00',
		modified: '2021-05-03 10:00:00',
		file: 'Mike.jpg',
	},
];

const created: number[] = [];

/** Attachments on an F-small file, with the title, dates and guid given. */
function sortableItems(): number[] {
	const source = fixture<number[]>('F-small', 'items')[0];
	const ids = JSON.parse(
		wpEval(`
global $wpdb;
$file = get_post_meta( ${source}, '_wp_attached_file', true );
$meta = get_post_meta( ${source}, '_wp_attachment_metadata', true );
$ids  = array();
foreach ( json_decode( '${JSON.stringify(SPECS)}', true ) as $spec ) {
	$id = wp_insert_post( array(
		'post_type'      => 'attachment',
		'post_status'    => 'inherit',
		'post_mime_type' => 'image/jpeg',
		'post_title'     => $spec['title'],
		'post_date'      => $spec['date'],
	) );
	update_post_meta( $id, '_wp_attached_file', $file );
	update_post_meta( $id, '_wp_attachment_metadata', $meta );
	$wpdb->update( $wpdb->posts, array(
		'post_modified'     => $spec['modified'],
		'post_modified_gmt' => $spec['modified'],
		'guid'              => 'http://sort.example/uploads/' . $spec['file'],
	), array( 'ID' => $id ) );
	clean_post_cache( $id );
	$ids[] = $id;
}
echo wp_json_encode( $ids );
`)
	) as number[];
	created.push(...ids);
	return ids;
}

test.afterAll(() => {
	if (created.length) {
		const list = created.join(',');
		// Rows only: the file belongs to an F-small attachment.
		wpEval(
			`global $wpdb; $wpdb->query( "DELETE FROM {$wpdb->postmeta} WHERE post_id IN (${list})" ); $wpdb->query( "DELETE FROM {$wpdb->posts} WHERE ID IN (${list})" );`
		);
	}
});

async function renderedOrder(page: Page, url: string, id: number) {
	await page.goto(url);
	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	return gallery.root
		.locator('.fg-item [data-fg-item-id]')
		.evaluateAll((nodes) =>
			nodes.map((node) => Number(node.getAttribute('data-fg-item-id')))
		);
}

test.describe('ordered sorts', () => {
	const pick = (ids: number[], order: number[]) => order.map((i) => ids[i]);

	const CASES: Array<[string, Settings, number[]]> = [
		[
			'SORT-02: date created, ascending',
			{
				default_sort_order: 'date',
				date_sort_type: 'date_created',
				date_sort_direction: 'asc',
			},
			[1, 3, 0, 2],
		],
		[
			'SORT-02: date created, descending',
			{
				default_sort_order: 'date',
				date_sort_type: 'date_created',
				date_sort_direction: 'desc',
			},
			[2, 0, 3, 1],
		],
		[
			'SORT-02: date updated, ascending',
			{
				default_sort_order: 'date',
				date_sort_type: 'date_updated',
				date_sort_direction: 'asc',
			},
			[2, 0, 3, 1],
		],
		[
			'SORT-02: date updated, descending',
			{
				default_sort_order: 'date',
				date_sort_type: 'date_updated',
				date_sort_direction: 'desc',
			},
			[1, 3, 0, 2],
		],
		[
			'SORT-03: title ascending, ignoring case',
			{ default_sort_order: 'title', title_sort_direction: 'asc' },
			[2, 1, 3, 0],
		],
		[
			'SORT-03: title descending, ignoring case',
			{ default_sort_order: 'title', title_sort_direction: 'desc' },
			[0, 3, 1, 2],
		],
		[
			'SORT-04: filename ascending, ignoring case and the title direction',
			{
				default_sort_order: 'filename',
				title_sort_direction: 'desc',
				date_sort_direction: 'desc',
			},
			[1, 0, 3, 2],
		],
	];

	for (const [title, settings, order] of CASES) {
		/** The rendered order follows the chosen field and direction, not the editor's order. */
		test(title, { tag: '@layout' }, async ({ page }) => {
			const items = sortableItems();
			const { id, url } = galleryPage(
				{ layout: 'grid', ...settings },
				items
			);

			expect(await renderedOrder(page, url, id)).toEqual(
				pick(items, order)
			);
		});
	}

	/** Embeds sort by their video ID among the attachments' filenames. */
	test(
		'SORT-04: a mixed gallery sorts embeds by video ID among attachment filenames',
		{ tag: '@layout' },
		async ({ page }) => {
			const mixed = [
				fixture<number>('F-mixed', 'youtube'),
				fixture<number>('F-mixed', 'vimeo'),
				...sortableItems(),
			];
			const keys = JSON.parse(
				wpEval(`
$keys = array();
foreach ( array( ${mixed.join(',')} ) as $id ) {
	$embed = \\FotoGrids\\Galleries\\Embed_Store::get( $id );
	$keys[] = array( 'id' => $id, 'embed' => $embed ? (string) $embed['video_id'] : null, 'key' => $embed ? (string) $embed['video_id'] : basename( get_post( $id )->guid ) );
}
echo wp_json_encode( $keys );
`)
			) as Array<{ id: number; embed: string | null; key: string }>;
			const expected = [...keys]
				.sort((a, b) => {
					const x = a.key.toLowerCase();
					const y = b.key.toLowerCase();
					return x < y ? -1 : Number(x > y);
				})
				.map((entry) => entry.embed ?? String(entry.id));

			const { id, url } = galleryPage(
				{ layout: 'grid', default_sort_order: 'filename' },
				mixed
			);
			await page.goto(url);
			const gallery = new GalleryRender(page, id);
			await gallery.waitFor();
			const shown = await gallery.root
				.locator('.fg-item')
				.evaluateAll((nodes) =>
					nodes.map((node) => {
						const embed = node.querySelector('[data-fg-embed-id]');
						if (embed) {
							return String(
								embed.getAttribute('data-fg-embed-id')
							);
						}
						return String(
							node
								.querySelector('[data-fg-item-id]')
								?.getAttribute('data-fg-item-id')
						);
					})
				);

			expect(shown).toEqual(expected);
		}
	);

	/** Ids the sort lookup cannot find keep their relative order, after the sorted ones. */
	test(
		'SORT-09: items the sort query does not return follow the sorted ones in their own order',
		{ tag: '@layout' },
		async () => {
			const items = sortableItems();
			const { id } = galleryPage({ default_sort_order: 'title' }, items);
			const input = [
				999999,
				items[0],
				id,
				items[1],
				999990,
				items[2],
				items[3],
			];

			const sorted = JSON.parse(
				wpEval(`
$ctx = \\FotoGrids\\Render\\Internal\\Gallery_Item_Sequence::stub_context( ${id}, array( 'default_sort_order' => 'title', 'title_sort_direction' => 'asc' ) );
$out = array();
foreach ( array( 'Title', 'Date', 'Filename' ) as $name ) {
	$class = "\\\\FotoGrids\\\\Render\\\\Sorters\\\\{$name}\\\\{$name}_Sorter";
	$out[ $name ] = ( new $class() )->sort( array( ${input.join(',')} ), $ctx );
}
echo wp_json_encode( $out );
`)
			) as Record<string, number[]>;

			expect(sorted.Title).toEqual([
				items[2],
				items[1],
				items[3],
				items[0],
				999999,
				id,
				999990,
			]);
			expect(sorted.Date).toEqual([
				items[2],
				items[0],
				items[3],
				items[1],
				999999,
				id,
				999990,
			]);
			expect(sorted.Filename).toEqual([
				items[1],
				items[0],
				items[3],
				items[2],
				999999,
				id,
				999990,
			]);
		}
	);

	/** In a preview render no sorter claims the gallery, so the editor's order stands. */
	test(
		'SORT-10: every sorter stands aside in a preview render',
		{ tag: '@layout' },
		async () => {
			const { id } = galleryPage();
			const result = JSON.parse(
				wpEval(`
use FotoGrids\\Render\\Api\\Render_Context;
use FotoGrids\\Render\\Internal\\Gallery_Item_Sequence;
use FotoGrids\\Render\\Internal\\Module_Registry;
$out = array();
foreach ( array( 'manual', 'date', 'title', 'filename', 'random' ) as $order ) {
	$ctx     = Gallery_Item_Sequence::stub_context( ${id}, array( 'default_sort_order' => $order ) );
	$preview = new Render_Context( $ctx->meta->with( array( 'is_preview' => true ) ), $ctx->layout, $ctx->behavior, $ctx->settings, $ctx->items );
	$out[ $order ] = array(
		'live'    => array_map( static fn( $m ) => $m->id(), Module_Registry::active_modules( 'sorters', $ctx ) ),
		'preview' => count( Module_Registry::active_modules( 'sorters', $preview ) ),
	);
}
echo wp_json_encode( $out );
`)
			) as Record<string, { live: string[]; preview: number }>;

			for (const order of [
				'manual',
				'date',
				'title',
				'filename',
				'random',
			]) {
				expect(result[order].live, order).toEqual([
					`fotogrids/sort/${order}`,
				]);
				expect(result[order].preview, order).toBe(0);
			}
		}
	);
});

test.describe('random', () => {
	const sixty = (): number[] => fixture<number[]>('F-large', 'items');

	/** Reorder mode rearranges the items the server sent without asking it for anything. */
	test(
		'SORT-06: reorder mode shuffles the delivered items in place, with no request',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'grid',
					pagination_type: 'show_all',
					default_sort_order: 'random',
					random_mode: 'reorder',
				},
				sixty()
			);
			const requests: string[] = [];
			page.on('request', (request) => {
				if (request.url().includes('/gallery/')) {
					requests.push(request.url());
				}
			});

			const response = await page.goto(url);
			const served = [
				...(await response!.text()).matchAll(
					/data-fg-item-id="(\d+)"/g
				),
			].map((match) => Number(match[1]));
			const gallery = new GalleryRender(page, id);
			await expect(gallery.root).toHaveAttribute(
				'data-fg-random-sort-ready',
				'1'
			);
			const shown = await gallery.root
				.locator('.fg-item [data-fg-item-id]')
				.evaluateAll((nodes) =>
					nodes.map((node) =>
						Number(node.getAttribute('data-fg-item-id'))
					)
				);

			expect(served).toHaveLength(60);
			expect([...shown].sort((a, b) => a - b)).toEqual(
				[...served].sort((a, b) => a - b)
			);
			expect(shown).not.toEqual(served);
			expect(requests).toEqual([]);
		}
	);

	function cacheRows(galleryId: number): number {
		return Number(
			wpEval(
				`global $wpdb; echo (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${galleryId} ) );`
			).trim()
		);
	}

	function donotcachepage(galleryId: number): string {
		return wpEval(
			`do_shortcode( '[fotogrids_gallery id="${galleryId}"]' ); echo defined( 'DONOTCACHEPAGE' ) && DONOTCACHEPAGE ? 'yes' : 'no';`
		).trim();
	}

	/** Uncached mode opts the page out of every cache; refetch mode leaves the page cacheable. */
	test(
		'SORT-07: uncached mode sends no-store, defines DONOTCACHEPAGE and writes no cache row',
		{ tag: ['@layout', '@cache'] },
		async ({ browser }) => {
			const uncached = galleryPage(
				{
					default_sort_order: 'random',
					random_mode: 'uncached',
					enable_cache: true,
				},
				sixty()
			);
			const refetch = galleryPage(
				{
					default_sort_order: 'random',
					random_mode: 'refetch',
					enable_cache: true,
				},
				sixty()
			);
			const guest = await browser.newContext();

			const off = await guest.request.get(uncached.url);
			expect(off.headers()['cache-control'] ?? '').toContain('no-store');
			expect(donotcachepage(uncached.id)).toBe('yes');
			expect(cacheRows(uncached.id)).toBe(0);

			const on = await guest.request.get(refetch.url);
			expect(on.headers()['cache-control'] ?? '').not.toContain(
				'no-store'
			);
			expect(donotcachepage(refetch.id)).toBe('no');
			expect(cacheRows(refetch.id)).toBe(1);

			await guest.close();
		}
	);

	/** Every seed the server mints fits a 31-bit integer, so it survives a JavaScript round-trip. */
	test(
		'SORT-08: server-minted seeds stay within 1..2^31-1',
		{ tag: '@layout' },
		async () => {
			const { id } = galleryPage(
				{ default_sort_order: 'random', enable_cache: false },
				fixture<number[]>('F-small', 'items')
			);
			const seeds = JSON.parse(
				wpEval(`
$seeds = array();
for ( $i = 0; $i < 40; $i++ ) {
	preg_match( '/data-fg-random-seed="(\\d+)"/', do_shortcode( '[fotogrids_gallery id="${id}"]' ), $m );
	$seeds[] = $m[1] ?? '';
}
echo wp_json_encode( $seeds );
`)
			) as string[];

			expect(seeds).toHaveLength(40);
			for (const seed of seeds) {
				expect(seed).toMatch(/^\d+$/);
				const value = BigInt(seed);
				expect(value >= 1n && value <= 2147483647n, seed).toBe(true);
			}
			expect(new Set(seeds).size).toBeGreaterThan(1);
		}
	);
});
