import React from 'react';
import ModalHeaderClose from './ModalHeaderClose';

/**
 * Header layout has three zones — leading (logo + title), trailing actions,
 * and the close button. Consumers nest children directly; this component
 * inspects the children's `__zone` static to route each one to the right
 * slot, falling back to the leading zone for plain elements.
 */
const ModalHeader = ({
    divider = true,
    closeButton = true,
    size = 'md',
    className = '',
    compact = false,
    children,
    ...rest
}) => {
    const leading = [];
    const trailing = [];

    React.Children.forEach(children, (child, index) => {
        if (!child) return;
        const zone = child.type && child.type.__fgModalHeaderZone;
        const target = zone === 'trailing' ? trailing : leading;
        target.push(React.cloneElement(child, { key: child.key ?? index }));
    });

    const classes = [
        'fg-modal__header',
        size === 'sm' && 'fg-modal__header--size-sm',
        !divider && 'fg-modal__header--no-divider',
        closeButton && 'fg-modal__header--has-close-button',
        compact && 'fg-modal__header--compact',
        className,
    ].filter(Boolean).join(' ');

    const hasTrailing = trailing.length > 0;

    return (
        <div className={ classes } { ...rest }>
            <div className="fg-modal__header__leading">{ leading }</div>
            <div className="fg-modal__header__trailing">
                { trailing }
                { hasTrailing && closeButton && (
                    <div className="fg-modal__header__divider" aria-hidden="true" />
                ) }
                { closeButton && <ModalHeaderClose /> }
            </div>
        </div>
    );
};

export default ModalHeader;
