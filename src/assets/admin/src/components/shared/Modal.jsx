import React, { useState } from 'react';
import Icon from './Icon';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'medium', // 'small', 'medium', 'large', 'full'
    className = '',
    closeOnOverlayClick = true,
    showCloseButton = true,
    headerSize = 'default', // 'default', 'small'
    headerButtons = null, // Custom buttons to render in header
    logo = null, // Logo icon/component to display next to title
    sidebar = null, // React node for sidebar content, or null/false for no sidebar
    sidebarCollapsable = false // If true and sidebar is provided, add collapse button
}) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    const renderBody = () => {
        if (sidebar) {
            return (
                <div className={`fotogrids-modal__layout fotogrids-modal__layout-double ${sidebarCollapsed ? 'fotogrids-modal__layout--sidebar-collapsed' : ''}`}>
                    <div className={`fotogrids-modal__body__sidebar ${sidebarCollapsed ? 'fotogrids-modal__body__sidebar--collapsed' : ''}`}>
                        {sidebarCollapsable && (
                            <button
                                type="button"
                                className="fotogrids-modal__sidebar-toggle"
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
                            >
                                <Icon name={sidebarCollapsed ? "chevron_right" : "chevron_left"} />
                            </button>
                        )}
                        {!sidebarCollapsed && (
                            <div className="fotogrids-modal__sidebar-content">
                                {sidebar}
                            </div>
                        )}
                    </div>
                    <div className="fotogrids-modal__body__main">
                        {children}
                    </div>
                </div>
            );
        }

        return children;
    };

    return (
        <div className={`fotogrids-modal fotogrids-modal--size-${size} ${headerSize === 'small' ? 'fotogrids-modal--header-small' : ''} ${isOpen ? 'fotogrids-modal--open' : ''}`} onClick={handleOverlayClick}>
            <div className="fotogrids-modal__overlay" onClick={handleOverlayClick}></div>
            <div
                className={`fotogrids-modal__content ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`fotogrids-modal__header ${headerSize === 'small' ? 'fotogrids-modal__header--small' : ''}`}>
                    <div className="fotogrids-modal__header-left">
                        {title ? (
                            <h3>
                                {logo && <span className="fotogrids-modal__header-logo">{logo}</span>}
                                {title}
                            </h3>
                        ) : <div></div>}
                    </div>
                    <div className="fotogrids-modal__header-right">
                        {headerButtons && (
                            <>
                                <div className="fotogrids-modal__header-buttons">
                                    {headerButtons}
                                </div>
                                <div className="fotogrids-modal__header-divider"></div>
                            </>
                        )}
                        {showCloseButton && (
                            <button
                                type="button"
                                className={`fotogrids-modal__close ${headerSize === 'small' ? 'fotogrids-modal__close--small' : ''}`}
                                onClick={onClose}
                            >
                                <Icon name="x" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="fotogrids-modal__body">
                    {renderBody()}
                </div>
                {footer && (
                    <div className="fotogrids-modal__footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;

