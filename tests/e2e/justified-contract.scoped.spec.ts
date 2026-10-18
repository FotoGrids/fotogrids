import { test, expect } from './support/test';
import type { APIRequestContext } from '@playwright/test';
import { album, passwordGalleryPage } from './support/collections';
import { wpEval } from './support/roles';
import { PER_PAGE, justified, shapes } from './support/justified';

/**
 * The server side of justified pagination: what a server render carries, and
 * the render endpoint's slice contract (offset, length, aspect ratios), with
 * page-number requests kept working for older cached scripts.
 */

const ROUTE = `/?rest_route=${encodeURIComponent('/fotogrids/v1/gallery/render')}`;

async function render(
	request: APIRequestContext,
	body: Record<string, unknown>
): Promise<{ status: number; json: any }> {
	const response = await request.post(ROUTE, {
		data: { partial: 'items_only', ...body },
	});
	let json: any = null;
	try {
		json = await response.json();
	} catch {
		json = null;
	}
	return { status: response.status(), json };
}

function sequenceOf(html: string): number[] {
	return [...html.matchAll(/data-fg-sequence-index="(\d+)"/g)].map((m) =>
		Number(m[1])
	);
}

function idsOf(html: string): number[] {
	return [...html.matchAll(/data-fg-item-id="(\d+)"/g)].map((m) =>
		Number(m[1])
	);
}

test(
	'SRV-01: a server render carries the aspect ratios, overflow past its own cut, and the real page total',
	{ tag: ['@layout', '@critical'] },
	async ({ page }) => {
		const items = shapes(60);
		const { id, url } = justified({ pagination_method: 'pages' }, items);
		await page.goto(url);
		const root = page.locator(`[data-fg-gallery-id="${id}"]`);

		const aspects = ((await root.getAttribute('data-fg-aspects')) ?? '')
			.split(',')
			.filter(Boolean);
		expect(aspects).toHaveLength(items.length);
		expect(await root.getAttribute('data-fg-page-sizes')).toBe('12 12 12');
		expect(await root.getAttribute('data-fg-justified-snap-window')).toBe(
			'20'
		);

		const overflow = await root
			.locator('.fg-item[data-fg-overflow]')
			.count();
		const pageSize = Number(await root.getAttribute('data-fg-page-size'));
		expect(overflow).toBeGreaterThan(0);
		expect(pageSize + overflow).toBeLessThanOrEqual(12 + 3 + 12);

		const chips = await root
			.locator('[data-fg-pagination-trigger="page"]')
			.count();
		expect(chips).toBe(
			Number(await root.getAttribute('data-fg-page-total'))
		);
	}
);

test(
	'SRV-01: a single-page gallery renders its Load More bar exhausted',
	{ tag: '@layout' },
	async ({ page }) => {
		const { id, url } = justified({}, shapes(13));
		await page.goto(url);
		await expect(
			page.locator(
				`[data-fg-gallery-id="${id}"] [data-fg-pagination-role="load-more"]`
			)
		).toHaveClass(/fg-pagination--exhausted/);
	}
);

test(
	'SRV-02: a page-number request without the new params still works',
	{ tag: '@layout' },
	async ({ request }) => {
		const items = shapes(40);
		const { id } = justified({}, items);

		const first = await render(request, { gallery_id: id, page: 1 });
		const second = await render(request, { gallery_id: id, page: 2 });

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		const a = sequenceOf(first.json.html);
		const b = sequenceOf(second.json.html);
		expect(b[0]).toBe(a[a.length - 1] + 1);
		expect(first.json.total_pages).toBeGreaterThan(1);
	}
);

test(
	'SRV-03: an offset + length request returns exactly that slice',
	{ tag: ['@layout', '@critical'] },
	async ({ request }) => {
		const items = shapes(40);
		const { id } = justified({}, items);

		for (const [offset, length] of [
			[0, 5],
			[13, 11],
			[30, 10],
			[35, 20],
		]) {
			const { status, json } = await render(request, {
				gallery_id: id,
				offset,
				length,
			});
			expect(status).toBe(200);
			const expected = items.slice(offset, offset + length);
			expect(idsOf(json.html)).toEqual(expected);
			expect(json.offset).toBe(offset);
			expect(json.total_items).toBe(items.length);
			expect(json.has_more).toBe(offset + length < items.length);
		}
	}
);

test(
	"SRV-03: with_aspects returns the sequence's aspect ratios",
	{ tag: '@layout' },
	async ({ request }) => {
		const items = shapes(40);
		const { id } = justified({}, items);

		const { json } = await render(request, {
			gallery_id: id,
			offset: 0,
			length: 12,
			with_aspects: true,
		});

		expect(json.aspects).toHaveLength(items.length);
		json.aspects.forEach((a: number) => expect(a).toBeGreaterThan(0));
	}
);

test(
	'SRV-04: Match and non-justified galleries still page by number in fixed slices',
	{ tag: '@layout' },
	async ({ request }) => {
		const items = shapes(40);
		for (const settings of [
			{ layout_justified_page_trailing_row: 'match' },
			{ layout: 'grid' },
		]) {
			const { id } = justified(settings, items);
			const { json } = await render(request, { gallery_id: id, page: 2 });
			expect(idsOf(json.html)).toEqual(items.slice(12, 24));
		}
	}
);

test(
	'SRV-05: out-of-range and malformed slice params never fail the request',
	{ tag: '@layout' },
	async ({ request }) => {
		const items = shapes(20);
		const { id } = justified({}, items);

		for (const params of [
			{ offset: -5, length: 10 },
			{ offset: 9999, length: 10 },
			{ offset: 20, length: 10 },
			{ offset: 0, length: 0 },
			{ offset: 'abc', length: 'x' },
			{ offset: 5, length: 99999 },
		]) {
			const { status, json } = await render(request, {
				gallery_id: id,
				...params,
			});
			expect([200, 400], JSON.stringify(params)).toContain(status);
			if (
				200 === status &&
				json &&
				typeof params.offset === 'number' &&
				params.offset >= items.length
			) {
				expect(idsOf(json.html)).toEqual([]);
				expect(json.has_more).toBe(false);
			}
		}
	}
);

test(
	'SRV-06: filters and a random seed shape the slice and the aspect list',
	{ tag: '@layout' },
	async ({ request }) => {
		const items = shapes(120);
		const { id } = justified(
			{
				filtering_enabled: true,
				default_sort_order: 'random',
				random_mode: 'refetch',
				enable_cache: false,
			},
			items
		);
		const quarter = items.filter((_, i) => 0 === i % 4);
		const html = wpEval(
			`echo do_shortcode( '[fotogrids_gallery id="${id}"]' );`
		);
		const value = (html.match(
			/data-fg-filter="([^"]+)"[^>]*>(?:<[^>]+>)*Shape quarter/
		) ?? [])[1];
		expect(value, 'the Shape quarter filter value').toBeTruthy();

		const body = {
			gallery_id: id,
			filters: { tags: [value] },
			random_seed: 4242,
			with_aspects: true,
		};
		const a = await render(request, { ...body, offset: 0, length: 30 });
		const b = await render(request, { ...body, offset: 0, length: 30 });

		expect(a.json.aspects).toHaveLength(quarter.length);
		expect(idsOf(a.json.html)).toEqual(idsOf(b.json.html));
		expect([...idsOf(a.json.html)].sort((x, y) => x - y)).toEqual(
			[...quarter].sort((x, y) => x - y)
		);
	}
);

test(
	'SRV-07: password unlock and album renders carry the same attributes',
	{ tag: '@layout' },
	async ({ page }) => {
		const items = shapes(30);
		const locked = passwordGalleryPage(
			'srv-secret',
			{
				layout: 'justified',
				pagination_type: 'paginated',
				items_per_page: PER_PAGE(12),
				password_remember: false,
			},
			items
		);
		await page.goto(locked.url);
		const form = page.locator(
			`.fg-lock-form[data-gallery-id="${locked.id}"]`
		);
		await form.locator('.fg-lock-input').fill('srv-secret');
		await form.locator('.fg-lock-submit').click();
		const unlocked = page.locator(`[data-fg-gallery-id="${locked.id}"]`);
		await expect(unlocked).toHaveAttribute('data-fg-aspects', /,/, {
			timeout: 15000,
		});

		const child = justified({}, items);
		const made = album([child.id], { use_ajax_from_album: true });
		await page.goto(made.url);
		await page
			.locator(`[data-fg-album-id="${made.id}"] .fg-item`)
			.first()
			.click();
		await expect(
			page.locator(`[data-fg-gallery-id="${child.id}"]`)
		).toHaveAttribute('data-fg-aspects', /,/, { timeout: 15000 });
	}
);

test(
	"SRV-08: the server's fallback gap and row height match the CSS fallbacks",
	{ tag: '@layout' },
	() => {
		const out = wpEval(`
		$m = new ReflectionMethod( \\FotoGrids\\Render\\Internal\\Context_Builder::class, 'resolve_gap_for_breakpoint' );
		$m->setAccessible( true );
		$h = new ReflectionMethod( \\FotoGrids\\Render\\Internal\\Context_Builder::class, 'resolve_row_height_for_breakpoint' );
		$h->setAccessible( true );
		$s = array( 'item_spacing' => array( 'desktop' => 10 ), 'layout_justified_row_height' => array( 'desktop' => 260 ) );
		echo wp_json_encode( array(
			'gap' => array( $m->invoke( null, $s, 'tablet' ), $m->invoke( null, $s, 'mobile' ), $m->invoke( null, array(), 'mobile' ) ),
			'height' => array( $h->invoke( null, $s, 'tablet' ), $h->invoke( null, $s, 'mobile' ) ),
		) );
	`);
		const got = JSON.parse(out.trim().split('\n').pop() as string);
		expect(got.gap).toEqual([8, 5, 5]);
		expect(got.height).toEqual([180, 140]);
	}
);

test(
	'SRV-09: the aspect list costs under 8 bytes an item',
	{ tag: '@layout' },
	async ({ page }) => {
		const items = shapes(120);
		const { id, url } = justified({}, items);
		await page.goto(url);
		const attr =
			(await page
				.locator(`[data-fg-gallery-id="${id}"]`)
				.getAttribute('data-fg-aspects')) ?? '';
		expect(attr.split(',')).toHaveLength(120);
		expect(attr.length / 120).toBeLessThan(8);
	}
);
