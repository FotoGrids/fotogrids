import React, { useState, useEffect } from 'react';
import TabNavigation from '../plugin-settings/TabNavigation';
import ResponsivenessTab from '../plugin-settings/tabs/ResponsivenessTab';
import DefaultsTab from '../plugin-settings/tabs/DefaultsTab';
import AdvancedTab from '../plugin-settings/tabs/AdvancedTab';
import PermissionsManagerTab from '../plugin-settings/tabs/PermissionsManagerTab';
import MediaTab from '../plugin-settings/tabs/MediaTab';

const { __ } = wp.i18n;

const TAB_IDS = ['media', 'responsiveness', 'defaults', 'permissions_manager', 'advanced'];
const SUBTAB_IDS = ['gallery', 'album'];

const PluginSettingsPage = () => {
    const uiState = window.FotoGridsUiState?.createNamespace({ area: 'plugin-settings' });

    const tabs = [
        { id: 'media', label: __('Media', 'fotogrids') },
        { id: 'responsiveness', label: __('Responsiveness', 'fotogrids') },
        { id: 'defaults', label: __('Defaults', 'fotogrids') },
        { id: 'permissions_manager', label: __('Permissions Manager', 'fotogrids'), pro: true },
        { id: 'advanced', label: __('Advanced', 'fotogrids') }
    ];

    const [activeTab, setActiveTab] = useState(() => {
        if (!uiState) return 'media';
        // Normalise legacy 'general' alias.
        const raw = uiState.getValue({ key: 'main-tab', fallback: 'media', urlParam: 'tab', allowed: TAB_IDS });
        return raw === 'general' ? 'responsiveness' : raw;
    });

    const [activeSubTab, setActiveSubTab] = useState(() => {
        if (!uiState) return 'gallery';
        return uiState.getValue({ key: 'subtab', fallback: 'gallery', urlParam: 'subtab', allowed: SUBTAB_IDS });
    });

    useEffect(() => {
        const handlePopState = () => {
            if (!uiState) return;
            const raw = uiState.getValue({ key: 'main-tab', fallback: 'media', urlParam: 'tab', allowed: TAB_IDS });
            setActiveTab(raw === 'general' ? 'responsiveness' : raw);
            setActiveSubTab(uiState.getValue({ key: 'subtab', fallback: 'gallery', urlParam: 'subtab', allowed: SUBTAB_IDS }));
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

        // Reset sub-tab when switching away from defaults.
        if (tabId !== 'defaults') {
            setActiveSubTab('gallery');
            if (uiState) {
                uiState.setValue({ key: 'subtab', value: 'gallery', urlParam: 'subtab' });
            }
        }

        if (uiState) {
            uiState.setValue({ key: 'main-tab', value: tabId, urlParam: 'tab' });
        }

        // Remove the field deep-link param when switching tabs.
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('field');
            window.history.replaceState({}, '', url.toString());
        } catch ( _e ) {
            // History API unavailable — fail silently.
        }
    };

    const handleSubTabChange = (subTabId) => {
        setActiveSubTab(subTabId);

        if (uiState) {
            uiState.setValue({ key: 'main-tab', value: 'defaults', urlParam: 'tab' });
            uiState.setValue({ key: 'subtab', value: subTabId, urlParam: 'subtab' });
        }

        // Remove the field deep-link param when switching subtabs.
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('field');
            window.history.replaceState({}, '', url.toString());
        } catch ( _e ) {
            // History API unavailable — fail silently.
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
                    <div className="fotogrids-defaults-tab">
                        <div className="fotogrids-defaults-subtabs">
                            <button
                                type="button"
                                className={`fotogrids-defaults-subtab ${activeSubTab === 'gallery' ? 'fg-is-active' : ''}`}
                                onClick={() => handleSubTabChange('gallery')}
                            >
                                {__('Gallery Defaults', 'fotogrids')}
                            </button>
                            <button
                                type="button"
                                className={`fotogrids-defaults-subtab ${activeSubTab === 'album' ? 'fg-is-active' : ''}`}
                                onClick={() => handleSubTabChange('album')}
                            >
                                {__('Album Defaults', 'fotogrids')}
                            </button>
                        </div>
                        <div className="fotogrids-defaults-content">
                            <DefaultsTab key={activeSubTab} type={activeSubTab} />
                        </div>
                    </div>
                );
            case 'permissions_manager':
                return <PermissionsManagerTab />;
            case 'advanced':
                return <AdvancedTab />;
            default:
                return <div key="default">{__('Select a tab to configure settings', 'fotogrids')}</div>;
        }
    };

    return (
        <div className="fotogrids-plugin-settings">
            <TabNavigation
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />

            <div className="fotogrids-tab-content">
                <form method="post" action="options.php">
                    <input type="hidden" name="option_page" value="fotogrids_settings" />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="_wpnonce" value={window.fotogridsAdmin?.settingsNonce || ''} />
                    {renderTabContent(activeTab)}
                    {/* Media tab manages its own save button; hide the outer one for it */}
                    {activeTab !== 'media' && (
                        <p className="submit">
                            <button type="submit" className="fotogrids-button fotogrids-button--primary fotogrids-button--smaller">
                                {__('Save Settings', 'fotogrids')}
                            </button>
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};

export default PluginSettingsPage;
