import { useMemo } from 'react';
import { modalRegistry } from '../api/modalRegistry';

const buildConfirm = (variant) => (opts = {}) =>
    new Promise((resolve) => {
        const handle = modalRegistry.open({
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
        // eslint-disable-next-line no-param-reassign
        opts.__handle = handle;
    });

const buildPrompt = (variant) => (opts = {}) =>
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

const buildAlert = (variant) => (opts = {}) =>
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
 * Imperative modal API for React consumers. Promise-resolving wrappers around
 * the modal registry; lets you `await modal.danger({...})` and get a boolean
 * answer back. Pro/3rd party React bundles can import this via the public
 * surface exposed on `window.FotoGridsAdmin.modal.hooks.useModal`.
 */
export const useModal = () => useMemo(() => {
    const confirm = buildConfirm('question');
    const prompt  = buildPrompt('question');
    const alert   = buildAlert('info');

    return {
        open:    (opts) => modalRegistry.open(opts),
        close:   (id) => (id ? modalRegistry.close(id) : null),
        closeAll: () => modalRegistry.closeAll(),

        confirm,
        prompt,
        alert,

        info:     buildAlert('info'),
        warning:  buildConfirm('warning'),
        danger:   buildConfirm('danger'),
        success:  buildAlert('success'),
        question: buildConfirm('question'),
    };
}, []);
