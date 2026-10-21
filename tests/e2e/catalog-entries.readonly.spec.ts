import { test, expect } from './support/test';
import type { APIRequestContext } from '@playwright/test';
import { apiAs } from './support/roles';

/**
 * The assembled settings catalog the collection editor is built from.
 *
 * Readonly: only GET requests.
 */

type Node = Record<string, unknown>;
type Catalog = { groups: Record<string, Node>; warnings: unknown[] };

function route(postType: string): string {
	const params = new URLSearchParams({
		rest_route: '/fotogrids/v1/admin/catalog/entries',
		post_type: postType,
	});
	return `/?${params.toString()}`;
}

/** Every object in the tree, with a readable path to it. */
function walk(
	node: unknown,
	path: string,
	visit: (n: Node, p: string) => void
): void {
	if (Array.isArray(node)) {
		node.forEach((child, i) => walk(child, `${path}[${i}]`, visit));
		return;
	}
	if (node && 'object' === typeof node) {
		visit(node as Node, path);
		for (const [key, child] of Object.entries(node as Node)) {
			walk(child, `${path}.${key}`, visit);
		}
	}
}

/** Problems with tab, subtab and field shape, as readable lines. */
function shapeProblems(groups: Record<string, Node>): string[] {
	const problems: string[] = [];

	for (const [id, tab] of Object.entries(groups)) {
		if (tab.id !== id) {
			problems.push(`tab ${id} carries id ${String(tab.id)}`);
		}
		if ('string' !== typeof tab.label || '' === tab.label) {
			problems.push(`tab ${id} has no label`);
		}
	}

	walk(groups, 'groups', (node, path) => {
		const subTabs = node.subTabs as Record<string, Node> | undefined;
		for (const [id, sub] of Object.entries(subTabs ?? {})) {
			if ('string' !== typeof sub.label || '' === sub.label) {
				problems.push(`${path}.subTabs.${id} has no label`);
			}
		}

		// A typed node with a default is a stored field.
		if ('default' in node && 'string' === typeof node.type) {
			if ('string' !== typeof node.key || '' === node.key) {
				problems.push(`${path} stores a value but has no key`);
			}
			if ('string' !== typeof node.label) {
				problems.push(`${path} (${String(node.key)}) has no label`);
			}
		}
	});

	return problems;
}

/** Conditions naming a key the same tree does not define. */
function orphanConditions(groups: Record<string, Node>): string[] {
	const keys = new Set<string>();
	walk(groups, 'groups', (node) => {
		if ('string' === typeof node.key && 'string' === typeof node.type) {
			keys.add(node.key);
		}
	});

	const orphans: string[] = [];
	const check = (condition: unknown, path: string) =>
		walk(condition, path, (node, at) => {
			const on = node.dependsOn;
			for (const key of (Array.isArray(on) ? on : [on]).filter(Boolean)) {
				if (!keys.has(String(key))) {
					orphans.push(`${at} depends on unknown key ${String(key)}`);
				}
			}
		});

	// condition_global reads plugin settings, not this tree, so it is left out.
	walk(groups, 'groups', (node, path) => {
		if (node.condition) {
			check(node.condition, `${path}.condition`);
		}
	});

	return orphans;
}

test.describe('GET /admin/catalog/entries', () => {
	let api: APIRequestContext;
	let nonce: string;

	test.beforeAll(async ({ playwright }) => {
		({ context: api, nonce } = await apiAs(playwright, 'administrator'));
	});

	test.afterAll(async () => {
		await api.dispose();
	});

	async function catalog(postType: string): Promise<Catalog> {
		const response = await api.get(route(postType), {
			headers: { 'X-WP-Nonce': nonce },
		});
		expect(response.status()).toBe(200);
		return (await response.json()) as Catalog;
	}

	/** Every tab, subtab and stored field is named, and conditions point inside the tree. */
	test(
		'SET-01: the gallery tree is well formed',
		{ tag: ['@api', '@settings'] },
		async () => {
			const { groups, warnings } = await catalog('gallery');

			expect(warnings).toEqual([]);
			expect(Object.keys(groups)).toEqual(
				expect.arrayContaining([
					'layout',
					'interactions',
					'lightbox',
					'captions',
					'media',
				])
			);
			expect(shapeProblems(groups)).toEqual([]);
			expect(orphanConditions(groups)).toEqual([]);
		}
	);

	/** An album gets Navigation and none of the item-level gallery tabs. */
	test(
		'SET-02: the album tree swaps item tabs for Navigation',
		{ tag: ['@api', '@settings'] },
		async () => {
			const { groups, warnings } = await catalog('album');
			const tabs = Object.keys(groups);

			expect(warnings).toEqual([]);
			expect(tabs).toContain('navigation');
			for (const galleryOnly of [
				'interactions',
				'lightbox',
				'lightbox-mini',
				'lightbox-grid',
				'layout-navigation',
				'media',
				'video',
				'exif',
			]) {
				expect(tabs, `album tree carries ${galleryOnly}`).not.toContain(
					galleryOnly
				);
			}
			expect(shapeProblems(groups)).toEqual([]);
		}
	);

	/** The gallery tree has no Navigation tab, which is album-only. */
	test(
		'SET-02: the gallery tree has no album Navigation tab',
		{ tag: ['@api', '@settings'] },
		async () => {
			const { groups } = await catalog('gallery');

			expect(Object.keys(groups)).not.toContain('navigation');
		}
	);
});
