/**
 * Shared copy-to-clipboard logic for shortcode copy buttons (list table and metabox).
 */

/**
 * Copy text to the clipboard.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyToClipboard(text) {
	if (navigator.clipboard && window.isSecureContext) {
		return navigator.clipboard.writeText(text);
	}
	return new Promise((resolve, reject) => {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.opacity = '0';
		document.body.appendChild(textArea);
		textArea.select();
		try {
			document.execCommand('copy');
			document.body.removeChild(textArea);
			resolve();
		} catch (err) {
			document.body.removeChild(textArea);
			reject(err);
		}
	});
}

const TOAST_DEFAULTS = {
	success: {
		key: 'copiedMessage',
		message: 'Shortcode copied to clipboard',
		duration: 1500,
	},
	error: {
		key: 'copyErrorMessage',
		message: 'Failed to copy Shortcode',
		duration: 3000,
	},
};

/**
 * Show a toast if fotogridsToast is available.
 *
 * @param {'success'|'error'} type
 * @param {string} [message] Optional message (default: from fotogridsShortcodeColumn or built-in).
 */
export function showToast(type, message) {
	if (typeof window.fotogridsToast === 'undefined') {
		return;
	}
	const def = TOAST_DEFAULTS[type] || TOAST_DEFAULTS.success;
	const localized =
		window.fotogridsShortcodeColumn &&
		window.fotogridsShortcodeColumn[def.key];
	const msg = message || localized || def.message;
	window.fotogridsToast[type](msg, def.duration);
}

export function showCopyToast(message) {
	showToast('success', message);
}

export function showErrorToast(message) {
	showToast('error', message);
}

/**
 * Attach click handlers to copy buttons. Shows success/error toasts by default.
 *
 * @param {Object} options
 * @param {string} options.selector CSS selector for copy buttons
 * @param {(el: HTMLElement) => string} [options.getText] Function to get text to copy from each button (default: el.dataset.shortcode)
 * @param {(el: HTMLElement) => void} [options.onSuccess] Called after successful copy (toast is shown automatically)
 * @param {(el: HTMLElement, Error) => void} [options.onError] Called on copy failure (error toast is shown automatically)
 */
export function attachCopyButtons({ selector, getText, onSuccess, onError }) {
	const buttons = document.querySelectorAll(selector);
	const getCopyText = getText || (el => el.dataset.shortcode || '');

	buttons.forEach(button => {
		button.addEventListener('click', async e => {
			e.preventDefault();
			const text = getCopyText(button);
			if (!text) {
				if (typeof console !== 'undefined' && console.warn) {
					console.warn(
						'FotoGrids: No shortcode found on copy button',
					);
				}
				return;
			}
			try {
				await copyToClipboard(text);
				showCopyToast();
				if (onSuccess) {
					onSuccess(button);
				}
			} catch (err) {
				if (typeof console !== 'undefined' && console.error) {
					console.error('FotoGrids: Failed to copy shortcode', err);
				}
				showErrorToast();
				if (onError) {
					onError(button, err);
				}
			}
		});
	});
}
