import React from 'react';

const { __ } = wp.i18n;

const TabNavigation = ({ tabs, activeTab, onTabChange }) => {
    const getTabUrl = (tabId) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tabId);
        url.searchParams.delete('field');
        return url.toString();
    };

    return (
        <div className="fotogrids-tab-nav">
            <h2 className="nav-tab-wrapper">
                {tabs.map(tab => (
                    <a
                        key={tab.id}
                        href={getTabUrl(tab.id)}
                        className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            onTabChange(tab.id);
                        }}
                        title={getTabUrl(tab.id)}
                    >
                        {tab.label}
                        {tab.pro && (
                            <span className="fotogrids-pro-badge">
                                {__('Pro', 'fotogrids')}
                            </span>
                        )}
                    </a>
                ))}
            </h2>
        </div>
    );
};

export default TabNavigation;

