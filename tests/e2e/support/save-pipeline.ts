import type { Page, Request, Response } from '@playwright/test';
import { wpEval } from './roles';

/** The collection editor's save requests, its toasts and the meta they write. */

/** Whether a request is the editor's AJAX save. */
export function isAjaxSave(request: Request): boolean {
	return (
		'POST' === request.method() &&
		request.url().includes('admin-ajax.php') &&
		(request.postData() ?? '').includes('fotogrids_save_collection')
	);
}

/** The next AJAX save response. */
export function nextAjaxSave(page: Page, timeout = 30000): Promise<Response> {
	return page.waitForResponse((response) => isAjaxSave(response.request()), {
		timeout,
	});
}

/** Every AJAX save and every native post.php submit the page sends from now on. */
export function recordSaves(page: Page): {
	ajax: Request[];
	native: Request[];
} {
	const seen = { ajax: [] as Request[], native: [] as Request[] };

	page.on('request', (request) => {
		if (isAjaxSave(request)) {
			seen.ajax.push(request);
		} else if (
			'POST' === request.method() &&
			request.url().includes('/wp-admin/post.php')
		) {
			seen.native.push(request);
		}
	});

	return seen;
}

/** Start collecting toasts as `type: message`; read them with `toasts()`. */
export async function recordToasts(page: Page): Promise<void> {
	await page.waitForFunction(
		() => !!(window as unknown as ToastWindow).fotogridsToast?.subscribe
	);
	await page.evaluate(() => {
		const seen = new Set<string>();
		window.__fgSaveToasts = [];
		(window as unknown as ToastWindow).fotogridsToast.subscribe((list) => {
			list.forEach((toast) => {
				if (!seen.has(toast.id)) {
					seen.add(toast.id);
					window.__fgSaveToasts.push(
						`${toast.type}: ${toast.message}`
					);
				}
			});
		});
	});
}

export function toasts(page: Page): Promise<string[]> {
	return page.evaluate(() => window.__fgSaveToasts ?? []);
}

/** One post meta value, JSON-encoded so an absent key reads as `""`. */
export function storedMeta(id: number, key: string): string {
	return wpEval(
		`echo wp_json_encode( get_post_meta( ${id}, ${JSON.stringify(key)}, true ) );`
	).trim();
}

/** A collection setting as stored, by catalog key. */
export function storedSetting(id: number, key: string): string {
	return storedMeta(id, `fotogrids_${key}`);
}

/**
 * Watch the unsaved-changes badge, recording whether it was ever shown.
 * Read the answer with `badgeWasShown()`.
 */
export async function watchBadge(page: Page): Promise<void> {
	await page.evaluate(() => {
		const badge = document.getElementById('fotogrids-unsaved-changes');
		window.__fgSaveBadgeShown = false;
		if (!badge) {
			return;
		}
		new MutationObserver(() => {
			if ('none' !== badge.style.display) {
				window.__fgSaveBadgeShown = true;
			}
		}).observe(badge, { attributes: true, attributeFilter: ['style'] });
	});
}

export function badgeWasShown(page: Page): Promise<boolean> {
	return page.evaluate(() => window.__fgSaveBadgeShown);
}

type ToastWindow = {
	fotogridsToast: {
		subscribe: (
			callback: (
				list: { id: string; type: string; message: string }[]
			) => void
		) => () => void;
	};
};

declare global {
	interface Window {
		__fgSaveToasts: string[];
		__fgSaveBadgeShown: boolean;
	}
}
