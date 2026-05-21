import React from 'react';
import Icon from '../Icon';

/**
 * Left navigation rail for SidebarTabs.
 *
 * Renders tabs either as a flat list or grouped under small uppercase
 * section headers, depending on whether `groups` is provided. Each tab can
 * carry an optional `icon` (a FotoGridsIcons name) rendered via the shared
 * <Icon /> component.
 *
 * This component is intentionally presentational: it owns no state. The
 * parent decides what is active and what happens on change.
 *
 * @param {Object}   props
 * @param {Array}    props.tabs        Tab descriptors: { id, label, icon?, group? }.
 * @param {Array}    [props.groups]    Group descriptors: { id, label }. Omit for a flat list.
 * @param {string}   props.activeTab   Currently active tab id.
 * @param {Function} props.onTabChange Called with the tab id when a tab is chosen.
 * @param {Function} [props.getTabHref] Optional (id) => href, used so tabs are
 *                                       real links (right-click / open-in-new-tab).
 * @param {string}   [props.ariaLabel] Accessible label for the <nav>.
 */
const SidebarTabsNav = ({
    tabs,
    groups,
    activeTab,
    onTabChange,
    getTabHref,
    ariaLabel,
}) => {
    const renderTab = (tab) => {
        const isActive = activeTab === tab.id;
        const href = typeof getTabHref === 'function' ? getTabHref(tab.id) : undefined;

        const handleClick = (e) => {
            // Preserve modifier-click (open in new tab) when an href is present.
            if (href && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) {
                return;
            }
            e.preventDefault();
            onTabChange(tab.id);
        };

        return (
            <a
                key={tab.id}
                href={href || '#'}
                className={`fotogrids-sidebar-tabs__item ${isActive ? 'fg-is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={handleClick}
            >
                {tab.icon && (
                    <Icon name={tab.icon} className="fotogrids-sidebar-tabs__icon" />
                )}
                <span className="fotogrids-sidebar-tabs__label">{tab.label}</span>
            </a>
        );
    };

    // Flat list when no groups are supplied.
    if (!Array.isArray(groups) || groups.length === 0) {
        return (
            <nav className="fotogrids-sidebar-tabs__nav" aria-label={ariaLabel}>
                {tabs.map(renderTab)}
            </nav>
        );
    }

    // Grouped list. Any tab without a matching group falls through to an
    // implicit "ungrouped" bucket rendered first, so nothing silently vanishes.
    const ungrouped = tabs.filter(
        (tab) => !tab.group || !groups.some((g) => g.id === tab.group)
    );

    return (
        <nav className="fotogrids-sidebar-tabs__nav" aria-label={ariaLabel}>
            {ungrouped.length > 0 && (
                <div className="fotogrids-sidebar-tabs__group">
                    {ungrouped.map(renderTab)}
                </div>
            )}
            {groups.map((group) => {
                const groupTabs = tabs.filter((tab) => tab.group === group.id);
                if (groupTabs.length === 0) return null;

                return (
                    <div className="fotogrids-sidebar-tabs__group" key={group.id}>
                        {group.label && (
                            <div className="fotogrids-sidebar-tabs__group-label">
                                {group.label}
                            </div>
                        )}
                        {groupTabs.map(renderTab)}
                    </div>
                );
            })}
        </nav>
    );
};

export default SidebarTabsNav;
