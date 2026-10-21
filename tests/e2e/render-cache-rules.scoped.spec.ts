import type { APIRequestContext } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { apiAnonymous, wpEval } from './support/roles';

/**
 * The render cache: the key follows every input, item changes invalidate,
 * entries expire on the site's clock, and requests that must render live
 * never use it.
 *
 * Scoped: every gallery, attachment and cache row here is the spec's own.
 */

const CACHED = { layout: 'grid', enable_cache: true };

const five = (): number[] => fixture<number[]>('F-small', 'items');

const made: number[] = [];

test.afterAll(() => {
	if (made.length) {
		const list = made.join(',');
		// Rows only: the file belongs to an F-small attachment.
		wpEval(
			`global $wpdb; $wpdb->query( "DELETE FROM {$wpdb->prefix}fotogrids_item_meta WHERE attachment_id IN (${list})" ); $wpdb->query( "DELETE FROM {$wpdb->postmeta} WHERE post_id IN (${list})" ); $wpdb->query( "DELETE FROM {$wpdb->posts} WHERE ID IN (${list})" );`
		);
	}
});

/** An attachment of the spec's own, on an F-small file, so editing it touches no shared gallery. */
function ownAttachment(): number {
	const source = five()[0];
	const id = Number(
		wpEval(
			`$id = wp_insert_post( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'post_mime_type' => 'image/jpeg', 'post_title' => 'Cache rules item' ) ); update_post_meta( $id, '_wp_attached_file', get_post_meta( ${source}, '_wp_attached_file', true ) ); update_post_meta( $id, '_wp_attachment_metadata', get_post_meta( ${source}, '_wp_attachment_metadata', true ) ); echo $id;`
		).trim()
	);
	made.push(id);
	return id;
}

type Row = { key: string; cached: string; expires: string };

function rows(galleryId: number): Row[] {
	return JSON.parse(
		wpEval(
			`global $wpdb; echo wp_json_encode( $wpdb->get_results( $wpdb->prepare( "SELECT cache_key AS \`key\`, cached_at AS cached, expires_at AS expires FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d ORDER BY id", ${galleryId} ) ) );`
		)
	) as Row[];
}

async function visit(request: APIRequestContext, url: string): Promise<string> {
	const response = await request.get(url);
	expect(response.status()).toBe(200);
	return response.text();
}

/** Item ids in the order a response renders them. */
function order(markup: string): number[] {
	return [...markup.matchAll(/data-fg-item-id="(\d+)"/g)].map((match) =>
		Number(match[1])
	);
}

test.describe('keys', () => {
	/** With no flush in between, a changed setting, item list or order still renders fresh under a new key. */
	test(
		'CACHE-04: a setting, an added item and a new order each get their own key',
		{ tag: '@cache' },
		async ({ playwright }) => {
			const guest = await apiAnonymous(playwright);
			const items = five();
			const { id, url } = galleryPage(CACHED, items.slice(0, 3));

			const first = await visit(guest, url);

			// Written as the save pipeline writes it, minus the flush.
			wpEval(
				`$d = \\FotoGrids\\Collection_Defaults::resolve_gallery(); $t = \\FotoGrids\\Settings\\Setting_Value_Codec::catalog_field_type( 'caption_alignment' ); \\FotoGrids\\Settings\\Setting_Value_Codec::persist( ${id}, 'fotogrids_caption_alignment', 'right', $d['caption_alignment'], $t );`
			);
			const second = await visit(guest, url);
			expect(second).not.toBe(first);
			expect(rows(id)).toHaveLength(2);

			wpEval(
				`\\FotoGrids\\Galleries\\Gallery_Repository::set_item_ids( ${id}, array( ${items.slice(0, 4).join(',')} ) );`
			);
			expect(order(await visit(guest, url))).toEqual(items.slice(0, 4));
			expect(rows(id)).toHaveLength(3);

			const reversed = items.slice(0, 4).reverse();
			wpEval(
				`\\FotoGrids\\Galleries\\Gallery_Repository::set_item_ids( ${id}, array( ${reversed.join(',')} ) );`
			);
			expect(order(await visit(guest, url))).toEqual(reversed);

			const keys = rows(id).map((row) => row.key);
			expect(new Set(keys).size).toBe(4);

			await guest.dispose();
		}
	);
});

test.describe('invalidation', () => {
	const CASES: Array<[string, (id: number, items: number[]) => string]> = [
		[
			'an item is added',
			(id) =>
				`\\FotoGrids\\Galleries\\Gallery_Items::add( ${id}, ${five()[4]} );`,
		],
		[
			'an item is removed',
			(id, items) =>
				`\\FotoGrids\\Galleries\\Gallery_Items::remove( ${id}, ${items[0]} );`,
		],
		[
			'the items are reordered',
			(id, items) =>
				`\\FotoGrids\\Galleries\\Gallery_Items::reorder( ${id}, array( ${[...items].reverse().join(',')} ) );`,
		],
		[
			"an item's text is edited",
			(id, items) =>
				`\\FotoGrids\\Galleries\\Item_Meta::save( ${items[items.length - 1]}, array( 'caption' => 'Edited ${Date.now()}' ) );`,
		],
		['the gallery is deleted', (id) => `wp_delete_post( ${id}, true );`],
	];

	for (const [what, change] of CASES) {
		/** The change empties the gallery's cache, so the next visitor sees it. */
		test(
			`CACHE-05: the cache is flushed when ${what}`,
			{ tag: '@cache' },
			async ({ playwright }) => {
				const guest = await apiAnonymous(playwright);
				const items = [...five().slice(0, 3), ownAttachment()];
				const { id, url } = galleryPage(CACHED, items);

				await visit(guest, url);
				expect(rows(id)).toHaveLength(1);

				wpEval(change(id, items));
				expect(rows(id)).toEqual([]);

				await guest.dispose();
			}
		);
	}
});

test.describe('expiry', () => {
	/** An entry lives for the gallery's cache_duration, and the purge drops only entries past it. */
	test(
		'CACHE-06: cache_duration sets the expiry and purge_expired removes only stale rows',
		{ tag: '@cache' },
		async ({ playwright }) => {
			const guest = await apiAnonymous(playwright);
			const stale = galleryPage({ ...CACHED, cache_duration: 3 });
			const fresh = galleryPage({ ...CACHED, cache_duration: 3 });
			await visit(guest, stale.url);
			await visit(guest, fresh.url);

			const left = Number(
				wpEval(
					`global $wpdb; echo strtotime( $wpdb->get_var( $wpdb->prepare( "SELECT expires_at FROM {$wpdb->prefix}fotogrids_render_cache WHERE object_type = 'gallery' AND object_id = %d", ${fresh.id} ) ) ) - strtotime( current_time( 'mysql' ) );`
				).trim()
			);
			expect(left).toBeGreaterThan(3 * 3600 - 120);
			expect(left).toBeLessThanOrEqual(3 * 3600);

			wpEval(
				`global $wpdb; $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}fotogrids_render_cache SET expires_at = %s WHERE object_type = 'gallery' AND object_id = %d", gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - 60 ), ${stale.id} ) ); \\FotoGrids\\FotoGrids_Cache::purge_expired();`
			);

			expect(rows(stale.id)).toEqual([]);
			expect(rows(fresh.id)).toHaveLength(1);

			await guest.dispose();
		}
	);

	/** Expiry is written and read on the same clock, so a timezone far from UTC neither expires nor stretches entries. */
	test(
		'CACHE-06: an hour-long entry lasts an hour at UTC+10 and at UTC-10',
		{ tag: '@cache' },
		async () => {
			const { id } = galleryPage(CACHED);

			for (const offset of [10, -10]) {
				const result = JSON.parse(
					wpEval(`
add_filter( 'pre_option_gmt_offset', static fn() => ${offset} );
add_filter( 'pre_option_timezone_string', static fn() => '' );
global $wpdb;
$key = 'cache-rules-${offset < 0 ? 'minus' : 'plus'}-' . ${id};
\\FotoGrids\\FotoGrids_Cache::put( ${id}, $key, '<p>cached</p>', array(), array(), '', '', '', 1, array() );
wp_cache_flush();
$hit = false !== \\FotoGrids\\FotoGrids_Cache::get( ${id}, $key );
$expires = $wpdb->get_var( $wpdb->prepare( "SELECT expires_at FROM {$wpdb->prefix}fotogrids_render_cache WHERE cache_key = %s", $key ) );
\\FotoGrids\\FotoGrids_Cache::purge_expired();
$kept = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_render_cache WHERE cache_key = %s", $key ) );
echo wp_json_encode( array( 'hit' => $hit, 'left' => strtotime( $expires ) - strtotime( current_time( 'mysql' ) ), 'kept' => $kept ) );
`)
				) as { hit: boolean; left: number; kept: number };

				expect(result.hit, `UTC${offset}`).toBe(true);
				expect(result.left, `UTC${offset}`).toBeGreaterThan(3600 - 120);
				expect(result.left, `UTC${offset}`).toBeLessThanOrEqual(3600);
				expect(result.kept, `UTC${offset}`).toBe(1);
			}
		}
	);
});

test.describe('live renders', () => {
	/** Preview, AJAX and REST renders skip the cache, though an ordinary guest render uses it. */
	test(
		'CACHE-07: should_cache is false in a preview, an AJAX request and a REST request',
		{ tag: '@cache' },
		async () => {
			const { id } = galleryPage(CACHED);
			const decide = (setup: string) =>
				wpEval(
					`${setup} echo \\FotoGrids\\FotoGrids_Cache::should_cache( \\FotoGrids\\Galleries\\Gallery_Repository::get_settings( ${id} ), ${id} ) ? 'cache' : 'live';`
				).trim();

			expect(decide('')).toBe('cache');
			expect(decide(`$GLOBALS['wp_query']->is_preview = true;`)).toBe(
				'live'
			);
			expect(
				decide(`add_filter( 'wp_doing_ajax', '__return_true' );`)
			).toBe('live');
			expect(decide(`define( 'REST_REQUEST', true );`)).toBe('live');
		}
	);
});
