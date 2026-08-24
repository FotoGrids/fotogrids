import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiFetch from '@wordpress/api-fetch';
import Toggle from '../../shared/Toggle';
import { Confirm } from '../../shared/Modal';
import { Button } from '../../shared/Button';
import InfoBlock from '../../shared/InfoBlock';
import StatusLight from '../../shared/StatusLight';
import {
    SettingsPanel,
    PanelRow,
    DangerZone,
    SaveBar,
} from '../../shared/settings';

const { __, sprintf } = wp.i18n;

// Untranslated on purpose: the user has to type this string exactly.
const CONFIRM_KEYWORD = 'CONFIRM';

/**
 * Plugin Settings -> Maintenance tab.
 *
 * Two panels:
 *  1. Maintenance - destructive actions ("Reset all settings", "Reinstall
 *     database tables") with a confirm modal each, gated to admins on the
 *     server side by the `manage_fotogrids` capability.
 *  2. Debug Log - one toggle per channel exposed by the PHP Debug_Log helper.
 *     The panel header reports the server's WP_DEBUG and WP_DEBUG_LOG state as
 *     status lights, and an InfoBlock explains whichever of the two is off.
 *     Each row prints its FOTOGRIDS_DEBUG_<UPPER_SLUG> constant; channels
 *     overridden by that constant render as locked rows.
 *
 * All state lives in this component. The destructive actions are imperative
 * (no dirty-state tracking) - they execute on confirm. The Debug Log panel
 * uses the same SaveBar / dirty-state pattern as AdvancedTab so the user can
 * stage their channel selections before persisting them.
 */
const MaintenanceTab = () => {
    // `pending` holds the action key currently being confirmed by the modal
    // (null if the modal is closed). `running` is the action key whose REST
    // call is in-flight. `result` is the most recent {kind: 'reset' |
    // 'reinstall', status: 'success' | 'error', message} feedback to surface
    // inline under the row.
    const [pending, setPending] = useState(null);
    const [running, setRunning] = useState(null);
    const [result, setResult] = useState(null);

    const closeModal = useCallback(() => {
        if (running) return;
        setPending(null);
    }, [running]);

    const showResult = (kind, status, message) => {
        setResult({ kind, status, message });
        if (status === 'success') {
            // Auto-clear successful banners after a few seconds; errors stay
            // until the user retries so they don't disappear before being
            // read.
            setTimeout(() => {
                setResult((prev) => (prev && prev.kind === kind && prev.status === 'success' ? null : prev));
            }, 5000);
        }
    };

    const runResetOptions = async () => {
        setRunning('reset');
        try {
            const response = await apiFetch({
                path: '/fotogrids/v1/admin/maintenance/reset-options',
                method: 'POST',
            });
            const message = (response && response.message)
                || __('Plugin settings reset to defaults.', 'fotogrids');
            showResult('reset', 'success', message);
        } catch (err) {
            const message = (err && err.message)
                || __('Settings could not be reset. Please try again.', 'fotogrids');
            showResult('reset', 'error', message);
        } finally {
            setRunning(null);
            setPending(null);
        }
    };

    const runReinstallTables = async () => {
        setRunning('reinstall');
        try {
            const response = await apiFetch({
                path: '/fotogrids/v1/admin/maintenance/reinstall-tables',
                method: 'POST',
            });
            const message = (response && response.message)
                || __('Database tables reinstalled.', 'fotogrids');
            showResult('reinstall', 'success', message);
        } catch (err) {
            const message = (err && err.message)
                || __('Tables could not be reinstalled. Please try again.', 'fotogrids');
            showResult('reinstall', 'error', message);
        } finally {
            setRunning(null);
            setPending(null);
        }
    };

    // Confirm modal config keyed by the pending action. Lets us drive one
    // shared <Modal> instead of mounting a separate one per row.
    const confirmConfig = {
        reset: {
            title: __('Reset all settings?', 'fotogrids'),
            body: __('This clears every FotoGrids plugin setting and restores defaults. Your galleries, albums, statistics and Pro licence are not affected.', 'fotogrids'),
            actionLabel: __('Reset settings', 'fotogrids'),
            runningLabel: __('Resetting…', 'fotogrids'),
            requireText: CONFIRM_KEYWORD,
            handler: runResetOptions,
        },
        reinstall: {
            title: __('Reinstall database tables?', 'fotogrids'),
            body: __('This re-runs the FotoGrids schema migration to recreate any missing tables, columns or indexes. No rows are deleted.', 'fotogrids'),
            actionLabel: __('Reinstall tables', 'fotogrids'),
            runningLabel: __('Reinstalling…', 'fotogrids'),
            requireText: CONFIRM_KEYWORD,
            handler: runReinstallTables,
        },
    };

    const activeConfirm = pending ? confirmConfig[pending] : null;

    const [debugLoaded, setDebugLoaded] = useState(false);
    const [debugChannels, setDebugChannels] = useState([]);
    const [debugNote, setDebugNote] = useState('');
    const [debugNotice, setDebugNotice] = useState(null);
    const [wpDebug, setWpDebug] = useState(false);
    const [wpDebugLog, setWpDebugLog] = useState(false);
    const [savedEnabled, setSavedEnabled] = useState([]);
    const [enabled, setEnabled] = useState([]);
    const [debugSaving, setDebugSaving] = useState(false);
    const [debugStatus, setDebugStatus] = useState(null);

    // The GET and POST responses carry identical environment metadata.
    const applyDebugMeta = useCallback((data) => {
        setDebugNote(data?.note || '');
        setWpDebug(data?.wp_debug === true);
        setWpDebugLog(data?.wp_debug_log === true);
        setDebugNotice(data?.notice
            ? { title: data?.notice_title || '', description: data.notice }
            : null);
    }, []);

    useEffect(() => {
        let active = true;
        apiFetch({ path: '/fotogrids/v1/admin/maintenance/debug-channels' })
            .then((data) => {
                if (!active) return;
                const channels = Array.isArray(data?.channels) ? data.channels : [];
                const enabledSlugs = channels
                    .filter((channel) => channel.enabled === true)
                    .map((channel) => channel.slug);
                setDebugChannels(channels);
                applyDebugMeta(data);
                setSavedEnabled(enabledSlugs);
                setEnabled(enabledSlugs);
                setDebugLoaded(true);
            })
            .catch(() => {
                if (active) setDebugLoaded(true);
            });

        return () => { active = false; };
    }, [applyDebugMeta]);

    const debugDirty = useMemo(() => {
        // Compare as sorted sets so order changes don't show as dirty.
        const a = [...enabled].sort();
        const b = [...savedEnabled].sort();
        if (a.length !== b.length) return true;
        return a.some((slug, index) => slug !== b[index]);
    }, [enabled, savedEnabled]);

    const toggleChannel = (slug, nextValue) => {
        setDebugStatus(null);
        setEnabled((prev) => {
            if (nextValue) {
                if (prev.includes(slug)) return prev;
                return [...prev, slug];
            }
            return prev.filter((existing) => existing !== slug);
        });
    };

    const handleDebugSave = async () => {
        setDebugSaving(true);
        setDebugStatus(null);
        try {
            const data = await apiFetch({
                path: '/fotogrids/v1/admin/maintenance/debug-channels',
                method: 'POST',
                data: { channels: enabled },
            });
            const channels = Array.isArray(data?.channels) ? data.channels : [];
            const enabledSlugs = channels
                .filter((channel) => channel.enabled === true)
                .map((channel) => channel.slug);
            setDebugChannels(channels);
            applyDebugMeta(data);
            setSavedEnabled(enabledSlugs);
            setEnabled(enabledSlugs);
            setDebugStatus('saved');
            setTimeout(() => setDebugStatus((prev) => (prev === 'saved' ? null : prev)), 3000);
        } catch (_e) {
            setDebugStatus('error');
        } finally {
            setDebugSaving(false);
        }
    };

    const handleDebugDiscard = () => {
        setEnabled(savedEnabled);
        setDebugStatus(null);
    };

    return (
        <div className="fotogrids-sidebar-tabs__content__inner" key="maintenance-content">
            <SettingsPanel
                title={__('Maintenance', 'fotogrids')}
                description={__('Restore plugin settings and rebuild the database tables. These actions affect plugin-level state only - your galleries, albums and Pro licence are not touched.', 'fotogrids')}
            >
                <DangerZone
                    title={__('Reset all settings', 'fotogrids')}
                    description={__('Restores every Plugin Settings tab to defaults. Galleries, albums, statistics and your Pro licence are preserved.', 'fotogrids')}
                    icon="settings"
                >
                    <Button
                        variant="danger"
                        size="xs"
                        onClick={() => { setResult(null); setPending('reset'); }}
                        disabled={running !== null}
                        busy={running === 'reset'}
                    >
                        {running === 'reset' ? __('Resetting…', 'fotogrids') : __('Reset settings', 'fotogrids')}
                    </Button>
                </DangerZone>
                {result && result.kind === 'reset' && (
                    <div
                        className={`fotogrids-maintenance__feedback fotogrids-maintenance__feedback--${result.status}`}
                        role={result.status === 'error' ? 'alert' : 'status'}
                    >
                        {result.message}
                    </div>
                )}

                <DangerZone
                    title={__('Reinstall database tables', 'fotogrids')}
                    description={__('Re-runs the FotoGrids schema migration to add any missing tables, columns or indexes. Existing data is preserved.', 'fotogrids')}
                >
                    <Button
                        variant="danger"
                        size="xs"
                        onClick={() => { setResult(null); setPending('reinstall'); }}
                        disabled={running !== null}
                        busy={running === 'reinstall'}
                    >
                        {running === 'reinstall' ? __('Reinstalling…', 'fotogrids') : __('Reinstall tables', 'fotogrids')}
                    </Button>
                </DangerZone>
                {result && result.kind === 'reinstall' && (
                    <div
                        className={`fotogrids-maintenance__feedback fotogrids-maintenance__feedback--${result.status}`}
                        role={result.status === 'error' ? 'alert' : 'status'}
                    >
                        {result.message}
                    </div>
                )}
            </SettingsPanel>

            <SettingsPanel
                title={__('Debug Log', 'fotogrids')}
                description={__('Turn on only the channels you need - everything is off by default.', 'fotogrids')}
                action={debugLoaded && debugChannels.length > 0 && (
                    <div className="fotogrids-status-lights">
                        <StatusLight
                            label="WP_DEBUG"
                            state={wpDebug ? 'on' : 'off'}
                            stateLabel={wpDebug ? __('On', 'fotogrids') : __('Off', 'fotogrids')}
                        />
                        <StatusLight
                            label="WP_DEBUG_LOG"
                            state={wpDebug ? (wpDebugLog ? 'on' : 'off') : 'muted'}
                            stateLabel={!wpDebug
                                ? __('Not used', 'fotogrids')
                                : (wpDebugLog ? __('On', 'fotogrids') : __('Off', 'fotogrids'))}
                        />
                    </div>
                )}
            >
                {!debugLoaded && (
                    <PanelRow title={__('Loading channels…', 'fotogrids')} fullWidth>
                        <span aria-hidden="true" />
                    </PanelRow>
                )}

                {debugLoaded && debugChannels.length === 0 && (
                    <PanelRow title={__('No channels available.', 'fotogrids')} fullWidth>
                        <span aria-hidden="true" />
                    </PanelRow>
                )}

                {debugLoaded && debugChannels.map((channel) => {
                    const isForced = channel.forced_by_constant === true;
                    const checked = isForced ? channel.forced_value === true : enabled.includes(channel.slug);

                    let constantLine = channel.constant_name;
                    if (isForced && channel.forced_value === true) {
                        /* translators: %s: PHP constant name. */
                        constantLine = sprintf(__('Locked on by %s in wp-config.php', 'fotogrids'), channel.constant_name);
                    } else if (isForced) {
                        /* translators: %s: PHP constant name. */
                        constantLine = sprintf(__('Locked off by %s in wp-config.php', 'fotogrids'), channel.constant_name);
                    }

                    const description = (
                        <>
                            {channel.description}
                            <span className="fotogrids-debug-channel__constant">{constantLine}</span>
                        </>
                    );

                    return (
                        <PanelRow
                            key={channel.slug}
                            title={channel.label}
                            description={description}
                            htmlFor={`fotogrids_debug_channel_${channel.slug}`}
                        >
                            <Toggle
                                id={`fotogrids_debug_channel_${channel.slug}`}
                                checked={checked}
                                onChange={(value) => toggleChannel(channel.slug, value)}
                                disabled={isForced || !wpDebug}
                            />
                        </PanelRow>
                    );
                })}

                {debugLoaded && debugNotice && (
                    <InfoBlock
                        icon="alert_circle"
                        title={debugNotice.title}
                        description={debugNotice.description}
                    />
                )}

                {debugLoaded && debugNote && (
                    <InfoBlock
                        title={__('Note', 'fotogrids')}
                        description={debugNote}
                    />
                )}
            </SettingsPanel>

            <SaveBar
                dirty={debugDirty}
                saving={debugSaving}
                status={debugStatus}
                onSave={handleDebugSave}
                onDiscard={handleDebugDiscard}
            />

            <Confirm
                isOpen={pending !== null}
                onClose={closeModal}
                onConfirm={activeConfirm?.handler}
                variant="danger"
                title={activeConfirm?.title || ''}
                message={activeConfirm?.body || ''}
                confirmLabel={activeConfirm?.actionLabel}
                requireText={activeConfirm?.requireText || null}
                busy={running !== null}
            />
        </div>
    );
};

export default MaintenanceTab;
