import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalContext } from './hooks/useModalContext';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useModalStack, getTopModalId } from './hooks/useModalStack';
import { emit } from './api/events';

import ModalHeader from './parts/ModalHeader';
import ModalHeaderTitle from './parts/ModalHeaderTitle';
import ModalHeaderLogo from './parts/ModalHeaderLogo';
import ModalHeaderActions from './parts/ModalHeaderActions';
import ModalHeaderClose from './parts/ModalHeaderClose';
import ModalSubHeader from './parts/ModalSubHeader';
import ModalBody from './parts/ModalBody';
import ModalSidebar from './parts/ModalSidebar';
import ModalMain from './parts/ModalMain';
import ModalTabs from './parts/ModalTabs';
import ModalTabsPanel from './parts/ModalTabsPanel';
import ModalFooter from './parts/ModalFooter';
import ModalNav from './parts/ModalNav';

let nextId = 1;
const makeId = () => `fg-modal-${ nextId++ }`;

const Modal = ({
    isOpen,
    onClose,
    size = 'md',
    hasSidebar = false,
    sidebarCollapsible = false,
    sidebarInitiallyCollapsed = false,
    compact = false,
    closeOnOverlay = true,
    closeOnEsc = true,
    preventClose = false,
    initialFocusRef = null,
    className = '',
    children,
    type,
}) => {
    const [id] = useState(makeId);
    const dialogRef = useRef(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(sidebarInitiallyCollapsed);

    const depth = useModalStack(id, isOpen);
    useBodyScrollLock(isOpen);
    useFocusTrap(dialogRef, isOpen, initialFocusRef);

    const requestClose = useCallback((reason = 'programmatic') => {
        if (preventClose) return;
        if (typeof onClose === 'function') {
            onClose(reason);
            emit('closed', { id, type, reason });
        }
    }, [preventClose, onClose, id, type]);

    useEffect(() => {
        if (!isOpen || !closeOnEsc) return undefined;
        const handler = (event) => {
            if (event.key !== 'Escape') return;
            // Only the top modal in the stack handles Esc.
            if (getTopModalId() !== id) return;
            event.stopPropagation();
            requestClose('esc');
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, closeOnEsc, id, requestClose]);

    useEffect(() => {
        if (isOpen) {
            emit('opened', { id, type, size });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const ctxValue = useMemo(() => ({
        id,
        titleId: `${ id }-title`,
        requestClose,
        sidebarCollapsible,
        sidebarCollapsed,
        toggleSidebar: () => setSidebarCollapsed((c) => !c),
        type,
    }), [id, requestClose, sidebarCollapsible, sidebarCollapsed, type]);

    if (!isOpen) return null;

    const overlayChildren = [];
    const dialogChildren = [];

    React.Children.forEach(children, (child, index) => {
        if (!child) return;
        const isOverlayChild = child.type && child.type.__fgModalOverlayChild;
        const target = isOverlayChild ? overlayChildren : dialogChildren;
        target.push(React.cloneElement(child, { key: child.key ?? index }));
    });

    const baseClass = 'fg-modal';
    const rootClasses = [
        `${baseClass}`,
        `${baseClass}--open`,
        `fg-modal--size-${ size }`,
        hasSidebar && `${baseClass}--has-sidebar`,
        sidebarCollapsed && `${baseClass}--sidebar-collapsed`,
        compact && `${baseClass}--compact`,
        depth > 0 && `${baseClass}--stack-${ Math.min(depth, 5) }`,
        className,
    ].filter(Boolean).join(' ');

    const handleOverlayClick = (event) => {
        if (event.target !== event.currentTarget) return;
        if (!closeOnOverlay) return;
        requestClose('overlay');
    };

    const modal = (
        <ModalContext.Provider value={ ctxValue }>
            <div className={ rootClasses } role="presentation">
                <div
                    className={`${baseClass}__overlay`}
                    onClick={ handleOverlayClick }
                    aria-hidden="true"
                />
                <div
                    ref={ dialogRef }
                    className={`${baseClass}__dialog`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={ `${ id }-title` }
                    tabIndex={ -1 }
                >
                    { dialogChildren }
                </div>
                { overlayChildren }
            </div>
        </ModalContext.Provider>
    );

    return createPortal(modal, document.body);
};

Modal.Header = ModalHeader;
Modal.HeaderTitle = ModalHeaderTitle;
Modal.HeaderLogo = ModalHeaderLogo;
Modal.HeaderActions = ModalHeaderActions;
Modal.HeaderClose = ModalHeaderClose;
Modal.SubHeader = ModalSubHeader;
Modal.Body = ModalBody;
Modal.Sidebar = ModalSidebar;
Modal.Main = ModalMain;
Modal.Tabs = ModalTabs;
Modal.TabsPanel = ModalTabsPanel;
Modal.Footer = ModalFooter;
Modal.Nav = ModalNav;

export default Modal;
