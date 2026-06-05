import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../Modal';
import Button from '../../Button/Button';
import FormField from '../../FormField/FormField';
import Icon from '../../Icon';

const VARIANT_ICONS = {
    info: 'info_circle',
    question: 'help_circle',
    warning: 'warning_triangle',
    danger: 'trash',
    success: 'check_circle',
};

const t = (s) => (typeof window !== 'undefined' && window.wp?.i18n?.__?.(s, 'fotogrids')) || s;

const Prompt = ({
    isOpen,
    onClose,
    onSubmit,
    variant = 'question',
    title,
    message,
    inputLabel,
    inputPlaceholder = '',
    initialValue = '',
    submitLabel,
    cancelLabel,
    required = true,
    busy: busyProp = false,
}) => {
    const [value, setValue] = useState(initialValue);
    const [internalBusy, setInternalBusy] = useState(false);
    const busy = busyProp || internalBusy;

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    const isValid = !required || value.trim().length > 0;

    const handleSubmit = useCallback(async () => {
        if (!isValid || busy) return;
        if (typeof onSubmit !== 'function') {
            onClose?.('confirm');
            return;
        }
        try {
            setInternalBusy(true);
            await onSubmit(value);
            onClose?.('confirm');
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[Prompt] onSubmit rejected:', err);
        } finally {
            setInternalBusy(false);
        }
    }, [isValid, busy, onSubmit, onClose, value]);

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
            type={ `prompt-${ variant }` }
            className={ `fg-prompt fg-prompt--variant-${ variant }` }
        >
            <Modal.Header divider={ false }>
                { title && (
                    <Modal.HeaderTitle level={ 2 }>
                        <span className={ `fg-prompt__icon fg-prompt__icon--variant-${ variant }` } aria-hidden="true">
                            <Icon name={ VARIANT_ICONS[variant] || VARIANT_ICONS.question } />
                        </span>
                        { title }
                    </Modal.HeaderTitle>
                ) }
            </Modal.Header>

            <Modal.Body>
                { message && <p className="fg-prompt__message">{ message }</p> }
                <FormField label={ inputLabel } htmlFor="fg-prompt-input" required={ required } layout="column">
                    <input
                        id="fg-prompt-input"
                        type="text"
                        value={ value }
                        onChange={ (e) => setValue(e.target.value) }
                        placeholder={ inputPlaceholder }
                        disabled={ busy }
                        onKeyDown={ (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSubmit();
                            }
                        } }
                        autoFocus
                    />
                </FormField>
            </Modal.Body>

            <Modal.Footer>
                <Button variant="secondary" onClick={ handleCancel } disabled={ busy }>
                    { cancelLabel || t('Cancel') }
                </Button>
                <Button
                    variant="primary"
                    onClick={ handleSubmit }
                    busy={ busy }
                    disabled={ !isValid }
                >
                    { submitLabel || t('OK') }
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default Prompt;
