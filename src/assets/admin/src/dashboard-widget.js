/**
 * FotoGrids Dashboard Widget JavaScript
 *
 * Fills the News & Updates list from /fotogrids/v1/admin/news and drives the
 * Create New menu. Stats and the recently-edited list are rendered
 * server-side.
 */

(function () {
	'use strict';

	const { restUrl, restNonce, i18n } = window.fotogridsDashboard || {};

	const strings = Object.assign(
		{
			error: 'Unable to load news and updates.',
			empty: 'No news available at this time.',
			newTag: 'New',
		},
		i18n || {}
	);

	if (restUrl && typeof wp !== 'undefined' && wp.apiFetch && restNonce) {
		wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(restNonce));
	}

	const WIDGET_ITEM_COUNT = 4;

	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text == null ? '' : String(text);
		return div.innerHTML;
	}

	function renderMessage(container, message) {
		container.innerHTML =
			'<div class="fotogrids-dw-empty">' + escapeHtml(message) + '</div>';
	}

	function renderItems(container, items) {
		container.innerHTML = items
			.slice(0, WIDGET_ITEM_COUNT)
			.map(function (item) {
				const meta = item.date_label
					? '<div class="fotogrids-dw-news-item-date">' +
						escapeHtml(item.date_label) +
						'</div>'
					: '';

				const summary = item.summary
					? '<div class="fotogrids-dw-news-item-description">' +
						escapeHtml(item.summary) +
						'</div>'
					: '';

				const tag =
					'<span class="fotogrids-dw-news-tag">' +
					escapeHtml(strings.newTag) +
					'</span>';

				const title = item.url
					? '<a href="' +
						escapeHtml(item.url) +
						'" target="_blank" rel="noopener noreferrer">' +
						tag +
						escapeHtml(item.title) +
						'</a>'
					: escapeHtml(item.title);

				return (
					'<div class="fotogrids-dw-news-item">' +
					'<div class="fotogrids-dw-news-item-title">' +
					title +
					'</div>' +
					summary +
					meta +
					'</div>'
				);
			})
			.join('');
	}

	async function loadNews() {
		const container = document.getElementById('fotogrids-dw-news-list');
		if (!container) {
			return;
		}

		let response;

		try {
			response = await wp.apiFetch({ path: restUrl + 'admin/news' });
		} catch (error) {
			renderMessage(container, strings.error);
			return;
		}

		if (response && response.enabled === false) {
			const section = container.closest('.fotogrids-dw-news');
			if (section) {
				section.hidden = true;
			}
			return;
		}

		const items =
			response && Array.isArray(response.items) ? response.items : [];

		if (!items.length) {
			renderMessage(container, strings.empty);
			return;
		}

		renderItems(container, items);
	}

	function initCreateMenu() {
		const toggle = document.querySelector('.fotogrids-dw-create-toggle');
		const menu = document.getElementById('fotogrids-dw-create-menu');

		if (!toggle || !menu) {
			return;
		}

		const setOpen = (open) => {
			menu.hidden = !open;
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		};

		toggle.addEventListener('click', (event) => {
			event.preventDefault();
			const willOpen = menu.hidden;
			setOpen(willOpen);
			if (willOpen) {
				const first = menu.querySelector('a');
				if (first) {
					first.focus();
				}
			}
		});

		document.addEventListener('click', (event) => {
			if (menu.hidden) {
				return;
			}
			if (
				!menu.contains(event.target) &&
				!toggle.contains(event.target)
			) {
				setOpen(false);
			}
		});

		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || menu.hidden) {
				return;
			}
			setOpen(false);
			toggle.focus();
		});
	}

	function init() {
		initCreateMenu();

		if (!restUrl || typeof wp === 'undefined' || !wp.apiFetch) {
			return;
		}

		loadNews();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
