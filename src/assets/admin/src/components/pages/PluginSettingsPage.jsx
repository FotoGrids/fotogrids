import React, { useState, useEffect, useRef } from 'react';
import TabNavigation from '../plugin-settings/TabNavigation';
import GeneralTab from '../plugin-settings/tabs/GeneralTab';
import DefaultsTab from '../plugin-settings/tabs/DefaultsTab';
import AdvancedTab from '../plugin-settings/tabs/AdvancedTab';
import CustomCodeTab from '../plugin-settings/tabs/CustomCodeTab';
import PermissionsManagerTab from '../plugin-settings/tabs/PermissionsManagerTab';
import LicenseTab from '../plugin-settings/tabs/LicenseTab';

const { __ } = wp.i18n;

const PluginSettingsPage = () => {
    const [activeTab, setActiveTab] = useState('general');
    const [activeSubTab, setActiveSubTab] = useState('gallery');
    const hasInitializedRef = useRef(false);

    const tabs = [
        { id: 'general', label: __('General', 'fotogrids') },
        { id: 'defaults', label: __('Defaults', 'fotogrids') },
        { id: 'custom_code', label: __('Custom Code', 'fotogrids'), pro: true },
        { id: 'permissions_manager', label: __('Permissions Manager', 'fotogrids'), pro: true },
        { id: 'license', label: __('License', 'fotogrids') },
        { id: 'advanced', label: __('Advanced', 'fotogrids') }
    ];

    useEffect(() => {
        if (hasInitializedRef.current) return;

        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        const subTabParam = urlParams.get('subtab');

        if (tabParam) {
            const validTab = tabs.find(tab => tab.id === tabParam);
            if (validTab) {
                setActiveTab(tabParam);
            }
        }

        if (subTabParam && (subTabParam === 'gallery' || subTabParam === 'album')) {
            setActiveSubTab(subTabParam);
        }

        hasInitializedRef.current = true;
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');

            if (tabParam) {
                const validTab = tabs.find(tab => tab.id === tabParam);
                if (validTab) {
                    setActiveTab(tabParam);
                }
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
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

        // Reset sub-tab when switching away from defaults
        if (tabId !== 'defaults') {
            setActiveSubTab('gallery');
        }

        const url = new URL(window.location.href);
        url.searchParams.set('tab', tabId);
        url.searchParams.delete('field');
        url.searchParams.delete('subtab');

        window.history.pushState({}, '', url.toString());
    };

    const handleSubTabChange = (subTabId) => {
        setActiveSubTab(subTabId);

        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'defaults');
        url.searchParams.set('subtab', subTabId);
        url.searchParams.delete('field');

        window.history.pushState({}, '', url.toString());
    };

    const renderTabContent = (tabId) => {
        switch (tabId) {
            case 'general':
                return <GeneralTab />;
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
            case 'custom_code':
                return <CustomCodeTab />;
            case 'permissions_manager':
                return <PermissionsManagerTab />;
            case 'license':
                return <LicenseTab />;
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
                    <p className="submit">
                        <button type="submit" className="fotogrids-button fotogrids-button--primary fotogrids-button--smaller">
                            {__('Save Settings', 'fotogrids')}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default PluginSettingsPage;
