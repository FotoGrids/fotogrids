import React from 'react';
import { useModalContext } from '../hooks/useModalContext';

const ModalTabsPanel = ({
    id,
    activeId,
    padding = true,
    className = '',
    children,
    ...rest
}) => {
    const ctx = useModalContext();
    if (id !== activeId) return null;

    const classes = [
        'fg-modal__tabs-panel',
        !padding && 'fg-modal__tabs-panel--no-padding',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div
            className={ classes }
            role="tabpanel"
            id={ `${ ctx?.id || 'fg-modal' }-panel-${ id }` }
            aria-labelledby={ `${ ctx?.id || 'fg-modal' }-tab-${ id }` }
            { ...rest }
        >
            { children }
        </div>
    );
};

export default ModalTabsPanel;
