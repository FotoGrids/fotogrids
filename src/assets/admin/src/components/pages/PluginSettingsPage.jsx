import React, { useState, useEffect } from 'react';
import SidebarTabs from '../shared/SidebarTabs/SidebarTabs';
import Panel from '../shared/SidebarTabs/elements/Panel';
import ResponsivenessTab from '../plugin-settings/tabs/ResponsivenessTab';
import DefaultsTab from '../plugin-settings/tabs/DefaultsTab';
import AdvancedTab from '../plugin-settings/tabs/AdvancedTab';
import MaintenanceTab from '../plugin-settings/tabs/MaintenanceTab';
import PermissionsManagerTab from '../plugin-settings/tabs/PermissionsManagerTab';
import MediaTab from '../plugin-settings/tabs/MediaTab';
import SharingTab from '../plugin-settings/tabs/SharingTab';
import ViewPagesTab from '../plugin-settings/tabs/ViewPagesTab';
import TabBar from '../shared/TabBar.jsx';

const { __ } = wp.i18n;

const TAB_IDS = ['media', 'responsiveness', 'defaults', 'view_pages', 'sharing', 'permissions_manager', 'advanced', 'maintenance'];
const DEFAULTS_TABS = [
    { id: 'gallery', label: __('Gallery Defaults', 'fotogrids'), icon: 'layout_3x3' },
    { id: 'album', label: __('Album Defaults', 'fotogrids'), icon: 'layout_2x2' }
];

const PluginSettingsPage = () => {
    const uiState = window.FotoGridsUiState?.createNamespace({ area: 'plugin-settings' });

    const tabs = [
        { id: 'media', label: __('Media', 'fotogrids'), icon: 'image', group: 'setup' },
        { id: 'responsiveness', label: __('Responsiveness', 'fotogrids'), icon: 'responsive_desktop', group: 'setup' },
        { id: 'defaults', label: __('Defaults', 'fotogrids'), icon: 'layout', group: 'setup' },
        { id: 'view_pages', label: __('View Pages', 'fotogrids'), icon: 'image', group: 'setup' },
        { id: 'sharing', label: __('Sharing', 'fotogrids'), icon: 'share', group: 'setup' },
        { id: 'permissions_manager', label: __('Permissions Manager', 'fotogrids'), icon: 'security', group: 'setup' },
        { id: 'advanced', label: __('Advanced', 'fotogrids'), icon: 'settings', group: 'system' },
        { id: 'maintenance', label: __('Maintenance', 'fotogrids'), icon: 'tools', group: 'system' }
    ];

    const tabGroups = [
        { id: 'setup', label: __('Setup', 'fotogrids') },
        { id: 'system', label: __('System', 'fotogrids') }
    ];

    const getTabUrl = (tabId) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tabId);
        url.searchParams.delete('field');
        url.searchParams.delete('subtab');
        return url.toString();
    };

    // Resolve the active main tab from persisted state, normalising the legacy
    // 'general' alias to 'responsiveness'.
    const resolveActiveTab = () => {
        if (!uiState) return 'media';
        const raw = uiState.getValue({ key: 'main-tab', fallback: 'media', urlParam: 'tab', allowed: TAB_IDS });
        return raw === 'general' ? 'responsiveness' : raw;
    };

    // The subtab only applies to the Defaults tab. For any other tab it is
    // always 'gallery' (the default) regardless of what the URL or session may
    // still carry, so a stale subtab can never leak into a non-defaults tab.
    const resolveDefaultsSubTab = (tabId) => {
        if (!uiState || tabId !== 'defaults') return 'gallery';
        return uiState.getValue({ key: 'defaults-subtab', fallback: 'gallery', urlParam: 'subtab', allowed: DEFAULTS_TABS.map((tab) => tab.id) });
    };

    const [activeTab, setActiveTab] = useState(resolveActiveTab);
    const [activeDefaultsSubTab, setActiveDefaultsSubTab] = useState(() => resolveDefaultsSubTab(resolveActiveTab()));

    useEffect(() => {
        const handlePopState = () => {
            if (!uiState) return;
            const tabId = resolveActiveTab();
            setActiveTab(tabId);
            setActiveDefaultsSubTab(resolveDefaultsSubTab(tabId));
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const fieldParam = urlParams.get('field');

        if (!fieldParam) return;

        const scrollToField = () => {
            const fieldElement = document.getElementById(fieldParam);
            if (fieldElement) {
                fieldElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                if (fieldElement.tagName === 'INPUT' ||
                    fieldElement.tagName === 'SELECT' ||
                    fieldElement.tagName === 'TEXTAREA') {
                    fieldElement.focus();
                } else if (fieldElement.tagName === 'LABEL' && fieldElement.htmlFor) {
                    const associatedInput = document.getElementById(fieldElement.htmlFor);
                    if (associatedInput) {
                        associatedInput.focus();
                    }
                }

                fieldElement.style.transition = 'box-shadow 0.3s ease';
                fieldElement.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.3)';
                setTimeout(() => {
                    fieldElement.style.boxShadow = '';
                    setTimeout(() => {
                        fieldElement.style.transition = '';
                    }, 300);
                }, 2000);

                return true;
            }
            return false;
        };

        const attemptScroll = () => {
            if (scrollToField()) {
                return;
            }

            let attempts = 0;
            const maxAttempts = 20;

            const interval = setInterval(() => {
                attempts++;
                if (scrollToField() || attempts >= maxAttempts) {
                    clearInterval(interval);
                }
            }, 100);
        };

        setTimeout(attemptScroll, 300);
    }, [activeTab]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);

        if (uiState) {
            uiState.setValue({ key: 'main-tab', value: tabId, urlParam: 'tab' });

            // The subtab only applies to the Defaults tab. On any other tab it
            // must be absent from both the URL and the session - clear it so it
            // never lingers. Reset the local state too so Defaults opens on the
            // first subtab next time.
            if (tabId !== 'defaults') {
                uiState.clearValue({ key: 'defaults-subtab', urlParam: 'subtab' });
                setActiveDefaultsSubTab('gallery');
            }
        }

        // Remove the field deep-link param when switching tabs.
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('field');
            window.history.replaceState({}, '', url.toString());
        } catch ( _e ) {
            // History API unavailable - fail silently.
        }
    };

    const handleSubTabChange = (subTabId) => {
        setActiveDefaultsSubTab(subTabId);

        if (uiState) {
            uiState.setValue({ key: 'main-tab', value: 'defaults', urlParam: 'tab' });
            uiState.setValue({ key: 'defaults-subtab', value: subTabId, urlParam: 'subtab' });
        }

        // Remove the field deep-link param when switching subtabs.
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('field');
            window.history.replaceState({}, '', url.toString());
        } catch ( _e ) {
            // History API unavailable - fail silently.
        }
    };

    const renderTabContent = (tabId) => {
        switch (tabId) {
            case 'media':
                return <MediaTab />;
            case 'responsiveness':
                return <ResponsivenessTab />;
            case 'defaults':
                return (
                    <>
                        <Panel
                            title={__('Defaults', 'fotogrids')}
                            description={__('Default settings applied to new Galleries and Albums.', 'fotogrids')}
                            noBodyPadding
                        >
                            <TabBar
                                tabs={ DEFAULTS_TABS }
                                activeTab={ activeDefaultsSubTab }
                                onTabChange={ handleSubTabChange }
                            />
                        </Panel>
                        <Panel equalBodyPadding>
                            {/*
                            * Defaults uses the shared CollectionSettings app, which in
                            * defaults mode persists by writing hidden inputs into this
                            * options.php form and submitting via the WordPress Settings
                            * API. This form is scoped to the Defaults tab only - the
                            * other tabs save via REST.
                            */}
                            <form method="post" action="options.php" className="fotogrids-defaults-form">
                                <input type="hidden" name="option_page" value="fotogrids_settings" />
                                <input type="hidden" name="action" value="update" />
                                <input type="hidden" name="_wpnonce" value={window.fotogridsAdmin?.settingsNonce || ''} />
                                <DefaultsTab key={activeDefaultsSubTab} type={activeDefaultsSubTab} />
                                <button type="submit" className="fotogrids-button fotogrids-button--primary fotogrids-button--small">
                                    {__('Save Defaults', 'fotogrids')}
                                </button>
                            </form>
                        </Panel>
                    </>
                );
            case 'view_pages':
                return <ViewPagesTab />;
            case 'sharing':
                return <SharingTab />;
            case 'permissions_manager':
                return (
                    <Panel
                        title={__('Permissions Manager', 'fotogrids')}
                        description={__('Control which roles can create and manage galleries and albums.', 'fotogrids')}
                    >
                        <PermissionsManagerTab />
                    </Panel>
                );
            case 'advanced':
                return <AdvancedTab />;
            case 'maintenance':
                return <MaintenanceTab />;
            default:
                return <div key="default">{__('Select a tab to configure settings', 'fotogrids')}</div>;
        }
    };

    return (
        <div className="fotogrids-plugin-settings">
            <SidebarTabs
                className="fotogrids-sidebar-tabs--bare-content"
                tabs={tabs}
                groups={tabGroups}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                getTabHref={getTabUrl}
                ariaLabel={__('Settings sections', 'fotogrids')}
            >
                {/*
                  * Each tab self-saves via its own SaveBar (REST). The old
                  * options.php form + page-level Save button were removed when
                  * settings moved to REST persistence.
                  */}
                {renderTabContent(activeTab)}
            </SidebarTabs>
        </div>
    );
};

export default PluginSettingsPage;
