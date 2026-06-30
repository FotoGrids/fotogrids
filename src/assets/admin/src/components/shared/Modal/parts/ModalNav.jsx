import React from 'react';
import Icon from '../../Icon';

const ModalNav = ({
    direction = 'next',
    onClick,
    disabled = false,
    ariaLabel,
    className = '',
    ...rest
}) => {
    const isPrev = direction === 'prev';
    const classes = [
        'fg-modal__nav',
        isPrev ? 'fg-modal__nav--prev' : 'fg-modal__nav--next',
        className,
    ].filter(Boolean).join(' ');

    const label = ariaLabel
        || (isPrev
            ? (typeof window !== 'undefined' && window.wp?.i18n?.__?.('Previous', 'fotogrids')) || 'Previous'
            : (typeof window !== 'undefined' && window.wp?.i18n?.__?.('Next', 'fotogrids')) || 'Next');

    return (
        <button
            type="button"
            className={ classes }
            onClick={ onClick }
            disabled={ disabled }
            aria-label={ label }
            { ...rest }
        >
            <Icon name={ isPrev ? 'chevron_left' : 'chevron_right' } />
        </button>
    );
};

ModalNav.__fgModalOverlayChild = true;

export default ModalNav;
