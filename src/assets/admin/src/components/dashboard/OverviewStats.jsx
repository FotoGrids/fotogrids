/**
 * Overview Statistics Component - Dashboard
 */
import React from 'react';
import StatCard from '../shared/StatCard';

const { __ } = wp.i18n;

const fmt = ( n ) => ( typeof n === 'number' ? n.toLocaleString() : n );
const STATS_PAGE_URL = 'admin.php?page=fotogrids-stats';
const OVERVIEW_CARDS = [
    { key: 'galleries', iconName: 'layout_3x3', label: __( 'Galleries', 'fotogrids' ), accent: 'blue' },
    { key: 'albums', iconName: 'layout_2x2', label: __( 'Albums', 'fotogrids' ), accent: 'red' },
    { key: 'items', iconName: 'image', label: __( 'Items', 'fotogrids' ), accent: 'yellow' },
    { key: 'views', iconName: 'eye', label: __( 'Total Views', 'fotogrids' ), accent: 'grey' },
    { key: 'shares', iconName: 'click', label: __( 'Total Interactions', 'fotogrids' ), accent: 'green' },
];

const OverviewStats = ( { stats, loading } ) => {
    return (
        <div className="fotogrids-overview">
            <h2>{ __( 'Overview', 'fotogrids' ) }</h2>
            <div className="fg-stats-cards">
                { OVERVIEW_CARDS.map( ( card ) => (
                    <StatCard
                        key={ card.key }
                        iconName={ card.iconName }
                        value={ fmt( stats[ card.key ] ) }
                        label={ card.label }
                        accent={ card.accent }
                        invert
                        loading={ loading }
                        href={ STATS_PAGE_URL }
                    />
                ) ) }
            </div>
        </div>
    );
};

export default OverviewStats;
