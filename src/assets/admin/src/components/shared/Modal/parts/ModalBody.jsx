import React from 'react';

const ModalBody = ({
    padding = true,
    scroll = true,
    addGaps = false,
    className = '',
    children,
    ...rest
}) => {
    const classes = [
        'fg-modal__body',
        !padding && 'fg-modal__body--no-padding',
        !scroll && 'fg-modal__body--no-scroll',
        addGaps && 'fg-modal__body--add-gaps',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={ classes } { ...rest }>
            { children }
        </div>
    );
};

export default ModalBody;
