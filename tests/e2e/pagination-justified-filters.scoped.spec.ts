import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { galleryPage } from './support/collections';
import { fixture } from './support/fixtures';
import { GalleryRender } from './support/gallery-render';
import { wpEval } from './support/roles';

/**
 * Pagination where the page is not a fixed slice: justified snap pages, and
 * pages of a filtered, shuffled gallery. Also the pagination bar's styling.
 *
 * scoped: each test renders its own gallery.
 */

const sixty = (): number[] => fixture<number[]>('F-large', 'items');

const PER_PAGE = (n: number) => ({ desktop: n, tablet: n, mobile: n });

function itemIds(gallery: GalleryRender): Promise<number[]> {
	return gallery
		.items()
		.locator('[data-fg-item-id]')
		.evaluateAll((nodes) =>
			nodes.map((node) => Number(node.getAttribute('data-fg-item-id')))
		);
}

/** Click Load More until it goes; the item count after each page, in order. */
async function loadAll(gallery: GalleryRender): Promise<number[]> {
	const button = gallery.root.locator('.fg-pagination__load-more');
	const counts = [await gallery.items().count()];

	while (await button.isVisible()) {
		const before = counts[counts.length - 1];
		await button.click();
		await expect
			.poll(() => gallery.items().count())
			.toBeGreaterThan(before);
		counts.push(await gallery.items().count());
	}

	return counts;
}

async function open(page: Page, url: string, id: number) {
	await page.goto(url);
	const gallery = new GalleryRender(page, id);
	await gallery.waitFor();
	return gallery;
}

/**
 * PAG-09. With Fill, a justified page ends on a complete row, so pages hold a
 * few more or fewer items than the page size. With Match, every page holds
 * exactly the page size.
 */
test(
	'PAG-09: justified Fill pages end on whole rows; Match pages hold the page size',
	{ tag: '@layout' },
	async ({ page }) => {
		const sizesFor = async (trailing: 'fill' | 'match') => {
			const { id, url } = galleryPage(
				{
					layout: 'justified',
					layout_justified_page_trailing_row: trailing,
					layout_justified_snap_window: 20,
					pagination_type: 'paginated',
					pagination_method: 'load_more',
					items_per_page: PER_PAGE(12),
				},
				sixty().slice(0, 48)
			);
			const counts = await loadAll(await open(page, url, id));
			return counts.map((count, i) => count - (counts[i - 1] ?? 0));
		};

		const match = await sizesFor('match');
		expect(match).toEqual([12, 12, 12, 12]);

		const fill = await sizesFor('fill');
		// Every page but the last sits inside the 20% window around 12.
		for (const size of fill.slice(0, -1)) {
			expect(size).toBeGreaterThanOrEqual(10);
			expect(size).toBeLessThanOrEqual(14);
		}
		expect(fill, 'Fill paged exactly like Match').not.toEqual(match);
	}
);

/**
 * PAG-10. The snap resolver, called directly over a spread of item counts and
 * aspect ratios: its pages follow on from each other, each starts and ends on
 * a packed row, every page but the last holds at least the window's minimum,
 * and together they cover every item.
 */
test(
	'PAG-10: snap pages are contiguous, row-aligned and inside the window',
	{ tag: '@layout' },
	async () => {
		const report = JSON.parse(
			wpEval(`
				use FotoGrids\\Render\\Layouts\\Justified\\Snap_Resolver;
				use FotoGrids\\Render\\Layouts\\Justified\\Justified_Packer;
				mt_srand( 11 );
				$ratios = array( 0.5, 0.66, 0.75, 1, 1.33, 1.5, 1.78, 2.4 );
				$broken = array();
				$runs   = 0;
				foreach ( array( 8, 12, 24 ) as $target ) {
					foreach ( array( 0, 20, 50 ) as $window ) {
						foreach ( array( 'auto', 'prefer_remove', 'prefer_add' ) as $direction ) {
							for ( $t = 0; $t < 10; $t++ ) {
								$n  = mt_rand( 5, 80 );
								$ar = array();
								for ( $i = 0; $i < $n; $i++ ) {
									$ar[] = $ratios[ mt_rand( 0, 7 ) ];
								}
								$args = array( 'aspect_ratios' => $ar, 'target_page_size' => $target, 'requested_page' => 1, 'container_width' => 1200, 'gap' => 10, 'target_row_height' => 220, 'window_percent' => $window, 'fill_threshold' => 85, 'direction' => $direction );
								$starts = array();
								$at     = 0;
								foreach ( Justified_Packer::pack( $ar, 1200, 10, 220 ) as $row ) {
									$starts[ $at ] = true;
									$at           += count( $row );
								}
								$min   = max( 1, $target - (int) round( $target * $window / 100 ) );
								$pages = Snap_Resolver::resolve( $args )['total_pages'];
								$next  = 0;
								for ( $p = 1; $p <= $pages; $p++ ) {
									$args['requested_page'] = $p;
									$r   = Snap_Resolver::resolve( $args );
									$end = $r['offset'] + $r['page_size'];
									$case = "n=$n target=$target window=$window $direction page $p";
									if ( $r['offset'] !== $next ) { $broken[] = "$case starts at {$r['offset']}, not $next"; }
									if ( ! isset( $starts[ $r['offset'] ] ) ) { $broken[] = "$case starts mid-row"; }
									if ( $p < $pages && ! isset( $starts[ $end ] ) ) { $broken[] = "$case ends mid-row"; }
									if ( $p < $pages && $r['page_size'] < $min ) { $broken[] = "$case holds {$r['page_size']}, under $min"; }
									$next = $end;
								}
								if ( $next !== $n ) { $broken[] = "n=$n target=$target window=$window $direction pages end at $next of $n"; }
								++$runs;
							}
						}
					}
				}
				echo wp_json_encode( array( 'runs' => $runs, 'broken' => array_slice( $broken, 0, 5 ) ) );
			`).trim()
		);

		expect(report.runs).toBe(270);
		expect(report.broken).toEqual([]);
	}
);

/**
 * PAG-15. Fill galleries whose item count is off a page boundary. Thirteen
 * items at twelve a page snap to one page holding all thirteen, so Load More
 * starts hidden; twenty-five page through Load More to the last item.
 */
test(
	'PAG-15: Load More reaches every item of a justified Fill gallery',
	{ tag: '@layout' },
	async ({ page }) => {
		const byId = (a: number, b: number) => a - b;

		for (const count of [13, 25]) {
			const items = sixty().slice(0, count);
			const { id, url } = galleryPage(
				{
					layout: 'justified',
					layout_justified_page_trailing_row: 'fill',
					pagination_type: 'paginated',
					pagination_method: 'load_more',
					items_per_page: PER_PAGE(12),
				},
				items
			);
			const gallery = await open(page, url, id);
			const counts = await loadAll(gallery);

			if (13 === count) {
				expect(counts, '13 items load as one page').toEqual([13]);
			}
			expect((await itemIds(gallery)).sort(byId)).toEqual(
				[...items].sort(byId)
			);
		}
	}
);

/**
 * PAG-13. A tag filter, a random order and pagination in one gallery. Each
 * page request carries the active filter and the shuffle's seed, so paging
 * through the filtered set shows each tagged item once and nothing else.
 */
test.describe('a filtered, shuffled gallery', () => {
	const TAG = `Paged ${Date.now()}-${process.pid}`;
	const tagged = () => sixty().filter((_, i) => i % 3 === 0 && i < 24);

	test.beforeAll(() => {
		for (const id of tagged()) {
			wpEval(
				`FotoGrids\\Metadata_Manager::add_tag_to_item( ${id}, ${JSON.stringify(TAG)} );`
			);
		}
	});

	test.afterAll(() => {
		wpEval(`
			$tag = FotoGrids\\Metadata_Manager::find_metadata( 'tag', ${JSON.stringify(TAG)} );
			if ( $tag ) {
				foreach ( array( ${tagged().join(', ')} ) as $id ) {
					FotoGrids\\Metadata_Manager::remove_metadata_from_item( $id, 'tag', (int) $tag->id );
				}
			}
		`);
	});

	test(
		'PAG-13: paging through a tag filter in random order shows each tagged item once',
		{ tag: '@layout' },
		async ({ page }) => {
			const { id, url } = galleryPage(
				{
					layout: 'grid',
					enable_cache: false,
					filtering_enabled: true,
					filter_display_mode: 'always',
					default_sort_order: 'random',
					random_mode: 'refetch',
					pagination_type: 'paginated',
					pagination_method: 'load_more',
					items_per_page: PER_PAGE(3),
				},
				sixty()
			);
			const gallery = await open(page, url, id);

			const filtered = page.waitForResponse((response) =>
				decodeURIComponent(response.url()).includes(
					'/fotogrids/v1/gallery/render'
				)
			);
			await gallery.root
				.locator('.fg-filter-group button', { hasText: TAG })
				.click();
			await filtered;
			await expect(gallery.items()).toHaveCount(3);

			const counts = await loadAll(gallery);
			expect(counts).toEqual([3, 6, 8]);

			const seen = await itemIds(gallery);
			expect(new Set(seen).size, `repeated: ${seen.join(', ')}`).toBe(8);
			expect([...seen].sort((a, b) => a - b)).toEqual(
				[...tagged()].sort((a, b) => a - b)
			);
		}
	);
});

/**
 * PAG-14. The pagination bar's own settings reach the buttons: colours, border,
 * radius, padding and font size, the active page's colours, and the distance
 * from the items.
 */
test(
	'PAG-14: the button styling settings reach the page buttons',
	{ tag: '@layout' },
	async ({ page }) => {
		const each = <T>(value: T) => ({
			desktop: value,
			tablet: value,
			mobile: value,
		});
		const { id, url } = galleryPage(
			{
				layout: 'grid',
				pagination_type: 'paginated',
				pagination_method: 'pages',
				items_per_page: PER_PAGE(12),
				pagination_button_bg: 'rgba(10, 20, 30, 1)',
				pagination_button_color: 'rgba(200, 210, 220, 1)',
				pagination_button_border_width: 3,
				pagination_button_border_color: 'rgba(1, 2, 3, 1)',
				pagination_button_radius: 9,
				pagination_button_padding: each({
					top: 5,
					right: 11,
					bottom: 6,
					left: 12,
				}),
				pagination_button_font_size: each(17),
				pagination_button_active_bg: 'rgba(40, 50, 60, 1)',
				pagination_button_active_color: 'rgba(250, 240, 230, 1)',
				pagination_distance_from_items: each(23),
			},
			sixty().slice(0, 36)
		);
		const gallery = await open(page, url, id);
		const nav = gallery.root.locator('.fg-pagination--pages');
		const plain = nav.locator('[data-fg-pagination-page="2"]');
		const active = nav.locator('[aria-current="page"]');

		const style = (locator: typeof plain) =>
			locator.evaluate((el) => {
				const s = getComputedStyle(el);
				return {
					bg: s.backgroundColor,
					color: s.color,
					border: `${s.borderTopWidth} ${s.borderTopColor}`,
					radius: s.borderTopLeftRadius,
					padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
					font: s.fontSize,
				};
			});

		expect(await style(plain)).toEqual({
			bg: 'rgb(10, 20, 30)',
			color: 'rgb(200, 210, 220)',
			border: '3px rgb(1, 2, 3)',
			radius: '9px',
			padding: '5px 11px 6px 12px',
			font: '17px',
		});

		const current = await style(active);
		expect({ bg: current.bg, color: current.color }).toEqual({
			bg: 'rgb(40, 50, 60)',
			color: 'rgb(250, 240, 230)',
		});

		expect(await nav.evaluate((el) => getComputedStyle(el).marginTop)).toBe(
			'23px'
		);
	}
);
