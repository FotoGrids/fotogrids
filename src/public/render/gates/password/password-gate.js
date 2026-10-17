/**
 * Password Gate: submits .fg-lock-form to the unlock REST endpoint and swaps
 * the lock screen for the returned gallery or album HTML.
 */

(function () {
	'use strict';

	/**
	 * Adds a stylesheet <link> for each handle not already in the document.
	 *
	 * @param {Record<string, string>} cssUrls  handle → absolute URL map
	 */
	function injectMissingStyles(cssUrls) {
		if (!cssUrls || typeof cssUrls !== 'object') {
			return;
		}

		Object.keys(cssUrls).forEach(function (handle) {
			const url = cssUrls[handle];
			if (!handle || !url) {
				return;
			}

			const linkId = 'fotogrids-css-' + handle;
			if (document.getElementById(linkId)) {
				return;
			}

			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.id = linkId;
			link.href = url;
			document.head.appendChild(link);
		});
	}

	/**
	 * Adds a <script> for each handle not already in the document.
	 *
	 * @param {Record<string, {src: string, in_footer: boolean}>} jsData
	 * @return {Promise} Settles once every added script has loaded or failed.
	 */
	function injectMissingScripts(jsData) {
		if (!jsData || typeof jsData !== 'object') {
			return Promise.resolve();
		}

		const pending = [];
		Object.keys(jsData).forEach(function (handle) {
			const entry = jsData[handle];
			const url = entry && entry.src ? entry.src : '';
			if (!handle || !url) {
				return;
			}
			const scriptId = 'fotogrids-js-' + handle;
			if (
				document.getElementById(scriptId) ||
				document.getElementById(handle + '-js')
			) {
				return;
			}

			const script = document.createElement('script');
			script.id = scriptId;
			script.src = url;
			script.async = false;
			pending.push(
				new Promise(function (resolve) {
					script.onload = resolve;
					script.onerror = resolve;
				})
			);
			document.head.appendChild(script);
		});

		return Promise.all(pending);
	}

	/**
	 * Adds the combined Google Fonts stylesheet once, keyed by a fixed id.
	 *
	 * @param {string} fontsUrl  Combined Google Fonts stylesheet URL, or ''.
	 */
	function injectFontStylesheet(fontsUrl) {
		if (!fontsUrl || typeof fontsUrl !== 'string') {
			return;
		}

		// Same id as the server-rendered font <link>.
		const linkId = 'fotogrids-google-fonts-css';
		if (document.getElementById(linkId)) {
			return;
		}

		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.id = linkId;
		link.href = fontsUrl;
		document.head.appendChild(link);
	}

	/**
	 * Inject the render's per-render inline CSS.
	 *
	 * @param {string} css  Bare CSS (no <style> tags), or ''.
	 */
	function injectInlineCss(css) {
		if (!css || typeof css !== 'string') {
			return;
		}
		const style = document.createElement('style');
		style.className = 'fotogrids-inline-css';
		style.textContent = css;
		document.head.appendChild(style);
	}

	/**
	 * Adds the render's inline JS.
	 *
	 * @param {string} js  Bare JS (no <script> tags), or ''.
	 */
	function injectInlineJs(js) {
		if (!js || typeof js !== 'string') {
			return;
		}
		const script = document.createElement('script');
		script.textContent = js;
		document.head.appendChild(script);
	}

	/**
	 * Inject the render's JSON-LD structured data, if any.
	 *
	 * @param {string} jsonLd  Bare JSON-LD document, or ''.
	 */
	function injectJsonLd(jsonLd) {
		if (!jsonLd || typeof jsonLd !== 'string') {
			return;
		}
		const script = document.createElement('script');
		script.type = 'application/ld+json';
		script.textContent = jsonLd;
		document.head.appendChild(script);
	}

	/**
	 * Asks the browser to save the password, keyed on the per-collection
	 * .fg-lock-user name. Browsers do not prompt on their own because the form
	 * never navigates. Fails silently where unsupported.
	 *
	 * @param {HTMLFormElement} form
	 */
	function storeCredential(form) {
		try {
			if (!window.PasswordCredential || !navigator.credentials) {
				return;
			}
			const cred = new window.PasswordCredential(form);
			navigator.credentials.store(cred).catch(function () {});
		} catch (_e) {
			// Throws without the expected autocomplete fields or on insecure origins.
		}
	}

	/**
	 * Binds submit on one lock form. Idempotent.
	 *
	 * @param {HTMLFormElement} form
	 */
	function bindLockForm(form) {
		if (!form || form.dataset.fotogridsLockBound === '1') {
			return;
		}
		form.dataset.fotogridsLockBound = '1';

		form.addEventListener('submit', function (event) {
			event.preventDefault();
			unlockGallery(form);
		});
	}

	/**
	 * Builds the unlock request body, including the embed attributes the lock form carries.
	 *
	 * @param {HTMLFormElement} form
	 * @param {string}          password
	 * @param {?HTMLElement}    wrapper
	 * @return {Object} Request body.
	 */
	function unlockBody(form, password, wrapper) {
		const body = {
			password,
			instance_id: wrapper && wrapper.id ? wrapper.id : '',
		};
		const cols = parseInt(form.dataset.fgEmbedCols || '0', 10);
		if (cols > 0) {
			body.cols = cols;
		}
		if (form.dataset.fgEmbedTemplate) {
			body.template = form.dataset.fgEmbedTemplate;
		}
		return body;
	}

	/**
	 * Submits the password; swaps in the rendered HTML or shows the error.
	 *
	 * @param {HTMLFormElement} form
	 */
	function unlockGallery(form) {
		const card = form.closest('.fg-gate-card');
		const errorEl = form.querySelector('.fg-lock-error');
		const submitBtn = form.querySelector('.fg-lock-submit');
		const input = form.querySelector('.fg-lock-input');
		const wrapper = form.closest('.fotogrids-gate');

		const galleryId = parseInt(form.dataset.galleryId || '0', 10);
		const albumId = parseInt(form.dataset.albumId || '0', 10);
		const unlockUrl = form.dataset.unlockUrl || '';
		const nonce = form.dataset.nonce || '';
		const password = input ? input.value : '';

		if ((!galleryId && !albumId) || !unlockUrl) {
			return;
		}

		if (card) {
			card.classList.add('is-loading');
		}
		if (submitBtn) {
			submitBtn.disabled = true;
		}
		if (errorEl) {
			errorEl.classList.remove('is-visible');
		}

		fetch(unlockUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce,
			},
			credentials: 'same-origin',
			body: JSON.stringify(unlockBody(form, password, wrapper)),
		})
			.then(function (response) {
				return response.json().then(function (data) {
					return { ok: response.ok, data };
				});
			})
			.then(function (result) {
				const data = result.data;

				if (!result.ok || !data || !data.success) {
					if (errorEl) {
						errorEl.classList.add('is-visible');
					}
					if (input) {
						input.value = '';
						input.focus();
					}
					return;
				}

				// Must run before the wrapper swap, while the form is in the DOM.
				storeCredential(form);

				injectMissingStyles(data.css || {});
				return injectMissingScripts(data.js || {}).then(function () {
					return data;
				});
			})
			.then(function (data) {
				if (!data) {
					return;
				}

				injectFontStylesheet(data.fonts || '');
				injectInlineCss(data.inlineCss || '');
				injectInlineJs(data.inlineJs || '');
				injectJsonLd(data.jsonLd || '');

				const html = data.html || '';
				if (!html || !wrapper) {
					window.location.reload();
					return;
				}

				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = html;

				// The token authorises this collection's later requests.
				if (data.unlockToken) {
					tempDiv
						.querySelectorAll(
							albumId
								? '[data-fg-album-id="' + albumId + '"]'
								: '[data-fg-gallery-id="' + galleryId + '"]'
						)
						.forEach(function (el) {
							el.dataset.fgUnlockToken = data.unlockToken;
						});
				}

				const newNodes = Array.prototype.slice.call(tempDiv.childNodes);
				if (newNodes.length === 0) {
					window.location.reload();
					return;
				}

				const parent = wrapper.parentNode;
				if (!parent) {
					window.location.reload();
					return;
				}

				newNodes.forEach(function (node) {
					parent.insertBefore(node, wrapper);
				});
				parent.removeChild(wrapper);

				document.dispatchEvent(
					new CustomEvent('fotogrids:gallery_unlocked', {
						bubbles: true,
						detail: { galleryId, albumId },
					})
				);
			})
			.catch(function () {
				if (errorEl) {
					errorEl.classList.add('is-visible');
				}
			})
			.then(function () {
				if (card) {
					card.classList.remove('is-loading');
				}
				if (submitBtn) {
					submitBtn.disabled = false;
				}
			});
	}

	/**
	 * Binds every lock form currently on the page.
	 */
	function bindAll() {
		document
			.querySelectorAll('.fotogrids-gate .fg-lock-form')
			.forEach(bindLockForm);
	}

	function init() {
		bindAll();

		// Catches lock forms inserted later. Skips bound forms to avoid a double unlock.
		document.addEventListener(
			'submit',
			function (e) {
				const form = e.target;
				if (
					!form ||
					!form.classList ||
					!form.classList.contains('fg-lock-form') ||
					form.dataset.fotogridsLockBound === '1'
				) {
					return;
				}
				e.preventDefault();
				unlockGallery(form);
			},
			true
		);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
