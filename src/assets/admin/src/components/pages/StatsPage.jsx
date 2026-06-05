/**
 * Statistics Page Component
 */
import React, { useState, useEffect, useRef } from 'react';
import StatCard from '../shared/StatCard';
import StatsTable from '../shared/StatsTable';
import Icon from '../shared/Icon';
import { Button } from '../shared/Button';

const { __ } = wp.i18n;

const fmt = ( n ) => ( typeof n === 'number' ? n.toLocaleString() : n );

const TypeBadge = ( { type } ) => {
    const baseClass = 'fg-type-badge';

    return (
        <span className={ `${baseClass} ${baseClass}--${ type }` }>
            <span>{ type }</span>
        </span>
    );
};

const TitleCell = ( { title, editUrl } ) =>
    editUrl ? (
        <a className="fg-stats-title-link" href={ editUrl }>{ title }</a>
    ) : (
        <strong>{ title }</strong>
    );

const PERIODS = [
    { days: 7,  label: __( '7 Days',  'fotogrids' ) },
    { days: 30, label: __( '30 Days', 'fotogrids' ) },
    { days: 90, label: __( '90 Days', 'fotogrids' ) },
];

const recentActivityColumns = [
    {
        key: 'title',
        label: __( 'Name', 'fotogrids' ),
        ellipsis: true,
        render: ( val, row ) => <TitleCell title={ val } editUrl={ row.edit_url } />,
    },
    {
        key: 'type',
        label: __( 'Type', 'fotogrids' ),
        align: 'center',
        render: ( val ) => <TypeBadge type={ val } />,
    },
    { key: 'views',       label: __( 'Views',       'fotogrids' ), align: 'center', render: fmt },
    { key: 'last_viewed', label: __( 'Last Viewed', 'fotogrids' ), align: 'center' },
];

const topContentColumns = [
    {
        key: 'title',
        label: __( 'Name', 'fotogrids' ),
        ellipsis: true,
        render: ( val, row ) => <TitleCell title={ val } editUrl={ row.edit_url } />,
    },
    {
        key: 'type',
        label: __( 'Type', 'fotogrids' ),
        align: 'center',
        render: ( val ) => <TypeBadge type={ val } />,
    },
    { key: 'views',  label: __( 'Views',  'fotogrids' ), align: 'center', render: fmt },
    { key: 'shares', label: __( 'Shares', 'fotogrids' ), align: 'center', render: fmt },
];

const defaultOverview = { galleries: 0, albums: 0, items: 0, views: 0, shares: 0 };
const OVERVIEW_CARDS = [
    { key: 'galleries', iconName: 'layout_3x3', label: __( 'Total Galleries', 'fotogrids' ), accent: 'blue' },
    { key: 'albums', iconName: 'layout_2x2', label: __( 'Total Albums', 'fotogrids' ), accent: 'red' },
    { key: 'items', iconName: 'image', label: __( 'Total Items', 'fotogrids' ), accent: 'yellow' },
    { key: 'views', iconName: 'eye', label: __( 'Total Views', 'fotogrids' ), accent: 'grey' },
    { key: 'shares', iconName: 'click', label: __( 'Total Interactions', 'fotogrids' ), accent: 'green' },
];

const StatsPage = () => {
    const [ overview,         setOverview         ] = useState( defaultOverview );
    const [ viewsData,        setViewsData        ] = useState( { labels: [], data: [] } );
    const [ popularGalleries, setPopularGalleries ] = useState( { labels: [], data: [] } );
    const [ recentActivity,   setRecentActivity   ] = useState( [] );
    const [ topContent,       setTopContent       ] = useState( [] );
    const [ selectedPeriod,   setSelectedPeriod   ] = useState( 7 );
    const [ loading,          setLoading          ] = useState( true );
    const [ error,            setError            ] = useState( null );
    const [ refreshToken,     setRefreshToken     ] = useState( 0 );

    // Canvas nodes are always in the DOM - we use a CSS overlay for the loading
    // skeleton so refs are valid from first mount and never need to be re-created.
    const viewsChartRef    = useRef( null );
    const popularChartRef  = useRef( null );
    const viewsChartInst   = useRef( null );
    const popularChartInst = useRef( null );

    // ── destroy charts on unmount only ───────────────────────────────────────
    useEffect( () => {
        return () => {
            viewsChartInst.current?.destroy();
            popularChartInst.current?.destroy();
            viewsChartInst.current   = null;
            popularChartInst.current = null;
        };
    }, [] );

    // ── views chart: create on first data arrival, update on subsequent ──────
    // Depends on `loading` so it fires as soon as the load cycle completes.
    useEffect( () => {
        if ( loading ) return;
        if ( typeof Chart === 'undefined' ) {
            console.error( 'FotoGrids Stats: Chart.js is not available' );
            return;
        }
        if ( ! viewsChartRef.current ) return;

        if ( ! viewsChartInst.current ) {
            viewsChartInst.current = new Chart( viewsChartRef.current, {
                type: 'line',
                data: {
                    labels: viewsData.labels,
                    datasets: [ {
                        label: __( 'Views', 'fotogrids' ),
                        data: viewsData.data,
                        borderColor: '#3c46f0',
                        backgroundColor: 'rgba(60, 70, 240, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#3c46f0',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                    } ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                },
            } );
        } else {
            viewsChartInst.current.data.labels             = viewsData.labels;
            viewsChartInst.current.data.datasets[ 0 ].data = viewsData.data;
            viewsChartInst.current.update();
        }
    }, [ loading, viewsData ] );

    // ── popular galleries chart: same pattern ────────────────────────────────
    useEffect( () => {
        if ( loading ) return;
        if ( typeof Chart === 'undefined' ) return;
        if ( ! popularChartRef.current ) return;
        // No data → canvas is hidden, nothing to draw.
        if ( popularGalleries.data.length === 0 ) return;

        if ( ! popularChartInst.current ) {
            popularChartInst.current = new Chart( popularChartRef.current, {
                type: 'doughnut',
                data: {
                    labels: popularGalleries.labels,
                    datasets: [ {
                        data: popularGalleries.data,
                        backgroundColor: [ '#3c46f0', '#5865f2', '#4f5af3', '#2d35c7', '#f01e32' ],
                        borderWidth: 0,
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#ffffff',
                    } ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                },
            } );
        } else {
            popularChartInst.current.data.labels             = popularGalleries.labels;
            popularChartInst.current.data.datasets[ 0 ].data = popularGalleries.data;
            popularChartInst.current.update();
        }
    }, [ loading, popularGalleries ] );

    // ── load all stats in one coordinated batch ───────────────────────────────
    useEffect( () => {
        let cancelled = false;

        const load = async () => {
            setLoading( true );
            setError( null );

            // Destroy existing chart instances before re-creating with new data.
            viewsChartInst.current?.destroy();
            popularChartInst.current?.destroy();
            viewsChartInst.current   = null;
            popularChartInst.current = null;

            try {
                const [
                    overviewRes,
                    viewsRes,
                    popularRes,
                    activityRes,
                    topRes,
                ] = await Promise.all( [
                    wp.apiFetch( { path: 'fotogrids/v1/admin/stats/overview' } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/views?days=${ selectedPeriod }` } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/popular-galleries?days=${ selectedPeriod }` } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/recent-activity?days=${ selectedPeriod }` } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/top-content?days=${ selectedPeriod }` } ),
                ] );

                if ( cancelled ) return;

                setOverview( {
                    galleries: overviewRes?.galleries ?? 0,
                    albums:    overviewRes?.albums    ?? 0,
                    items:     overviewRes?.items     ?? 0,
                    views:     overviewRes?.views     ?? 0,
                    shares:    overviewRes?.shares    ?? 0,
                } );
                setViewsData( { labels: viewsRes?.labels ?? [], data: viewsRes?.data ?? [] } );
                setPopularGalleries( { labels: popularRes?.labels ?? [], data: popularRes?.data ?? [] } );
                setRecentActivity( Array.isArray( activityRes ) ? activityRes : [] );
                setTopContent( Array.isArray( topRes ) ? topRes : [] );

            } catch ( err ) {
                if ( ! cancelled ) {
                    console.error( 'FotoGrids Stats: failed to load stats', err );
                    setError( __( 'Could not load statistics. Please refresh the page.', 'fotogrids' ) );
                }
            } finally {
                if ( ! cancelled ) setLoading( false );
            }
        };

        load();
        return () => { cancelled = true; };
    }, [ selectedPeriod, refreshToken ] );

    const isEmpty = ! loading && ! error
        && overview.views     === 0
        && overview.galleries === 0;

    return (
        <div className="fg-stats-dashboard">

            {/* Toolbar */}
            <div className="fg-stats-toolbar">
                <div className="fg-stats-period" role="group" aria-label={ __( 'Time period', 'fotogrids' ) }>
                    { PERIODS.map( ( p ) => (
                        <Button
                            key={ p.days }
                            variant={ selectedPeriod === p.days ? 'primary' : 'secondary' }
                            onClick={ () => setSelectedPeriod( p.days ) }
                            aria-pressed={ selectedPeriod === p.days }
                        >
                            { p.label }
                        </Button>
                    ) ) }
                </div>

                <Button
                    variant="secondary"
                    icon="refresh_cv"
                    onClick={ () => setRefreshToken( ( t ) => t + 1 ) }
                    disabled={ loading }
                    busy={ loading }
                    ariaLabel={ __( 'Refresh stats', 'fotogrids' ) }
                >
                    { __( 'Refresh', 'fotogrids' ) }
                </Button>
            </div>

            { error && (
                <div className="fg-stats-error" role="alert">{ error }</div>
            ) }

            { isEmpty && (
                <div className="fg-stats-empty">
                    <Icon name="chart_bar" className="fg-stats-empty__icon" />
                    <h3 className="fg-stats-empty__heading">
                        { __( 'No statistics yet', 'fotogrids' ) }
                    </h3>
                    <p className="fg-stats-empty__body">
                        { __( 'Your gallery stats will appear here once visitors start viewing your galleries.', 'fotogrids' ) }
                    </p>
                </div>
            ) }

            <div className="fg-stats-cards">
                { OVERVIEW_CARDS.map( ( card ) => (
                    <StatCard
                        key={ card.key }
                        iconName={ card.iconName }
                        value={ fmt( overview[ card.key ] ) }
                        label={ card.label }
                        accent={ card.accent }
                        loading={ loading }
                    />
                ) ) }
            </div>

            <div className="fg-stats-charts">
                <div className={ `fg-stats-card fg-chart-container${ loading ? ' fg-is-loading' : '' }` }>
                    <div className="fg-chart-header">
                        <h3 className="fg-chart-header__title">
                            { __( 'Views Over Time', 'fotogrids' ) }
                        </h3>
                    </div>
                    <div className="fg-chart-body">
                        { loading && <div className="fg-chart-skeleton" aria-hidden="true" /> }
                        <canvas ref={ viewsChartRef } className="fg-chart-canvas" />
                    </div>
                </div>

                <div className={ `fg-stats-card fg-chart-container${ loading ? ' fg-is-loading' : '' }` }>
                    <div className="fg-chart-header">
                        <h3 className="fg-chart-header__title">
                            { __( 'Most Popular Galleries', 'fotogrids' ) }
                        </h3>
                    </div>
                    <div className="fg-chart-body">
                        { loading && <div className="fg-chart-skeleton" aria-hidden="true" /> }
                        { ! loading && popularGalleries.data.length === 0 && (
                            <p className="fg-chart-empty">
                                { __( 'No gallery views in this period.', 'fotogrids' ) }
                            </p>
                        ) }
                        <canvas
                            ref={ popularChartRef }
                            className="fg-chart-canvas"
                            style={ { display: ! loading && popularGalleries.data.length === 0 ? 'none' : '' } }
                        />
                    </div>
                </div>
            </div>

            <div className="fg-stats-tables">
                <StatsTable
                    title={ __( 'Recent Activity', 'fotogrids' ) }
                    columns={ recentActivityColumns }
                    rows={ recentActivity }
                    loading={ loading }
                    emptyMsg={ __( 'No recent activity in this period.', 'fotogrids' ) }
                />
                <StatsTable
                    title={ __( 'Top Performing Content', 'fotogrids' ) }
                    columns={ topContentColumns }
                    rows={ topContent }
                    loading={ loading }
                    emptyMsg={ __( 'No data available for this period.', 'fotogrids' ) }
                />
            </div>
        </div>
    );
};

export default StatsPage;
