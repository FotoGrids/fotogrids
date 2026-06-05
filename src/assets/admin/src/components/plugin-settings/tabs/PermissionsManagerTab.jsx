import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiFetch from '@wordpress/api-fetch';
import Icon from '../../shared/Icon';
import InfoBlock from '../../shared/InfoBlock';
import Segmented from '../../shared/Segmented';
import { Button } from '../../shared/Button';
import Panel from '../../shared/SidebarTabs/elements/Panel';
import PanelRow from '../../shared/SidebarTabs/elements/PanelRow';

const { __ } = wp.i18n;

const ROLE_LADDER = ['administrator', 'editor', 'author', 'contributor', 'subscriber'];

const ROLE_LABEL_OVERRIDES = {
    administrator: __('Administrator', 'fotogrids'),
    editor: __('Editor', 'fotogrids'),
    author: __('Author', 'fotogrids'),
    contributor: __('Contributor', 'fotogrids'),
    subscriber: __('Subscriber', 'fotogrids'),
};

const GROUP_LABELS = {
    gallery: __('Galleries', 'fotogrids'),
    album: __('Albums', 'fotogrids'),
    media: __('Library', 'fotogrids'),
    stats: __('Statistics', 'fotogrids'),
    tools: __('Tools', 'fotogrids'),
    modules: __('Modules', 'fotogrids'),
    plugin: __('Plugin', 'fotogrids'),
};

/**
 * Determine the current "lowest role" value for a logical permission, based
 * on which standard roles currently hold every cap in its underlying_caps.
 * Returns one of the ladder slugs, or 'custom' when the grants do not form
 * a clean ladder (e.g. Pro has been used to flip individual caps).
 */
const resolveLowestRole = (logical, rolesByKey) => {
    if (!logical.underlying_caps || logical.underlying_caps.length === 0) {
        return 'custom';
    }

    const ladderHasAll = (roleKey) => {
        const role = rolesByKey[roleKey];
        if (!role) return false;
        return logical.underlying_caps.every((cap) => role.capabilities[cap] === true);
    };

    // Walk from least privileged up; first role that holds every cap is the
    // "lowest". If the higher roles don't all hold every cap too, it's custom.
    for (let i = ROLE_LADDER.length - 1; i >= 0; i -= 1) {
        const roleKey = ROLE_LADDER[i];
        if (!rolesByKey[roleKey]) continue;
        if (ladderHasAll(roleKey)) {
            // Validate inheritance - every role above must also have all caps.
            const higher = ROLE_LADDER.slice(0, i);
            const inheritanceOk = higher.every((r) => !rolesByKey[r] || ladderHasAll(r));
            return inheritanceOk ? roleKey : 'custom';
        }
    }

    return 'custom';
};

const PermissionsManagerTab = () => {
    const [registry, setRegistry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState({});
    const [overrideMatrix, setOverrideMatrix] = useState(null);
    const [overridePanelOne, setOverridePanelOne] = useState(null);

    // Pro extension point: Pro replaces the Panel 2 matrix component by
    // calling window.FotoGridsAdmin.permissions.registerMatrixOverride(C).
    // Pro can also augment Panel 1 via registerPanelOverride('simple', C).
    useEffect(() => {
        const namespace = window.FotoGridsAdmin?.permissions;
        if (!namespace) return;
        setOverrideMatrix(() => namespace._matrixOverride || null);
        setOverridePanelOne(() => namespace._simplePanelOverride || null);

        const onOverride = (event) => {
            const { panel, component } = event.detail || {};
            if (panel === 'matrix') {
                setOverrideMatrix(() => component || null);
            }
            if (panel === 'simple') {
                setOverridePanelOne(() => component || null);
            }
        };
        document.addEventListener('fotogrids:admin:permissions:override', onOverride);
        return () => document.removeEventListener('fotogrids:admin:permissions:override', onOverride);
    }, []);

    const loadRegistry = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch({ path: '/fotogrids/v1/permissions/registry' });
            setRegistry(data);
            if (window.FotoGridsAdmin?.permissions) {
                window.FotoGridsAdmin.permissions._registry = data;
            }
        } catch (e) {
            setError(e?.message || __('Failed to load permissions.', 'fotogrids'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadRegistry(); }, [loadRegistry]);

    const rolesByKey = useMemo(() => {
        if (!registry?.roles) return {};
        const map = {};
        registry.roles.forEach((r) => { map[r.key] = r; });
        return map;
    }, [registry]);

    const availableLadderRoles = useMemo(() => {
        // Only show standard WP roles in Panel 1 - custom roles are not on
        // the inheritance ladder and aren't meaningful for "lowest role".
        return ROLE_LADDER.filter((key) => rolesByKey[key]);
    }, [rolesByKey]);

    const handleOptionChange = useCallback(async (key, value) => {
        try {
            await apiFetch({
                path: '/fotogrids/v1/permissions/options',
                method: 'POST',
                data: { key, value },
            });
            await loadRegistry();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('FotoGrids permissions: failed to save option', e);
        }
    }, [loadRegistry]);

    const handleSimpleChange = useCallback(async (key, lowestRole) => {
        setSaving((prev) => ({ ...prev, [key]: true }));
        try {
            await apiFetch({
                path: '/fotogrids/v1/permissions/simple',
                method: 'POST',
                data: { key, lowest_role: lowestRole },
            });
            await loadRegistry();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('FotoGrids permissions: failed to save', e);
        } finally {
            setSaving((prev) => ({ ...prev, [key]: false }));
        }
    }, [loadRegistry]);

    if (loading) {
        return (
            <div className="fotogrids-permissions-manager">
                <p>{__('Loading permissions…', 'fotogrids')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fotogrids-permissions-manager">
                <p className="description">{error}</p>
            </div>
        );
    }

    if (!registry) return null;

    // ---- Panel 1: Capability Settings (logical, lowest-role dropdowns) ----
    const renderSimplePanel = () => {
        if (overridePanelOne) {
            const C = overridePanelOne;
            return <C registry={registry} reload={loadRegistry} />;
        }
        const unauthorisedVisibility = registry.options?.unauthorised_visibility || 'readonly';
        return (
            <>
                <InfoBlock
                    icon="info_square"
                    title={__('How roles & capabilities work', 'fotogrids')}
                    description={__(
                        'Pick the lowest role that should have each capability. Higher roles automatically inherit it. For example, setting a capability to "Editor" means editors and administrators have it; authors and below do not.',
                        'fotogrids'
                    )}
                />

                <PanelRow
                    title={__('Unauthorised settings panels', 'fotogrids')}
                    description={__(
                        'How to render the Settings and Templates metaboxes for users who can edit a gallery or album but cannot modify its settings.',
                        'fotogrids'
                    )}
                    largerLabels
                >
                    <Segmented
                        ariaLabel={__('Unauthorised settings panels', 'fotogrids')}
                        value={unauthorisedVisibility}
                        onChange={(v) => handleOptionChange('unauthorised_visibility', v)}
                        options={[
                            { value: 'readonly', label: __('Read-only with notice', 'fotogrids') },
                            { value: 'hidden', label: __('Hide entirely', 'fotogrids') },
                        ]}
                    />
                </PanelRow>

                {registry.simple.map((def) => {
                    const currentValue = resolveLowestRole(def, rolesByKey);
                    const isCustom = currentValue === 'custom';
                    const isSaving = !!saving[def.key];
                    const selectId = `fg-perm-${def.key}`;
                    return (
                        <PanelRow
                            key={def.key}
                            title={def.label}
                            description={def.description}
                            htmlFor={selectId}
                            largerLabels
                        >
                            <select
                                id={selectId}
                                value={isCustom ? '__custom__' : currentValue}
                                disabled={isSaving}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '__custom__') return;
                                    handleSimpleChange(def.key, v);
                                }}
                            >
                                {isCustom && (
                                    <option value="__custom__">
                                        {__('Custom (configured in matrix)', 'fotogrids')}
                                    </option>
                                )}
                                {availableLadderRoles.map((roleKey) => (
                                    <option key={roleKey} value={roleKey}>
                                        {ROLE_LABEL_OVERRIDES[roleKey] || rolesByKey[roleKey].name}
                                    </option>
                                ))}
                            </select>
                        </PanelRow>
                    );
                })}
            </>
        );
    };

    // ---- Panel 2: Permissions Manager matrix (Free readonly, Pro override) ----
    const renderMatrixPanel = () => {
        if (overrideMatrix) {
            const C = overrideMatrix;
            return <C registry={registry} reload={loadRegistry} />;
        }

        const grouped = registry.advanced.reduce((acc, def) => {
            const g = def.group || 'plugin';
            if (!acc[g]) acc[g] = [];
            acc[g].push(def);
            return acc;
        }, {});

        const groupKeys = Object.keys(grouped);
        const allRoles = registry.roles;
        const totalColumns = Math.max(allRoles.length, 1);

        return (
            <>
                <div className="fg-rpm__pro-box">
                    <span className="fotogrids-pro-badge">{__('PRO', 'fotogrids')}</span>
                    <div className="fg-rpm__pro-box-text">
                        {__(
                            'Take full control of every capability per role, override permissions per user, and grant access per gallery or album.',
                            'fotogrids'
                        )}
                    </div>
                    <Button
                        variant="primary"
                        size="xs"
                        onClick={(e) => {
                            e.preventDefault();
                            const url = window.fotogridsUpgradeModal?.urls?.upgrade;
                            if (url) window.open(url, '_blank');
                        }}
                    >
                        {__('Upgrade Now', 'fotogrids')}
                    </Button>
                </div>

                <div className="fg-rpm__table" style={{ '--columns': totalColumns }}>
                    <div className="fg-rpm__header-cell fg-rpm__header-cell--permission" />
                    {allRoles.map((role) => (
                        <div key={`header-${role.key}`} className="fg-rpm__header-cell">
                            {ROLE_LABEL_OVERRIDES[role.key] || role.name}
                        </div>
                    ))}

                    {groupKeys.map((groupKey) => (
                        <React.Fragment key={groupKey}>
                            <div className="fg-rpm__category-header">
                                <div className="fg-rpm__category-header-content">
                                    {GROUP_LABELS[groupKey] || groupKey}
                                </div>
                            </div>
                            {grouped[groupKey].map((def, idx) => {
                                const isEven = idx % 2 === 0;
                                return (
                                    <React.Fragment key={def.key}>
                                        <div className={`fg-rpm__cell fg-rpm__cell--permission ${isEven ? 'fg-rpm__cell--even' : 'fg-rpm__cell--odd'}`}>
                                            <span
                                                className="fg-rpm__permission-name"
                                                data-tooltip={def.description || def.key}
                                            >
                                                {def.label}
                                            </span>
                                        </div>
                                        {allRoles.map((role) => {
                                            const checked = role.capabilities[def.key] === true;
                                            const iconName = checked ? 'check_circle' : 'circle';
                                            return (
                                                <div
                                                    key={`${def.key}-${role.key}`}
                                                    className={`fg-rpm__cell fg-rpm__cell--checkbox ${checked ? 'fg-rpm__cell--checkbox-checked' : ''} ${isEven ? 'fg-rpm__cell--even' : 'fg-rpm__cell--odd'}`}
                                                >
                                                    <Icon name={iconName} />
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </>
        );
    };

    return (
        <>
            <Panel
                title={__('Capability Settings', 'fotogrids')}
                description={__('Quick lowest-role configuration for the most common permissions.', 'fotogrids')}
            >
                {renderSimplePanel()}
            </Panel>

            <Panel
                title={__('Permissions Manager', 'fotogrids')}
                description={__('Full granular view of every FotoGrids capability per role.', 'fotogrids')}
            >
                {renderMatrixPanel()}
            </Panel>
        </>
    );
};

export default PermissionsManagerTab;
