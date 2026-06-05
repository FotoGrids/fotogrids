import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../Modal';
import Button from '../../Button/Button';
import Icon from '../../Icon';
import { emit } from '../api/events';

const VARIANT_DEFAULTS = {
    info:     { icon: 'info_circle',      confirmVariant: 'primary', confirmLabel: 'OK' },
    question: { icon: 'help_circle',      confirmVariant: 'primary', confirmLabel: 'Continue' },
    warning:  { icon: 'warning_triangle', confirmVariant: 'warning', confirmLabel: 'Continue' },
    danger:   { icon: 'trash',            confirmVariant: 'danger',  confirmLabel: 'Delete' },
    success:  { icon: 'check_circle',     confirmVariant: 'success', confirmLabel: 'OK' },
};

const t = (s) => (typeof window !== 'undefined' && window.wp?.i18n?.__?.(s, 'fotogrids')) || s;

const Confirm = ({
    isOpen,
    onClose,
    onConfirm,
    variant = 'question',
    headerIcon = true,
    title,
    message,
    confirmLabel,
    cancelLabel,
    requireText = null,
    showCancel = true,
    busy: busyProp = false,
    children,
}) => {
    const defaults = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.question;
    const [confirmText, setConfirmText] = useState('');
    const [internalBusy, setInternalBusy] = useState(false);
    const busy = busyProp || internalBusy;

    useEffect(() => {
        if (!isOpen) setConfirmText('');
    }, [isOpen]);

    const meetsRequireText = !requireText || confirmText === requireText;

    const handleConfirm = useCallback(async () => {
        if (!meetsRequireText || busy) return;
        emit('confirmed', { id: null, type: 'confirm', variant });
        if (typeof onConfirm !== 'function') {
            onClose?.('confirm');
            return;
        }
        try {
            setInternalBusy(true);
            await onConfirm();
            onClose?.('confirm');
        } catch (err) {
            // Leave the modal open; caller is expected to surface the error.
            // eslint-disable-next-line no-console
            console.error('[Confirm] onConfirm rejected:', err);
        } finally {
            setInternalBusy(false);
        }
    }, [meetsRequireText, busy, onConfirm, onClose, variant]);

    const handleCancel = useCallback(() => {
        if (busy) return;
        onClose?.('cancel');
    }, [busy, onClose]);

    return (
        <Modal
            isOpen={ isOpen }
            onClose={ onClose }
            size="sm"
            preventClose={ busy }
            type={ `confirm-${ variant }` }
            className={ `fg-confirm fg-confirm--variant-${ variant }` }
        >
            <Modal.Header divider={ false }>
                { title && (
                    <Modal.HeaderTitle level={ 2 }>
                        { headerIcon && (
                            <span className={ `fg-confirm__icon fg-confirm__icon--variant-${ variant }` } aria-hidden="true">
                                <Icon name={ defaults.icon } />
                            </span>
                        ) }
                        { title }
                    </Modal.HeaderTitle>
                ) }
            </Modal.Header>

            <Modal.Body addGaps>
                { message && <p className="fg-confirm__message">{ message }</p> }
                { children }
                { requireText && (
                    <div className="fg-confirm__require-text">
                        <label htmlFor="fg-confirm-require-input">
                            { t(`Type "${ requireText }" to confirm`) }
                        </label>
                        <input
                            id="fg-confirm-require-input"
                            type="text"
                            value={ confirmText }
                            onChange={ (e) => setConfirmText(e.target.value) }
                            autoComplete="off"
                            disabled={ busy }
                        />
                    </div>
                ) }
            </Modal.Body>

            <Modal.Footer compact>
                { showCancel && (
                    <Button variant="secondary" onClick={ handleCancel } disabled={ busy }>
                        { cancelLabel || t('Cancel') }
                    </Button>
                ) }
                <Button
                    variant={ defaults.confirmVariant }
                    onClick={ handleConfirm }
                    busy={ busy }
                    disabled={ !meetsRequireText }
                >
                    { confirmLabel || t(defaults.confirmLabel) }
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default Confirm;
