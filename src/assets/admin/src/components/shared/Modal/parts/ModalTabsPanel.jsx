import React from 'react';
import { useModalContext } from '../hooks/useModalContext';

const ModalTabsPanel = ({
    id,
    activeId,
    className = '',
    children,
    ...rest
}) => {
    const ctx = useModalContext();
    if (id !== activeId) return null;

    return (
        <div
            className={ `fg-modal__tabs-panel ${ className }`.trim() }
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
