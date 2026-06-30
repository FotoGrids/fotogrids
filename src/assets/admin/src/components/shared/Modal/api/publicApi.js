import { modalRegistry } from './modalRegistry';
import { emit, on, off } from './events';
import { useModal } from '../hooks/useModal';
import { useModalContext } from '../hooks/useModalContext';

const wrapConfirm =
	(variant) =>
	(opts = {}) =>
		new Promise((resolve) => {
			modalRegistry.open({
				type: 'confirm',
				variant,
				...opts,
				onConfirm: async () => {
					if (typeof opts.onConfirm === 'function') {
						await opts.onConfirm();
					}
					resolve(true);
				},
				onClose: (reason) => {
					opts.onClose?.(reason);
					if (reason !== 'confirm') resolve(false);
				},
			});
		});

const wrapPrompt =
	(variant) =>
	(opts = {}) =>
		new Promise((resolve) => {
			modalRegistry.open({
				type: 'prompt',
				variant,
				...opts,
				onSubmit: async (value) => {
					if (typeof opts.onSubmit === 'function') {
						await opts.onSubmit(value);
					}
					resolve(value);
				},
				onClose: (reason) => {
					opts.onClose?.(reason);
					if (reason !== 'confirm') resolve(null);
				},
			});
		});

const wrapAlert =
	(variant) =>
	(opts = {}) =>
		new Promise((resolve) => {
			modalRegistry.open({
				type: 'alert',
				variant,
				...opts,
				onClose: (reason) => {
					opts.onClose?.(reason);
					resolve();
				},
			});
		});

/**
 * Install the public modal API on window.FotoGridsAdmin.modal. Called once
 * from the global admin init script; idempotent.
 *
 * Public surface (read by Pro and any 3rd-party admin JS):
 *   window.FotoGridsAdmin.modal.open(options) -> { id, close, update }
 *   window.FotoGridsAdmin.modal.close(id?)    -> close top or specific
 *   window.FotoGridsAdmin.modal.closeAll()
 *   window.FotoGridsAdmin.modal.confirm(opts)  -> Promise<boolean>
 *   window.FotoGridsAdmin.modal.prompt(opts)   -> Promise<string|null>
 *   window.FotoGridsAdmin.modal.alert(opts)    -> Promise<void>
 *   window.FotoGridsAdmin.modal.danger/warning/info/success/question shortcuts
 *   window.FotoGridsAdmin.modal.on/off(event, handler)
 *   window.FotoGridsAdmin.modal.hooks.{useModal, useModalContext}
 *
 * Custom DOM events fired on `document` (prefix `fotogrids:admin:modal:`):
 *   opened    detail: { id, type, size }
 *   closed    detail: { id, type, reason }
 *   confirmed detail: { id, type, variant }
 *   tab-changed detail: { modalId, fromTab, toTab }
 */
export const installPublicApi = () => {
	if (typeof window === 'undefined') return;

	window.FotoGridsAdmin = window.FotoGridsAdmin || {};
	if (window.FotoGridsAdmin.modal) return;

	window.FotoGridsAdmin.modal = {
		open: (opts) => modalRegistry.open(opts),
		close: (id) => modalRegistry.close(id),
		closeAll: () => modalRegistry.closeAll(),

		confirm: wrapConfirm('question'),
		prompt: wrapPrompt('question'),
		alert: wrapAlert('info'),

		info: wrapAlert('info'),
		success: wrapAlert('success'),
		warning: wrapConfirm('warning'),
		danger: wrapConfirm('danger'),
		question: wrapConfirm('question'),

		on,
		off,
		emit,

		hooks: {
			useModal,
			useModalContext,
		},
	};
};
