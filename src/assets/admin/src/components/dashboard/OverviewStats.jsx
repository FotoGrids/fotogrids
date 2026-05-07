/**
 * Overview Statistics Component
 */
import React from 'react';

const { __ } = wp.i18n;

const OverviewStats = ({ stats, loading }) => {
    return (
        <div className="fotogrids-overview">
            <h2>{__('Overview', 'fotogrids')}</h2>
            <div className="fotogrids-stats-grid">
                <div className="fotogrids-stat-card">
                    <div className="stat-number">
                        {loading ? '...' : stats.galleries.toLocaleString()}
                    </div>
                    <div className="stat-label">{__('Galleries', 'fotogrids')}</div>
                </div>
                <div className="fotogrids-stat-card">
                    <div className="stat-number">
                        {loading ? '...' : stats.albums.toLocaleString()}
                    </div>
                    <div className="stat-label">{__('Albums', 'fotogrids')}</div>
                </div>
                <div className="fotogrids-stat-card">
                    <div className="stat-number">
                        {loading ? '...' : stats.items.toLocaleString()}
                    </div>
                    <div className="stat-label">{__('Items', 'fotogrids')}</div>
                </div>
                <div className="fotogrids-stat-card">
                    <div className="stat-number">
                        {loading ? '...' : stats.views.toLocaleString()}
                    </div>
                    <div className="stat-label">{__('Total Views', 'fotogrids')}</div>
                </div>
            </div>
        </div>
    );
};

export default OverviewStats;

