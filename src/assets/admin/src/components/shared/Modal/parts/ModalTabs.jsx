import React from 'react';
import { useModalContext } from '../hooks/useModalContext';
import { emit } from '../api/events';

const ModalTabs = ({
    tabs = [],
    activeId,
    onChange,
    disabled = false,
    emitEvents = false,
    className = '',
    ...rest
}) => {
    const ctx = useModalContext();

    const handleClick = (tab) => {
        if (tab.disabled || disabled) return;
        if (activeId === tab.id) return;
        onChange?.(tab.id);
        if (emitEvents) {
            emit('tab-changed', { modalId: ctx?.id, fromTab: activeId, toTab: tab.id });
        }
    };

    const classes = [
        'fg-modal__tabs',
        disabled && 'fg-modal__tabs--disabled',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={ classes } role="tablist" { ...rest }>
            { tabs.map((tab) => {
                const isActive = tab.id === activeId;
                const buttonClasses = [
                    'fg-modal__tabs__button',
                    isActive && 'fg-modal__tabs__button--active',
                    tab.disabled && 'fg-modal__tabs__button--disabled',
                ].filter(Boolean).join(' ');

                return (
                    <button
                        key={ tab.id }
                        type="button"
                        role="tab"
                        aria-selected={ isActive }
                        aria-controls={ `${ ctx?.id || 'fg-modal' }-panel-${ tab.id }` }
                        id={ `${ ctx?.id || 'fg-modal' }-tab-${ tab.id }` }
                        className={ buttonClasses }
                        onClick={ () => handleClick(tab) }
                        disabled={ tab.disabled || disabled }
                    >
                        { tab.label }
                        { tab.badge && <span className="fg-modal__tabs__badge">{ tab.badge }</span> }
                    </button>
                );
            }) }
        </div>
    );
};

export default ModalTabs;
