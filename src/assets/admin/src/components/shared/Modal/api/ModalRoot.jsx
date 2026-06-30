import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import Confirm from '../wrappers/Confirm';
import Prompt from '../wrappers/Prompt';
import Alert from '../wrappers/Alert';
import { modalRegistry } from './modalRegistry';

const renderEntry = (entry) => {
    const { id, options } = entry;
    const close = (reason = 'programmatic') => {
        modalRegistry.close(id);
        options.onClose?.(reason);
    };

    switch (options.type) {
        case 'confirm':
            return (
                <Confirm
                    key={ id }
                    isOpen
                    onClose={ close }
                    onConfirm={ options.onConfirm }
                    variant={ options.variant }
                    title={ options.title }
                    message={ options.message }
                    confirmLabel={ options.confirmLabel }
                    cancelLabel={ options.cancelLabel }
                    requireText={ options.requireText }
                    busy={ options.busy }
                />
            );
        case 'prompt':
            return (
                <Prompt
                    key={ id }
                    isOpen
                    onClose={ close }
                    onSubmit={ options.onSubmit }
                    variant={ options.variant }
                    title={ options.title }
                    message={ options.message }
                    inputLabel={ options.inputLabel }
                    inputPlaceholder={ options.inputPlaceholder }
                    initialValue={ options.initialValue }
                    submitLabel={ options.submitLabel }
                    cancelLabel={ options.cancelLabel }
                    required={ options.required }
                    busy={ options.busy }
                />
            );
        case 'alert':
            return (
                <Alert
                    key={ id }
                    isOpen
                    onClose={ close }
                    variant={ options.variant }
                    title={ options.title }
                    message={ options.message }
                    confirmLabel={ options.confirmLabel }
                />
            );
        case 'custom':
        default:
            // For type === 'custom' (or any unknown), options.render is a
            // function (close) => React element, or options.children is a
            // plain element. Either way we mount inside a vanilla Modal so
            // the caller controls the inside but the shell stays consistent.
            return (
                <Modal
                    key={ id }
                    isOpen
                    onClose={ close }
                    size={ options.size || 'md' }
                    hasSidebar={ !!options.hasSidebar }
                    sidebarCollapsible={ !!options.sidebarCollapsible }
                    closeOnOverlay={ options.closeOnOverlay !== false }
                    closeOnEsc={ options.closeOnEsc !== false }
                    preventClose={ !!options.preventClose }
                    className={ options.className || '' }
                    type="custom"
                >
                    { typeof options.render === 'function' ? options.render({ close }) : options.children }
                </Modal>
            );
    }
};

/**
 * Single global host for imperatively-opened modals. Mounted once at body
 * level by the admin's global init script. Subscribes to the modal registry
 * and renders every active entry in order - stacking is handled by Modal's
 * own useModalStack hook.
 */
const ModalRoot = () => {
    const [entries, setEntries] = useState(() => modalRegistry.list());

    useEffect(() => modalRegistry.subscribe(setEntries), []);

    return <>{ entries.map(renderEntry) }</>;
};

export default ModalRoot;
