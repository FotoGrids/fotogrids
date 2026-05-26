import React, { useEffect, useRef } from 'react';
import useLibraryStats from './useLibraryStats';
import Panel from '../shared/SidebarTabs/elements/Panel';
import LibraryStatCard from './LibraryStatCard';

const { __ } = wp.i18n;

const FG_BLUE        = '#3c46f0';
const FG_BLUE_SOFT   = 'rgba(60,70,240,0.08)';
const FG_GREEN       = '#46b450';
const FG_YELLOW      = '#ffb914';
const FG_RED         = '#f01e32';

const LibraryTagsHeader = ({ entityType, total: externalTotal }) => {
    const { topItems, total: fetchedTotal, loading } = useLibraryStats({
        entitySlug: entityType?.slug || 'tags',
        limit: 7,
    });

    // Use the total from parent (already loaded list) when available,
    // otherwise fall back to the fetched total.
    const total = externalTotal != null ? externalTotal : fetchedTotal;

    const barChartRef  = useRef(null);
    const donutRef     = useRef(null);
    const barInstance  = useRef(null);
    const donutInstance = useRef(null);

    useEffect(() => {
        if (loading || typeof Chart === 'undefined' || topItems.length === 0) return;

        const maxUsage = topItems[0]?.usage_count || 1;

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
            const high = topItems.filter((i) => i.usage_count >= 50).length;
            const mid  = topItems.filter((i) => i.usage_count >= 10 && i.usage_count < 50).length;
            const low  = topItems.filter((i) => i.usage_count >= 1  && i.usage_count < 10).length;
            const unused = topItems.filter((i) => i.usage_count === 0).length;

            if (donutInstance.current) { donutInstance.current.destroy(); }
            donutInstance.current = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: [
                        __('High', 'fotogrids'),
                        __('Mid', 'fotogrids'),
                        __('Low', 'fotogrids'),
                        __('Unused', 'fotogrids'),
                    ],
                    datasets: [{
                        data: [high || 1, mid || 1, low || 1, unused || 0],
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

    const unusedInTop = topItems.filter((i) => i.usage_count === 0).length;

    return (
        <Panel bare className="fg-lib-header">
            <div className="fg-lib-header__grid fg-lib-header__grid--tags">

                <LibraryStatCard
                    label={__('Total Tags', 'fotogrids')}
                    value={loading ? '-' : total.toLocaleString()}
                />

                <LibraryStatCard
                    label={__('Tag Uses', 'fotogrids')}
                    value={loading ? '-' : topItems.reduce((s, i) => s + (i.usage_count || 0), 0).toLocaleString()}
                    sub={__('across top tags', 'fotogrids')}
                />

                <LibraryStatCard
                    label={__('Unused Tags', 'fotogrids')}
                    value={loading ? '-' : unusedInTop}
                    sub={__('in visible list', 'fotogrids')}
                    variant="warning"
                />

                <div className="fg-lib-chart-panel fg-lib-chart-panel--span2">
                    <div className="fg-lib-chart-panel__title">{__('Top Tags by Usage', 'fotogrids')}</div>
                    <div className="fg-lib-chart-panel__body">
                        {loading
                            ? <div className="fg-lib-chart-loading">…</div>
                            : <canvas ref={barChartRef} />
                        }
                    </div>
                </div>

                <div className="fg-lib-chart-panel">
                    <div className="fg-lib-chart-panel__title">{__('Usage Distribution', 'fotogrids')}</div>
                    <div className="fg-lib-chart-panel__body fg-lib-chart-panel__body--donut">
                        {loading
                            ? <div className="fg-lib-chart-loading">…</div>
                            : <canvas ref={donutRef} />
                        }
                    </div>
                </div>

            </div>
        </Panel>
    );
};

export default LibraryTagsHeader;
