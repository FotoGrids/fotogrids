/**
 * Bricks builder canvas: renders FotoGrids elements through the preview route.
 *
 * Bricks calls `window.fotogridsBricksInit( root )` after every element
 * render. The element's PHP prints a placeholder; this script fetches the
 * collection preview and wires its assets and markup into the placeholder.
 */

import { applyPreviewResponse } from '@/admin/src/utils/preview-asset-wiring';

const PREVIEW_SELECTOR = '.fg-pb-bricks-preview[data-fg-bricks-id]';
const FROZEN_CLASS = 'is-fg-pb-pagination-frozen';
const PAGINATION_SELECTOR = '.fg-pagination, .fg-pagination__btn';
const KINDS = ['gallery', 'album'];

const config = window.fotogridsPbBricksCanvas || {};
const labels = config.labels || {};
const requestSeq = new WeakMap();

/**
 * Show a status line inside the preview container.
 *
 * @param {HTMLElement} container Preview container.
 * @param {string}      message   Text to show.
 */
const setStatus = (container, message) => {
	container.textContent = '';
	const status = container.ownerDocument.createElement('div');
	status.className = 'fg-pb-bricks-preview__status';
	status.textContent = message || '';
	container.appendChild(status);
};

/**
 * Stop pagination controls from paginating while the preview is frozen.
 *
 * @param {HTMLElement} container Preview container.
 */
const bindPaginationGuard = (container) => {
	if (container.dataset.fgBricksGuard) {
		return;
	}
	container.dataset.fgBricksGuard = '1';
	container.addEventListener(
		'click',
		(event) => {
			if (!container.classList.contains(FROZEN_CLASS)) {
				return;
			}
			const target = event.target;
			if (
				target &&
				target.closest &&
				target.closest(PAGINATION_SELECTOR)
			) {
				event.stopPropagation();
				event.stopImmediatePropagation();
				event.preventDefault();
			}
		},
		true
	);
};

/**
 * Fetch and apply the preview for one element.
 *
 * @param {HTMLElement} container Preview container.
 * @return {Promise<void>}
 */
const loadPreview = async (container) => {
	const kind = container.dataset.fgBricksKind;
	const id = parseInt(container.dataset.fgBricksId, 10);
	if (!KINDS.includes(kind) || !id || !config.restUrl) {
		return;
	}

	const seq = (requestSeq.get(container) || 0) + 1;
	requestSeq.set(container, seq);

	bindPaginationGuard(container);
	setStatus(container, labels.loading);

	try {
		const response = await fetch(`${config.restUrl}preview/${kind}/${id}`, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': config.restNonce,
			},
			body: JSON.stringify({
				version: 2,
				preview_options: {
					click_behavior: container.dataset.fgBricksClick === '1',
					pagination: container.dataset.fgBricksPagination === '1',
				},
			}),
		});

		if (requestSeq.get(container) !== seq) {
			return;
		}

		if (!response.ok) {
			setStatus(
				container,
				response.status === 401 || response.status === 403
					? labels.noPermission
					: labels.error
			);
			return;
		}

		const data = await response.json();
		if (requestSeq.get(container) !== seq) {
			return;
		}

		await applyPreviewResponse(container, data, {
			ownerWindow: container.ownerDocument.defaultView || window,
		});
	} catch (error) {
		if (requestSeq.get(container) === seq) {
			setStatus(container, labels.error);
		}
	}
};

/**
 * Open an empty-state call to action from the builder window.
 *
 * @param {MouseEvent} event Click in the canvas.
 */
const openEmptyStateUrl = (event) => {
	const button =
		event.target &&
		event.target.closest &&
		event.target.closest('.fg-pb-bricks-preview .fg-pb-empty-state__cta');
	if (!button || !button.dataset.fgEditUrl) {
		return;
	}
	event.preventDefault();
	event.stopPropagation();
	(window.top || window).open(button.dataset.fgEditUrl, '_blank', 'noopener');
};

window.fotogridsBricksInit = (root) => {
	if (!root || !root.querySelector) {
		return;
	}
	const container =
		root.matches && root.matches(PREVIEW_SELECTOR)
			? root
			: root.querySelector(PREVIEW_SELECTOR);
	if (container) {
		loadPreview(container);
	}
};

document.addEventListener('click', openEmptyStateUrl, true);
