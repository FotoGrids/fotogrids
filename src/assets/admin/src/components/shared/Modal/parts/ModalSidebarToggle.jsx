import React from 'react';
import Icon from '../../Icon';
import { useModalContext } from '../hooks/useModalContext';

const ModalSidebarToggle = ({ className = '', ariaLabel, ...rest }) => {
    const ctx = useModalContext();
    const collapsed = !!ctx?.sidebarCollapsed;
    const label = ariaLabel
        || (collapsed
            ? (typeof window !== 'undefined' && window.wp?.i18n?.__?.('Show sidebar', 'fotogrids')) || 'Show sidebar'
            : (typeof window !== 'undefined' && window.wp?.i18n?.__?.('Hide sidebar', 'fotogrids')) || 'Hide sidebar');

    return (
        <button
            type="button"
            className={ `fg-modal__sidebar__toggle ${ className }`.trim() }
            onClick={ () => ctx?.toggleSidebar?.() }
            aria-label={ label }
            aria-pressed={ collapsed }
            { ...rest }
        >
            <Icon name={ collapsed ? 'chevron_right' : 'chevron_left' } />
        </button>
    );
};

export default ModalSidebarToggle;
