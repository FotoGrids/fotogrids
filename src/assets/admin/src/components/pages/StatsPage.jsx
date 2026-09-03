/**
 * Statistics Page Component
 */
import React, { useState, useEffect, useRef } from 'react';
import StatCard from '../shared/StatCard';
import StatsTable from '../shared/StatsTable';
import Icon from '../shared/Icon';
import { Button } from '../shared/Button';

const { __, sprintf } = wp.i18n;

const fmt = ( n ) => ( typeof n === 'number' ? n.toLocaleString() : n );

/**
 * Format a share of the period total as a compact percentage.
 *
 * A share below one percent renders as "<1%" rather than rounding to zero, so
 * a row with real but small traffic is not reported as having none.
 *
 * @param {number} share Percentage of the period total.
 * @returns {string} Display string.
 */
const fmtShare = ( share ) => (
    share > 0 && share < 1 ? __( '<1%', 'fotogrids' ) : `${ Math.round( share ) }%`
);

const TypeBadge = ( { type } ) => {
    const baseClass = 'fg-type-badge';

    return (
        <span className={ `${baseClass} ${baseClass}--${ type }` }>
            <span>{ type }</span>
        </span>
    );
};

const UNTITLED_LABELS = {
    gallery: __( 'Untitled Gallery', 'fotogrids' ),
    album:   __( 'Untitled Album',   'fotogrids' ),
    item:    __( 'Untitled Item',    'fotogrids' ),
};

/**
 * Build the placeholder shown in place of an empty object title.
 *
 * @param {string} type Object type (gallery, album, item).
 * @param {number} id   Object ID.
 * @returns {string} Placeholder label, e.g. "Untitled Gallery #123".
 */
const untitledLabel = ( type, id ) => {
    const base = UNTITLED_LABELS[ type ] || __( 'Untitled', 'fotogrids' );
    return id ? `${ base } #${ id }` : base;
};

const UntitledTitle = ( { type, id } ) => (
    <>
        <span className="fg-stats-untitled">
            { UNTITLED_LABELS[ type ] || __( 'Untitled', 'fotogrids' ) }
        </span>
        { id ? ` #${ id }` : '' }
    </>
);

const TitleCell = ( { title, row } ) => {
    const label = typeof title === 'string' && title.trim()
        ? title
        : <UntitledTitle type={ row.type } id={ row.id } />;

    return row.edit_url ? (
        <a className="fg-stats-title-link" href={ row.edit_url }>{ label }</a>
    ) : (
        <strong>{ label }</strong>
    );
};

const PERIODS = [
    { days: 7,  label: __( '7 Days',  'fotogrids' ) },
    { days: 30, label: __( '30 Days', 'fotogrids' ) },
    { days: 90, label: __( '90 Days', 'fotogrids' ) },
];

const PERIOD_PARAM   = 'fg_stats_period';
const DEFAULT_PERIOD = 7;

/**
 * Read the selected period from the page URL, falling back to the default.
 *
 * @returns {number} Period length in days.
 */
const readPeriodParam = () => {
    try {
        const days = parseInt(
            new URLSearchParams( window.location.search ).get( PERIOD_PARAM ),
            10
        );
        return PERIODS.some( ( p ) => p.days === days ) ? days : DEFAULT_PERIOD;
    } catch ( _e ) {
        return DEFAULT_PERIOD;
    }
};

/**
 * Persist the selected period to the page URL so a reload restores it.
 *
 * Uses replaceState so switching a filter does not add a history entry.
 *
 * @param {number} days Period length in days.
 */
const writePeriodParam = ( days ) => {
    try {
        const url = new URL( window.location.href );
        url.searchParams.set( PERIOD_PARAM, String( days ) );
        window.history.replaceState( {}, '', url.toString() );
    } catch ( _e ) {}
};

// Ranked slices run dark to light so colour tracks position in the top five.
const POPULAR_COLORS      = [ '#2d35c7', '#3c46f0', '#5865f2', '#8b93f7', '#b9befb' ];
const POPULAR_OTHER_COLOR = '#d5d8e5';
const POPULAR_MAX_SLICES  = 5;

/**
 * Reduce a ranked gallery list to at most five slices plus an "Other" remainder.
 *
 * @param {string[]} labels Gallery titles, ranked by views descending.
 * @param {number[]} data   View counts aligned to labels.
 * @param {number}   total  View count across every gallery in the period.
 * @returns {{labels: string[], data: number[], colors: string[]}} Chart-ready slices.
 */
const buildPopularSlices = ( labels, data, total ) => {
    const sliceLabels = labels.slice( 0, POPULAR_MAX_SLICES );
    const sliceData   = data.slice( 0, POPULAR_MAX_SLICES );
    const colors      = sliceLabels.map( ( _label, i ) => POPULAR_COLORS[ i ] );

    const counted   = sliceData.reduce( ( sum, n ) => sum + n, 0 );
    const remainder = Math.max( 0, ( total || counted ) - counted );

    if ( remainder > 0 ) {
        sliceLabels.push( __( 'Other galleries', 'fotogrids' ) );
        sliceData.push( remainder );
        colors.push( POPULAR_OTHER_COLOR );
    }

    return { labels: sliceLabels, data: sliceData, colors };
};

const recentlyViewedColumns = [
    {
        key: 'title',
        label: __( 'Name', 'fotogrids' ),
        ellipsis: true,
        render: ( val, row ) => <TitleCell title={ val } row={ row } />,
    },
    {
        key: 'type',
        label: __( 'Type', 'fotogrids' ),
        align: 'center',
        render: ( val ) => <TypeBadge type={ val } />,
    },
    { key: 'views',       label: __( 'Views',       'fotogrids' ), align: 'center', render: fmt, sortable: true },
    { key: 'last_viewed', label: __( 'Last Viewed', 'fotogrids' ), align: 'center', sortable: true },
];

const topContentColumns = [
    {
        key: 'title',
        label: __( 'Name', 'fotogrids' ),
        ellipsis: true,
        render: ( val, row ) => <TitleCell title={ val } row={ row } />,
    },
    {
        key: 'type',
        label: __( 'Type', 'fotogrids' ),
        align: 'center',
        render: ( val ) => <TypeBadge type={ val } />,
    },
    {
        key: 'views',
        label: __( 'Views', 'fotogrids' ),
        align: 'center',
        modifier: 'metric',
        sortable: true,
        render: ( val, row ) => (
            <span className="fg-stats-metric">
                <span className="fg-stats-metric__value">{ fmt( val ) }</span>
                { typeof row.views_share === 'number' && (
                    <span className="fg-stats-metric__share">
                        { fmtShare( row.views_share ) }
                    </span>
                ) }
            </span>
        ),
    },
    { key: 'shares', label: __( 'Shares', 'fotogrids' ), align: 'center', render: fmt, sortable: true },
];

// Mirrors the ORDER BY each endpoint applies, so the header shows the live
// sort from first paint.
const RECENTLY_VIEWED_SORT = { key: 'last_viewed', direction: 'desc' };
const TOP_CONTENT_SORT     = { key: 'views', direction: 'desc' };

const defaultOverview = { galleries: 0, albums: 0, items: 0, views: 0, shares: 0, trend: null };
const OVERVIEW_CARDS = [
    { key: 'galleries', iconName: 'layout_3x3', label: __( 'Galleries', 'fotogrids' ), accent: 'blue' },
    { key: 'albums', iconName: 'layout_2x2', label: __( 'Albums', 'fotogrids' ), accent: 'red' },
    { key: 'items', iconName: 'image', label: __( 'Items', 'fotogrids' ), accent: 'yellow' },
    { key: 'views', iconName: 'eye', label: __( 'Views', 'fotogrids' ), accent: 'grey', trendKey: 'views' },
    { key: 'shares', iconName: 'click', label: __( 'Interactions', 'fotogrids' ), accent: 'green', trendKey: 'shares' },
];

/**
 * Percentage change between the selected period and the one before it.
 *
 * Returns null when there is no prior-period baseline to divide by, so the
 * card renders no trend rather than an unbounded increase.
 *
 * @param {Object} trend Trend block from the overview endpoint.
 * @param {string} key   Metric name within the trend block.
 * @returns {number|null} Signed percentage, rounded to whole numbers.
 */
const periodDelta = ( trend, key ) => {
    if ( ! trend ) return null;

    const previous = trend[ `${ key }_previous` ];
    const current  = trend[ key ];

    if ( ! previous ) return null;

    return Math.round( ( ( current - previous ) / previous ) * 100 );
};

/**
 * Resolve the value, trend and footnote a single overview card should show.
 *
 * Cards carrying a trendKey follow the period filter, with the all-time figure
 * demoted to a footnote when the two differ. Inventory cards are lifetime
 * counts with nothing to compare against.
 *
 * @param {Object} card     Card definition from OVERVIEW_CARDS.
 * @param {Object} overview Overview response.
 * @returns {{value: string, delta: ?number, deltaTitle: string, footnote: string}} Card props.
 */
const buildCardProps = ( card, overview ) => {
    const allTime = overview[ card.key ];

    if ( ! card.trendKey || ! overview.trend ) {
        return { value: fmt( allTime ), delta: null, deltaTitle: '', footnote: '' };
    }

    const periodValue = overview.trend[ card.trendKey ];

    return {
        value: fmt( periodValue ),
        delta: periodDelta( overview.trend, card.trendKey ),
        deltaTitle: sprintf(
            /* translators: 1: start date, 2: end date, 3: count in that period. */
            __( 'Compared to %1$s – %2$s (%3$s)', 'fotogrids' ),
            overview.trend.previous_start,
            overview.trend.previous_end,
            fmt( overview.trend[ `${ card.trendKey }_previous` ] )
        ),
        footnote: periodValue === allTime ? '' : sprintf(
            /* translators: %s: all-time count. */
            __( 'Total %s', 'fotogrids' ),
            fmt( allTime )
        ),
    };
};

const StatsPage = () => {
    const [ overview,         setOverview         ] = useState( defaultOverview );
    const [ viewsData,        setViewsData        ] = useState( { labels: [], data: [], previous: [] } );
    const [ popularGalleries, setPopularGalleries ] = useState( { labels: [], data: [], total: 0 } );
    const [ recentlyViewed,   setRecentlyViewed   ] = useState( [] );
    const [ topContent,       setTopContent       ] = useState( [] );
    const [ selectedPeriod,   setSelectedPeriod   ] = useState( readPeriodParam );
    const [ loading,          setLoading          ] = useState( true );
    const [ error,            setError            ] = useState( null );
    const [ refreshToken,     setRefreshToken     ] = useState( 0 );

    // Canvas nodes are always in the DOM - we use a CSS overlay for the loading
    // skeleton so refs are valid from first mount and never need to be re-created.
    const viewsChartRef    = useRef( null );
    const popularChartRef  = useRef( null );
    const viewsChartInst   = useRef( null );
    const popularChartInst = useRef( null );

    useEffect( () => {
        return () => {
            viewsChartInst.current?.destroy();
            popularChartInst.current?.destroy();
            viewsChartInst.current   = null;
            popularChartInst.current = null;
        };
    }, [] );

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
                    datasets: [
                        {
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
                            order: 1,
                        },
                        {
                            label: __( 'Previous period', 'fotogrids' ),
                            data: viewsData.previous,
                            borderColor: '#c7cbd4',
                            borderDash: [ 4, 4 ],
                            borderWidth: 2,
                            tension: 0.4,
                            fill: false,
                            pointRadius: 0,
                            pointHitRadius: 8,
                            order: 2,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'line',
                                boxWidth: 20,
                                padding: 14,
                            },
                        },
                    },
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                },
            } );
        } else {
            viewsChartInst.current.data.labels             = viewsData.labels;
            viewsChartInst.current.data.datasets[ 0 ].data = viewsData.data;
            viewsChartInst.current.data.datasets[ 1 ].data = viewsData.previous;
            viewsChartInst.current.update();
        }
    }, [ loading, viewsData ] );

    useEffect( () => {
        if ( loading ) return;
        if ( typeof Chart === 'undefined' ) return;
        if ( ! popularChartRef.current ) return;
        // No data → canvas is hidden, nothing to draw.
        if ( popularGalleries.data.length === 0 ) return;

        const slices = buildPopularSlices(
            popularGalleries.labels,
            popularGalleries.data,
            popularGalleries.total
        );

        if ( ! popularChartInst.current ) {
            popularChartInst.current = new Chart( popularChartRef.current, {
                type: 'doughnut',
                data: {
                    labels: slices.labels,
                    datasets: [ {
                        data: slices.data,
                        backgroundColor: slices.colors,
                        borderWidth: 0,
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#ffffff',
                    } ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8,
                                boxHeight: 8,
                                padding: 14,
                            },
                        },
                        tooltip: {
                            callbacks: {
                                label: ( ctx ) => {
                                    const total = ctx.dataset.data.reduce(
                                        ( sum, n ) => sum + n,
                                        0
                                    );
                                    const share = total
                                        ? Math.round( ( ctx.parsed / total ) * 100 )
                                        : 0;

                                    return sprintf(
                                        /* translators: 1: view count, 2: share of total views as a percentage. */
                                        __( '%1$s views (%2$d%%)', 'fotogrids' ),
                                        fmt( ctx.parsed ),
                                        share
                                    );
                                },
                            },
                        },
                    },
                },
            } );
        } else {
            popularChartInst.current.data.labels                        = slices.labels;
            popularChartInst.current.data.datasets[ 0 ].data            = slices.data;
            popularChartInst.current.data.datasets[ 0 ].backgroundColor = slices.colors;
            popularChartInst.current.update();
        }
    }, [ loading, popularGalleries ] );

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
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/overview?days=${ selectedPeriod }` } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/views?days=${ selectedPeriod }` } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/popular-galleries?days=${ selectedPeriod }` } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/recent-activity?days=${ selectedPeriod }` } ),
                    wp.apiFetch( { path: `fotogrids/v1/admin/stats/top-content?days=${ selectedPeriod }` } ),
                ] );

                if ( cancelled ) return;

                setOverview( {
                    trend:     overviewRes?.trend     ?? null,
                    galleries: overviewRes?.galleries ?? 0,
                    albums:    overviewRes?.albums    ?? 0,
                    items:     overviewRes?.items     ?? 0,
                    views:     overviewRes?.views     ?? 0,
                    shares:    overviewRes?.shares    ?? 0,
                } );
                setViewsData( {
                    labels:   viewsRes?.labels   ?? [],
                    data:     viewsRes?.data     ?? [],
                    previous: viewsRes?.previous ?? [],
                } );
                const popularIds = popularRes?.ids ?? [];
                setPopularGalleries( {
                    labels: ( popularRes?.labels ?? [] ).map( ( label, i ) => (
                        typeof label === 'string' && label.trim()
                            ? label
                            : untitledLabel( 'gallery', popularIds[ i ] )
                    ) ),
                    data:  popularRes?.data  ?? [],
                    total: popularRes?.total ?? 0,
                } );
                setRecentlyViewed( Array.isArray( activityRes ) ? activityRes : [] );
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

    const handlePeriodChange = ( days ) => {
        setSelectedPeriod( days );
        writePeriodParam( days );
    };

    return (
        <div className="fg-stats-dashboard">

            {/* Toolbar */}
            <div className="fg-stats-toolbar">
                <div className="fg-stats-period" role="group" aria-label={ __( 'Time period', 'fotogrids' ) }>
                    { PERIODS.map( ( p ) => (
                        <Button
                            key={ p.days }
                            variant={ selectedPeriod === p.days ? 'primary' : 'secondary' }
                            onClick={ () => handlePeriodChange( p.days ) }
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
                        label={ card.label }
                        accent={ card.accent }
                        loading={ loading }
                        { ...buildCardProps( card, overview ) }
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
                    title={ __( 'Recently Viewed', 'fotogrids' ) }
                    columns={ recentlyViewedColumns }
                    rows={ recentlyViewed }
                    defaultSort={ RECENTLY_VIEWED_SORT }
                    loading={ loading }
                    emptyMsg={ __( 'Nothing was viewed in this period.', 'fotogrids' ) }
                />
                <StatsTable
                    title={ __( 'Top Performing Content', 'fotogrids' ) }
                    columns={ topContentColumns }
                    rows={ topContent }
                    defaultSort={ TOP_CONTENT_SORT }
                    loading={ loading }
                    emptyMsg={ __( 'No data available for this period.', 'fotogrids' ) }
                />
            </div>
        </div>
    );
};

export default StatsPage;
