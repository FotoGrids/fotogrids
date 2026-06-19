/**
 * Tests for src/assets/admin/src/utils/copy-to-clipboard.js
 */
import {
	copyToClipboard,
	showToast,
	showCopyToast,
	showErrorToast,
	attachCopyButtons,
} from '@/admin/src/utils/copy-to-clipboard';

describe('utils/copy-to-clipboard', () => {
	afterEach(() => {
		delete window.fotogridsToast;
		delete window.fotogridsShortcodeColumn;
		document.body.innerHTML = '';
	});

	describe('copyToClipboard', () => {
		it('uses navigator.clipboard in a secure context', async () => {
			const writeText = jest.fn().mockResolvedValue();
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText },
				configurable: true,
			});
			Object.defineProperty(window, 'isSecureContext', {
				value: true,
				configurable: true,
			});

			await copyToClipboard('hello');
			expect(writeText).toHaveBeenCalledWith('hello');

			delete navigator.clipboard;
		});

		it('falls back to execCommand when clipboard API is unavailable', async () => {
			Object.defineProperty(window, 'isSecureContext', {
				value: false,
				configurable: true,
			});
			delete navigator.clipboard;
			const execCommand = jest.fn().mockReturnValue(true);
			document.execCommand = execCommand;

			await copyToClipboard('fallback');
			expect(execCommand).toHaveBeenCalledWith('copy');
			expect(document.querySelector('textarea')).toBeNull();
		});

		it('rejects and cleans up the textarea when execCommand throws', async () => {
			Object.defineProperty(window, 'isSecureContext', {
				value: false,
				configurable: true,
			});
			delete navigator.clipboard;
			document.execCommand = jest.fn(() => {
				throw new Error('nope');
			});

			await expect(copyToClipboard('x')).rejects.toThrow('nope');
			expect(document.querySelector('textarea')).toBeNull();
		});
	});

	describe('showToast', () => {
		it('no-ops when fotogridsToast is absent', () => {
			expect(() => showToast('success')).not.toThrow();
		});

		it('calls the toast with the built-in default message', () => {
			window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
			showToast('success');
			expect(window.fotogridsToast.success).toHaveBeenCalledWith(
				'Shortcode copied to clipboard',
				1500
			);
		});

		it('prefers an explicit message over the default', () => {
			window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
			showToast('success', 'Custom');
			expect(window.fotogridsToast.success).toHaveBeenCalledWith(
				'Custom',
				1500
			);
		});

		it('falls back to a localized message when available', () => {
			window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
			window.fotogridsShortcodeColumn = {
				copiedMessage: 'Localized copied',
			};
			showToast('success');
			expect(window.fotogridsToast.success).toHaveBeenCalledWith(
				'Localized copied',
				1500
			);
		});

		it('uses the error defaults for the error type', () => {
			window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
			showToast('error');
			expect(window.fotogridsToast.error).toHaveBeenCalledWith(
				'Failed to copy Shortcode',
				3000
			);
		});

		it('falls back to success config (message/duration) for an unknown type', () => {
			// The type itself routes the method call, but TOAST_DEFAULTS falls
			// back to success, so message + duration come from the success config.
			window.fotogridsToast = { weird: jest.fn() };
			showToast('weird');
			expect(window.fotogridsToast.weird).toHaveBeenCalledWith(
				'Shortcode copied to clipboard',
				1500
			);
		});
	});

	describe('showCopyToast / showErrorToast', () => {
		it('delegate to showToast', () => {
			window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
			showCopyToast('A');
			showErrorToast('B');
			expect(window.fotogridsToast.success).toHaveBeenCalledWith('A', 1500);
			expect(window.fotogridsToast.error).toHaveBeenCalledWith('B', 3000);
		});
	});

	describe('attachCopyButtons', () => {
		beforeEach(() => {
			Object.defineProperty(window, 'isSecureContext', {
				value: true,
				configurable: true,
			});
		});

		function makeButton(shortcode) {
			const btn = document.createElement('button');
			btn.className = 'copy-btn';
			if (shortcode !== undefined) {
				btn.dataset.shortcode = shortcode;
			}
			document.body.appendChild(btn);
			return btn;
		}

		it('copies via dataset.shortcode and shows success toast', async () => {
			const writeText = jest.fn().mockResolvedValue();
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText },
				configurable: true,
			});
			window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
			const onSuccess = jest.fn();
			const btn = makeButton('[fotogrids id=1]');

			attachCopyButtons({ selector: '.copy-btn', onSuccess });
			btn.click();
			await Promise.resolve();
			await Promise.resolve();

			expect(writeText).toHaveBeenCalledWith('[fotogrids id=1]');
			expect(window.fotogridsToast.success).toHaveBeenCalled();
			expect(onSuccess).toHaveBeenCalledWith(btn);
			delete navigator.clipboard;
		});

		it('warns and bails when there is no text to copy', async () => {
			const warn = jest
				.spyOn(console, 'warn')
				.mockImplementation(() => {});
			const btn = makeButton(undefined);
			attachCopyButtons({ selector: '.copy-btn' });
			btn.click();
			await Promise.resolve();
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
		});

		it('uses a custom getText resolver', async () => {
			const writeText = jest.fn().mockResolvedValue();
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText },
				configurable: true,
			});
			const btn = makeButton('ignored');
			attachCopyButtons({
				selector: '.copy-btn',
				getText: () => 'custom-text',
			});
			btn.click();
			await Promise.resolve();
			await Promise.resolve();
			expect(writeText).toHaveBeenCalledWith('custom-text');
			delete navigator.clipboard;
		});

		it('shows error toast and calls onError when copy fails', async () => {
			Object.defineProperty(navigator, 'clipboard', {
				value: {
					writeText: jest.fn().mockRejectedValue(new Error('fail')),
				},
				configurable: true,
			});
			window.fotogridsToast = { success: jest.fn(), error: jest.fn() };
			const onError = jest.fn();
			const errSpy = jest
				.spyOn(console, 'error')
				.mockImplementation(() => {});
			const btn = makeButton('[sc]');

			attachCopyButtons({ selector: '.copy-btn', onError });
			btn.click();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			expect(window.fotogridsToast.error).toHaveBeenCalled();
			expect(onError).toHaveBeenCalled();
			errSpy.mockRestore();
			delete navigator.clipboard;
		});
	});
});
