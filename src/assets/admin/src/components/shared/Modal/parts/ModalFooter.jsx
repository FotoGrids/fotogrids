import React from 'react';

const ModalFooter = ({
    align = 'right',
    divider = true,
    compact = false,
    className = '',
    children,
    ...rest
}) => {
    const classes = [
        'fg-modal__footer',
        align === 'left' && 'fg-modal__footer--align-left',
        align === 'between' && 'fg-modal__footer--align-between',
        compact && 'fg-modal__footer--compact',
        !divider && 'fg-modal__footer--no-divider',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={ classes } { ...rest }>
            { children }
        </div>
    );
};

export default ModalFooter;
