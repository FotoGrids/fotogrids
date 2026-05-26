import React from 'react';
import SidebarTabsNav from './SidebarTabsNav';

/**
 * SidebarTabs - a reusable vertical-tabs page shell.
 *
 * A sticky left navigation rail plus a content pane on the right. Used to
 * give Settings, Tools, and Library a consistent layout. The component is
 * deliberately "dumb": it owns no active-tab state and does no data
 * fetching or URL syncing - the parent page keeps that responsibility (e.g.
 * via window.FotoGridsUiState) and passes `activeTab` / `onTabChange` down.
 *
 * Children are rendered as-is inside the content pane, so each page is free
 * to render its own sub-tabs, forms, save bars, etc.
 *
 * @param {Object}   props
 * @param {Array}    props.tabs        Tab descriptors: { id, label, icon?, group? }.
 * @param {Array}    [props.groups]    Group descriptors: { id, label }. Omit for a flat list.
 * @param {string}   props.activeTab   Currently active tab id.
 * @param {Function} props.onTabChange Called with the tab id when a tab is chosen.
 * @param {Function} [props.getTabHref] Optional (id) => href for real-link tabs.
 * @param {string}   [props.ariaLabel] Accessible label for the nav rail.
 * @param {string}   [props.className] Extra class on the root, for per-page tweaks.
 * @param {React.ReactNode} props.children Content for the active tab.
 */
const SidebarTabs = ({
    tabs = [],
    groups,
    activeTab,
    onTabChange,
    getTabHref,
    ariaLabel,
    className = '',
    children,
}) => {
    return (
        <div className={`fotogrids-sidebar-tabs ${className}`.trim()}>
            <aside className="fotogrids-sidebar-tabs__rail">
                <SidebarTabsNav
                    tabs={tabs}
                    groups={groups}
                    activeTab={activeTab}
                    onTabChange={onTabChange}
                    getTabHref={getTabHref}
                    ariaLabel={ariaLabel}
                />
            </aside>

            <div className="fotogrids-sidebar-tabs__content">
                {children}
            </div>
        </div>
    );
};

export default SidebarTabs;
