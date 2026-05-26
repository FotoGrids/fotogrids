import React, { useState, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import SidebarTabs from '../shared/SidebarTabs/SidebarTabs';
import ToolsComponents from '../../tools-registry.js';
import Icon from '../shared/Icon.jsx';

/**
 * FotoGrids Tools Page
 *
 * A manifest-driven shell. The page fetches the list of registered tools
 * from the PHP registry via REST and renders one of two layouts:
 *
 * Mode A - no ?tool= param → card grid overview of all tools.
 * Mode B - ?tool=<id>      → SidebarTabs shell with the matched tool's
 *                            React component in the content pane.
 *
 * The card grid and the sidebar tab list are both built from the manifest,
 * so adding a new tool requires no changes here - just registering it in
 * PHP (Tools_Registry) and JS (FotoGridsToolsComponents).
 *
 * URL sync mirrors PluginSettingsPage: reads ?tool= on init, writes it
 * on tab change via FotoGridsUiState, handles browser back/forward.
 */
const ToolsPage = () => {
    const uiState = window.FotoGridsUiState?.createNamespace({ area: 'tools' });

    const [manifest, setManifest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Derive active tool from the URL param only - not from sessionStorage.
    // The tool param is deep-link state: if it's not in the URL, we're on
    // the grid view regardless of what was visited previously.
    const [activeTool, setActiveTool] = useState(() => {
        return new URLSearchParams( window.location.search ).get( 'tool' ) || null;
    });

    // Incremented when a per-tool script registers its component, triggering
    // a re-render so ToolsPage picks up the newly available component.
    const [, setComponentRevision] = useState(0);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await apiFetch({ path: '/fotogrids/v1/admin/tools' });
                setManifest(data || []);

                const urlParam = new URLSearchParams( window.location.search ).get( 'tool' );
                if (urlParam) {
                    const exists = (data || []).some(t => t.id === urlParam);
                    if (!exists) {
                        setActiveTool(null);
                        if (uiState) uiState.setValue({ key: 'tool', value: null, urlParam: 'tool' });
                    } else {
                        setActiveTool(urlParam);
                    }
                }
            } catch (err) {
                setError(err?.message || __('Failed to load tools.', 'fotogrids'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            const raw = new URLSearchParams( window.location.search ).get( 'tool' );
            setActiveTool(raw || null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Per-tool bundles load synchronously in the footer *before* React mounts
    // (index.js defers initializeAdminPages via setTimeout). That means the tool
    // script calls FotoGridsToolsComponents.register() - and fires the
    // 'fotogrids:tool-component-registered' event - before ToolsPage's useEffect
    // listener is attached. The event is therefore lost.
    //
    // Fix: on mount (and whenever activeTool changes), check immediately whether
    // the component is already registered. If it is, bump the revision counter
    // right away. Also keep the event listener for tools that load *after* mount
    // (e.g. very large bundles or future lazy-loaded tools).
    useEffect(() => {
        if (activeTool && ToolsComponents.get(activeTool)) {
            setComponentRevision(n => n + 1);
        }

        const handler = (e) => {
            if (e.detail?.id === activeTool) {
                setComponentRevision(n => n + 1);
            }
        };
        window.addEventListener('fotogrids:tool-component-registered', handler);
        return () => window.removeEventListener('fotogrids:tool-component-registered', handler);
    }, [activeTool]);

    const handleToolChange = (toolId) => {
        setActiveTool(toolId);
        if (uiState) uiState.setValue({ key: 'tool', value: toolId, urlParam: 'tool' });
    };

    const getTabHref = (toolId) => {
        const url = new URL(window.location.href);
        url.searchParams.set('tool', toolId);
        return url.toString();
    };

    const accessStateLabel = (tool) => {
        if (tool.access_state === 'teaser') return tool.tier_required;
        if (tool.access_state === 'locked') return tool.tier_required;
        return null;
    };

    if (loading) {
        return (
            <div className="fg-tools-page fg-tools-page--loading">
                <span className="spinner is-active" style={{ float: 'none', marginTop: 0 }} />
                {' '}{__('Loading tools…', 'fotogrids')}
            </div>
        );
    }

    if (error) {
        return (
            <div className="fg-tools-page">
                <div className="notice notice-error"><p>{error}</p></div>
            </div>
        );
    }

    const tools = manifest || [];

    if (activeTool) {
        const currentTool = tools.find(t => t.id === activeTool);

        // Unknown tool id - silently fall back to grid.
        if (!currentTool) {
            setActiveTool(null);
            if (uiState) uiState.setValue({ key: 'tool', value: null, urlParam: 'tool' });
        }

        const tabs = tools.map(t => ({
            id: t.id,
            label: t.label,
            icon: t.icon,
        }));

        const ToolComponent = ToolsComponents.get(currentTool?.component);

        return (
            <div className="fg-tools-page fg-tools-page--detail">
                <SidebarTabs
                    className="fotogrids-sidebar-tabs--bare-content"
                    tabs={tabs}
                    activeTab={activeTool}
                    onTabChange={handleToolChange}
                    getTabHref={getTabHref}
                    ariaLabel={__('Tools navigation', 'fotogrids')}
                >
                    {currentTool && !currentTool.available ? (
                        <div className="fg-tool-unavailable">
                            <div className="fg-tool-unavailable__icon">
                                <span className={`dashicons dashicons-${currentTool.icon}`} />
                            </div>
                            <h2>{currentTool.label}</h2>
                            <p>{currentTool.description}</p>
                            <div className="fg-tool-unavailable__notice">
                                {__('This tool is coming soon.', 'fotogrids')}
                            </div>
                        </div>
                    ) : ToolComponent ? (
                        <ToolComponent key={activeTool} />
                    ) : (
                        <div className="fg-tool-missing">
                            <p>{__('This tool could not be loaded. The component may not be registered.', 'fotogrids')}</p>
                        </div>
                    )}
                </SidebarTabs>
            </div>
        );
    }

    return (
        <div className="fg-tools-page fg-tools-page--grid">
            <div className="fg-tools-grid">
                {tools.map(tool => {
                    const isLocked = tool.access_state === 'teaser' || tool.access_state === 'locked';
                    const isUnavailable = !tool.available;
                    const tierLabel = accessStateLabel(tool);

                    const cardInner = (
                        <>
                            <div className="fg-tool-card__image">
                                {tool.image && <img src={tool.image} alt="" />}
                            </div>
                            <div className="fg-tool-card__body">
                                <div className="fg-tool-card__header">
                                    <Icon name={tool.icon} className="fg-tool-card__icon" />
                                    <h2 className="fg-tool-card__title">{tool.label}</h2>
                                    {tierLabel && (
                                        <span className="fg-tool-card__tier-badge">
                                            {tierLabel}
                                        </span>
                                    )}
                                    {isUnavailable && !isLocked && (
                                        <span className="fg-tool-card__soon-badge">
                                            {__('Coming soon', 'fotogrids')}
                                        </span>
                                    )}
                                </div>
                                <p className="fg-tool-card__description">{tool.description}</p>
                            </div>
                        </>
                    );

                    const cardClasses = [
                        'fg-tool-card',
                        isLocked ? 'fg-tool-card--locked' : '',
                        isUnavailable ? 'fg-tool-card--unavailable' : '',
                    ].filter(Boolean).join(' ');

                    const cardStyle = tool.image_bg_color ? { '--fg-tool-card-color': tool.image_bg_color } : undefined;

                    return !isLocked ? (
                        <a
                            key={tool.id}
                            href={isUnavailable ? undefined : getTabHref(tool.id)}
                            className={cardClasses}
                            style={cardStyle}
                            onClick={isUnavailable ? undefined : (e) => {
                                e.preventDefault();
                                handleToolChange(tool.id);
                            }}
                            aria-disabled={isUnavailable || undefined}
                        >
                            {cardInner}
                        </a>
                    ) : (
                        <div
                            key={tool.id}
                            className={cardClasses}
                            style={cardStyle}
                        >
                            {cardInner}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ToolsPage;
