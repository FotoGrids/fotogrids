import React, { useEffect, useRef } from 'react';
import useLibraryStats from './useLibraryStats';
import Panel from '../shared/SidebarTabs/elements/Panel';
import LibraryStatCard from './LibraryStatCard';

const { __ } = wp.i18n;

const FG_BLUE       = '#3c46f0';
const FG_BLUE_SOFT  = 'rgba(60,70,240,0.08)';
const FG_GREEN      = '#46b450';
const FG_YELLOW     = '#ffb914';
const FG_RED        = '#f01e32';

/**
 * People tab header - stat cards + 3-col × 2-row chart grid.
 *
 * Row 1: [Total People card] [In Galleries card] [Unused card]
 * Row 2: [Most-tagged People bar - spans 2 cols] [Frequency donut]
 *
 * "In Galleries" = number of distinct gallery_ids among topItems where
 * usage_count > 0. We don't have per-person gallery-count from the REST
 * list endpoint, so we show the count of people that appear in at least one
 * item as a proxy (usage_count > 0) and label it clearly.
 */
const LibraryPeopleHeader = ({ entityType, total: externalTotal }) => {
    const { topItems, total: fetchedTotal, loading } = useLibraryStats({
        entitySlug: entityType?.slug || 'people',
        limit: 7,
    });

    const total = externalTotal != null ? externalTotal : fetchedTotal;

    const barChartRef   = useRef(null);
    const donutRef      = useRef(null);
    const barInstance   = useRef(null);
    const donutInstance = useRef(null);

    const isProActive = Boolean(window.fotogridsSettings?.isProActive);

    useEffect(() => {
        if (loading || typeof Chart === 'undefined' || topItems.length === 0) return;

        const barCtx = barChartRef.current;
        if (barCtx) {
            if (barInstance.current) { barInstance.current.destroy(); }
            barInstance.current = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: topItems.map((i) => i.name),
                    datasets: [{
                        data: topItems.map((i) => i.usage_count),
                        backgroundColor: FG_BLUE_SOFT,
                        borderColor: FG_BLUE,
                        borderWidth: 1.5,
                        borderRadius: 4,
                        hoverBackgroundColor: FG_BLUE,
                        hoverBorderColor: FG_BLUE,
                    }],
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` ${ctx.raw} item${ctx.raw !== 1 ? 's' : ''}`,
                            },
                        },
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { precision: 0, font: { size: 11 } },
                            grid: { color: 'rgba(0,0,0,0.04)' },
                        },
                        y: {
                            ticks: {
                                font: { size: 11 },
                                maxRotation: 0,
                                callback: (val, idx) => {
                                    const name = topItems[idx]?.name || '';
                                    return name.length > 14 ? name.slice(0, 13) + '…' : name;
                                },
                            },
                            grid: { display: false },
                        },
                    },
                },
            });
        }

        const donutCtx = donutRef.current;
        if (donutCtx) {
            const active     = topItems.filter((i) => i.usage_count >= 20).length;
            const regular    = topItems.filter((i) => i.usage_count >= 5 && i.usage_count < 20).length;
            const occasional = topItems.filter((i) => i.usage_count >= 1 && i.usage_count < 5).length;
            const unused     = topItems.filter((i) => i.usage_count === 0).length;

            if (donutInstance.current) { donutInstance.current.destroy(); }
            donutInstance.current = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: [
                        __('Active', 'fotogrids'),
                        __('Regular', 'fotogrids'),
                        __('Occasional', 'fotogrids'),
                        __('Unused', 'fotogrids'),
                    ],
                    datasets: [{
                        data: [active || 1, regular || 1, occasional || 1, unused || 0],
                        backgroundColor: [FG_BLUE, FG_GREEN, FG_YELLOW, FG_RED],
                        borderWidth: 0,
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#fff',
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '64%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { font: { size: 11 }, padding: 10, boxWidth: 10 },
                        },
                    },
                },
            });
        }

        return () => {
            barInstance.current?.destroy();
            donutInstance.current?.destroy();
        };
    }, [loading, topItems]);

    const activeCount = topItems.filter((i) => i.usage_count > 0).length;
    const unusedCount = topItems.filter((i) => i.usage_count === 0).length;

    return (
        <Panel bare className="fg-lib-header">
            <div className="fg-lib-header__grid fg-lib-header__grid--people">

                <LibraryStatCard
                    label={__('Total People', 'fotogrids')}
                    value={loading ? '-' : total.toLocaleString()}
                />

                <LibraryStatCard
                    label={__('In Galleries', 'fotogrids')}
                    value={loading ? '-' : activeCount.toLocaleString()}
                    sub={__('have tagged items', 'fotogrids')}
                />

                <LibraryStatCard
                    label={__('Unused', 'fotogrids')}
                    value={loading ? '-' : unusedCount.toLocaleString()}
                    sub={__('in visible list', 'fotogrids')}
                    variant="warning"
                />

                <div className="fg-lib-chart-panel fg-lib-chart-panel--span2">
                    <div className="fg-lib-chart-panel__title">{__('Most-tagged People', 'fotogrids')}</div>
                    <div className="fg-lib-chart-panel__body">
                        {loading
                            ? <div className="fg-lib-chart-loading">…</div>
                            : <canvas ref={barChartRef} />
                        }
                    </div>
                </div>

                <div className="fg-lib-chart-panel">
                    <div className="fg-lib-chart-panel__title">{__('Tag Frequency', 'fotogrids')}</div>
                    <div className="fg-lib-chart-panel__body fg-lib-chart-panel__body--donut">
                        {loading
                            ? <div className="fg-lib-chart-loading">…</div>
                            : <canvas ref={donutRef} />
                        }
                    </div>

                    {!isProActive && (
                        <div className="fg-lib-pro-nudge">
                            <span className="fotogrids-pro-badge">{__('Pro', 'fotogrids')}</span>
                            <span className="fg-lib-pro-nudge__text">
                                <strong>{__('AI Facial Recognition', 'fotogrids')}</strong>
                                {__('Auto-detect people in images', 'fotogrids')}
                            </span>
                            <button
                                type="button"
                                className="fotogrids-button fotogrids-button--secondary fotogrids-button--small"
                                onClick={() => {
                                    if (window.FotoGridsUpgrade) { window.FotoGridsUpgrade.launch(); }
                                    else if (window.fotogridsUpgradeModal?.urls?.upgrade) {
                                        window.open(window.fotogridsUpgradeModal.urls.upgrade, '_blank');
                                    }
                                }}
                            >
                                {__('Learn more', 'fotogrids')}
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </Panel>
    );
};

export default LibraryPeopleHeader;
