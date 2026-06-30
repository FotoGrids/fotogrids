import React from 'react';
import Icon from '../../Icon';
import { useModalContext } from '../hooks/useModalContext';

const ModalHeaderClose = ({
    icon = 'x',
    ariaLabel,
    onClick,
    className = '',
    ...rest
}) => {
    const ctx = useModalContext();
    const handleClick = (event) => {
        if (typeof onClick === 'function') onClick(event);
        if (!event.defaultPrevented) ctx?.requestClose?.('close-button');
    };

    return (
        <button
            type="button"
            className={ `fg-modal__header__close ${ className }`.trim() }
            aria-label={ ariaLabel || (typeof window !== 'undefined' && window.wp?.i18n?.__?.('Close', 'fotogrids')) || 'Close' }
            onClick={ handleClick }
            { ...rest }
        >
            <Icon name={ icon } />
        </button>
    );
};

export default ModalHeaderClose;
