import React from 'react';
import { useModalContext } from '../hooks/useModalContext';
import ModalSidebarToggle from './ModalSidebarToggle';

const ModalSidebar = ({
    className = '',
    children,
    ...rest
}) => {
    const ctx = useModalContext();
    const collapsed = !!ctx?.sidebarCollapsed;

    const classes = [
        'fg-modal__sidebar',
        collapsed && 'fg-modal__sidebar--collapsed',
        className,
    ].filter(Boolean).join(' ');

    return (
        <aside className={ classes } { ...rest }>
            { ctx?.sidebarCollapsible && <ModalSidebarToggle /> }
            { !collapsed && (
                <div className="fg-modal__sidebar__content">
                    { children }
                </div>
            ) }
        </aside>
    );
};

export default ModalSidebar;
