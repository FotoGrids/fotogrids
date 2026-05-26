/**
 * Overview Statistics Component - Dashboard
 */
import React from 'react';
import StatCard from '../shared/StatCard';

const { __ } = wp.i18n;

const fmt = ( n ) => ( typeof n === 'number' ? n.toLocaleString() : n );

const OverviewStats = ( { stats, loading } ) => {
    return (
        <div className="fotogrids-overview">
            <h2>{ __( 'Overview', 'fotogrids' ) }</h2>
            <div className="fg-stats-cards">
                <StatCard
                    value={ fmt( stats.galleries ) }
                    label={ __( 'Galleries', 'fotogrids' ) }
                    accent="blue"
                    loading={ loading }
                />
                <StatCard
                    value={ fmt( stats.albums ) }
                    label={ __( 'Albums', 'fotogrids' ) }
                    accent="red"
                    loading={ loading }
                />
                <StatCard
                    value={ fmt( stats.items ) }
                    label={ __( 'Items', 'fotogrids' ) }
                    accent="yellow"
                    loading={ loading }
                />
                <StatCard
                    value={ fmt( stats.views ) }
                    label={ __( 'Total Views', 'fotogrids' ) }
                    accent="grey"
                    loading={ loading }
                />
            </div>
        </div>
    );
};

export default OverviewStats;
