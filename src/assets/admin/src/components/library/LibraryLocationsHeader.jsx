import React, { useEffect, useRef } from 'react';
import useLibraryStats from './useLibraryStats';
import Panel from '../shared/SidebarTabs/elements/Panel';
import LibraryStatCard from './LibraryStatCard';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

const FG_BLUE      = '#3c46f0';
const FG_BLUE_SOFT = 'rgba(60,70,240,0.08)';
const FG_GREEN     = '#46b450';
const FG_YELLOW    = '#ffb914';
const FG_RED       = '#f01e32';

/**
 * Locations tab header - stat cards + 3-col × 2-row chart grid.
 *
 * Row 1: [Total Locations] [With Coordinates] [Unused]
 * Row 2: [Top Locations bar - spans 2 cols] [Geo scatter SVG]
 *
 * The geo scatter is a lightweight SVG dot-map built from the latitude/longitude
 * stored on each location record. No tile map required - just a Mercator-ish
 * projection onto a world bounding box. Precise accuracy is not the goal; it
 * gives an instant at-a-glance sense of where items are clustered.
 */
const LibraryLocationsHeader = ({ entityType, total: externalTotal }) => {
    const { topItems, total: fetchedTotal, loading } = useLibraryStats({
        entitySlug: entityType?.slug || 'locations',
        limit: 7,
    });

    const total = externalTotal != null ? externalTotal : fetchedTotal;

    const barChartRef  = useRef(null);
    const barInstance  = useRef(null);

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

        return () => { barInstance.current?.destroy(); };
    }, [loading, topItems]);

    const withCoords = topItems.filter((i) => i.latitude != null && i.longitude != null).length;
    const unusedCount = topItems.filter((i) => i.usage_count === 0).length;

    // Build SVG dots from lat/lng using a simple equirectangular projection
    // onto a 300 × 150 viewBox (roughly 2:1 like a world map).
    const dots = topItems
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => {
            // Equirectangular: x = (lng + 180) / 360 * W, y = (90 - lat) / 180 * H
            const x = ((parseFloat(i.longitude) + 180) / 360) * 300;
            const y = ((90 - parseFloat(i.latitude)) / 180) * 150;
            const r = Math.max(3, Math.min(7, 3 + Math.sqrt(i.usage_count || 0)));
            return { x, y, r, name: i.name, count: i.usage_count };
        });

    return (
        <Panel bare className="fg-lib-header">
            <div className="fg-lib-header__grid fg-lib-header__grid--locations">

                <LibraryStatCard
                    label={__('Total Locations', 'fotogrids')}
                    value={loading ? '-' : total.toLocaleString()}
                />

                <LibraryStatCard
                    label={__('With Coordinates', 'fotogrids')}
                    value={loading ? '-' : withCoords.toLocaleString()}
                    sub={__('geo-mapped', 'fotogrids')}
                    variant="positive"
                />

                <LibraryStatCard
                    label={__('Unused', 'fotogrids')}
                    value={loading ? '-' : unusedCount.toLocaleString()}
                    sub={__('no tagged items', 'fotogrids')}
                    variant="warning"
                />

                <div className="fg-lib-chart-panel fg-lib-chart-panel--span2">
                    <div className="fg-lib-chart-panel__title">{__('Top Locations by Usage', 'fotogrids')}</div>
                    <div className="fg-lib-chart-panel__body">
                        {loading
                            ? <div className="fg-lib-chart-loading">…</div>
                            : <canvas ref={barChartRef} />
                        }
                    </div>
                </div>

                <div className="fg-lib-chart-panel">
                    <div className="fg-lib-chart-panel__title">{__('Geo Coverage', 'fotogrids')}</div>
                    <div className="fg-lib-chart-panel__body fg-lib-chart-panel__body--map">
                        {loading ? (
                            <div className="fg-lib-geo-loading">…</div>
                        ) : dots.length > 0 ? (
                            <svg
                                viewBox="0 0 300 150"
                                xmlns="http://www.w3.org/2000/svg"
                                className="fg-lib-geo-svg"
                                aria-label={__('World map showing location dots', 'fotogrids')}
                            >
                                {[30, 60, 90, 120].map((y) => (
                                    <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="currentColor" strokeWidth="0.5" />
                                ))}
                                {[75, 150, 225].map((x) => (
                                    <line key={x} x1={x} y1="0" x2={x} y2="150" stroke="currentColor" strokeWidth="0.5" />
                                ))}
                                {dots.map((d, idx) => (
                                    <g key={idx}>
                                        <circle cx={d.x} cy={d.y} r={d.r + 3} fill="currentColor" opacity="0.08" />
                                        <circle cx={d.x} cy={d.y} r={d.r} fill="currentColor" opacity="0.75" />
                                        <title>{`${d.name} (${d.count} items)`}</title>
                                    </g>
                                ))}
                            </svg>
                        ) : (
                            <div className="fg-lib-geo-empty">
                                <Icon name="location" className="fg-lib-geo-empty__icon" />
                                <span>{__('No coordinates stored yet', 'fotogrids')}</span>
                            </div>
                        )}
                    </div>

                    {!isProActive && (
                        <div className="fg-lib-pro-nudge">
                            <span className="fotogrids-pro-badge">{__('Pro', 'fotogrids')}</span>
                            <span className="fg-lib-pro-nudge__text">
                                <strong>{__('Interactive Map View', 'fotogrids')}</strong>
                                {__('With smart EXIF locations', 'fotogrids')}
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

export default LibraryLocationsHeader;
