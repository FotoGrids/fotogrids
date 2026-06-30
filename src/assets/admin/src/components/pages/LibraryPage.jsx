import React, { useState, useEffect, useMemo } from 'react';
import SidebarTabs from '../shared/SidebarTabs/SidebarTabs';
import LibraryTagsTab from '../library/LibraryTagsTab';
import LibraryPeopleTab from '../library/LibraryPeopleTab';
import LibraryLocationsTab from '../library/LibraryLocationsTab';
import LibraryGenericTab from '../library/LibraryGenericTab';

const { __ } = wp.i18n;

/**
 * FotoGrids → Library admin page.
 *
 * Tab list is driven by `window.fotogridsLibrary.entityTypes` (populated from
 * the PHP `fotogrids/library/entity_types` filter), so adding a new entity
 * type does not require touching this component. Default render-mapping for
 * the three built-in types is below; any additional types fall through to
 * LibraryGenericTab which uses the same shared LibraryTabBase under the hood.
 *
 * Uses SidebarTabs for the left-rail layout consistent with Settings and Tools.
 */
const LibraryPage = () => {
    const library = window.fotogridsLibrary || {};
    const entityTypes = useMemo(() => Array.isArray(library.entityTypes) ? library.entityTypes : [], [library]);
    const allowedTabIds = useMemo(() => entityTypes.map((t) => t.slug), [entityTypes]);

    const uiState = window.FotoGridsUiState?.createNamespace({ area: 'library' });
    const fallbackTab = library.initialTab || allowedTabIds[0] || 'tags';

    const [activeTab, setActiveTab] = useState(() => {
        if (!uiState) return fallbackTab;
        return uiState.getValue({ key: 'tab', fallback: fallbackTab, urlParam: 'tab', allowed: allowedTabIds });
    });

    useEffect(() => {
        const handlePopState = () => {
            if (!uiState) return;
            setActiveTab(uiState.getValue({ key: 'tab', fallback: fallbackTab, urlParam: 'tab', allowed: allowedTabIds }));
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [uiState, fallbackTab, allowedTabIds]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        if (uiState) {
            uiState.setValue({ key: 'tab', value: tabId, urlParam: 'tab' });
        }
    };

    const tabs = entityTypes.map((t) => ({
        id: t.slug,
        label: t.label_plural || t.slug,
        icon: t.icon || undefined,
    }));

    const activeType = entityTypes.find((t) => t.slug === activeTab) || entityTypes[0];

    const renderTabContent = () => {
        if (!activeType) {
            return (
                <p className="fotogrids-library-empty-types">
                    {__('No library entity types are registered.', 'fotogrids')}
                </p>
            );
        }

        switch (activeType.slug) {
            case 'tags':
                return <LibraryTagsTab entityType={activeType} />;
            case 'people':
                return <LibraryPeopleTab entityType={activeType} />;
            case 'locations':
                return <LibraryLocationsTab entityType={activeType} />;
            default:
                return <LibraryGenericTab entityType={activeType} />;
        }
    };

    return (
        <SidebarTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            className="fotogrids-sidebar-tabs--bare-content fotogrids-library-sidebar-tabs"
        >
            {renderTabContent()}
        </SidebarTabs>
    );
};

export default LibraryPage;
