/**
 * FotoGrids Dashboard Widget JavaScript
 */

(function () {
	'use strict';

	const { restUrl, restNonce, pluginUrl } = window.fotogridsDashboard || {};

	if (!restUrl) {
		return;
	}

	if (typeof wp !== 'undefined' && wp.apiFetch) {
		wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(restNonce));
	}

	/**
	 * Loads the news list. Stats and recently-edited are rendered server-side.
	 */
	async function loadNews() {
		const container = document.getElementById('fotogrids-dw-news-list');
		if (!container) {
			return;
		}

		try {
			const response = await wp.apiFetch({
				path: restUrl + 'admin/news',
			});

			let news = response;

			if (!Array.isArray(news)) {
				if (news && typeof news === 'object') {
					if (news.data && Array.isArray(news.data)) {
						news = news.data;
					} else if (Array.isArray(Object.values(news)[0])) {
						news = Object.values(news)[0];
					} else {
						news = [];
					}
				} else {
					news = [];
				}
			}

			if (!Array.isArray(news)) {
				console.error(
					'News is still not an array after processing:',
					news,
				);
				container.innerHTML =
					'<div class="fotogrids-dw-empty">' +
					'Unable to load news and updates.' +
					'</div>';
				return;
			}

			if (news.length === 0) {
				container.innerHTML =
					'<div class="fotogrids-dw-empty">' +
					'No news available at this time.' +
					'</div>';
				return;
			}

			let html = '';
			news.forEach(item => {
				html += `
                    <div class="fotogrids-dw-news-item">
                        <div class="fotogrids-dw-news-item-title">
                            <a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer">
                                ${escapeHtml(item.title || 'Untitled')}
                            </a>
                        </div>
                        <div class="fotogrids-dw-news-item-description">
                            ${escapeHtml(item.description || '')}
                        </div>
                    </div>
                `;
			});

			container.innerHTML = html;
		} catch (error) {
			console.error('Error loading news:', error);
			container.innerHTML =
				'<div class="fotogrids-dw-empty">' +
				'Unable to load news and updates.' +
				'</div>';
		}
	}

	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	function init() {
		if (!document.getElementById('fotogrids-dw-news-list')) {
			return;
		}

		loadNews();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			setTimeout(init, 100);
		});
	} else {
		setTimeout(init, 100);
	}
})();
