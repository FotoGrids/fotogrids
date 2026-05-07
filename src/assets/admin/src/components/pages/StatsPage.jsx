/**
 * Statistics Page Component
 */
import React, { useState, useEffect, useRef } from 'react';

const { __ } = wp.i18n;

const StatsPage = () => {
    const [overview, setOverview] = useState({
        galleries: 0,
        albums: 0,
        items: 0,
        views: 0
    });
    const [viewsData, setViewsData] = useState({ labels: [], data: [] });
    const [popularGalleries, setPopularGalleries] = useState({ labels: [], data: [] });
    const [recentActivity, setRecentActivity] = useState([]);
    const [topContent, setTopContent] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState(7);
    const [loading, setLoading] = useState(true);

    const viewsChartRef = useRef(null);
    const popularChartRef = useRef(null);
    const viewsChartInstance = useRef(null);
    const popularChartInstance = useRef(null);

    // Initialize charts
    useEffect(() => {
        if (typeof Chart === 'undefined') {
            console.error('FotoGrids Stats: Chart.js is not available');
            return;
        }

        // Views chart
        const viewsCtx = document.getElementById('views-chart');
        if (viewsCtx && !viewsChartInstance.current) {
            viewsChartInstance.current = new Chart(viewsCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Views',
                        data: [],
                        borderColor: '#3c46f0',
                        backgroundColor: 'rgba(60, 70, 240, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#3c46f0',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }

        // Popular galleries chart
        const popularCtx = document.getElementById('popular-galleries-chart');
        if (popularCtx && !popularChartInstance.current) {
            popularChartInstance.current = new Chart(popularCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#3c46f0',
                            '#5865f2',
                            '#4f5af3',
                            '#2d35c7',
                            '#f01e32'
                        ],
                        borderWidth: 0,
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        // Cleanup on unmount
        return () => {
            if (viewsChartInstance.current) {
                viewsChartInstance.current.destroy();
            }
            if (popularChartInstance.current) {
                popularChartInstance.current.destroy();
            }
        };
    }, []);

    // Load overview stats
    useEffect(() => {
        const loadOverview = async () => {
            try {
                const response = await wp.apiFetch({
                    path: 'fotogrids/v1/admin/stats/overview'
                });

                if (response) {
                    setOverview({
                        galleries: response.galleries || 0,
                        albums: response.albums || 0,
                        items: response.items || 0,
                        views: response.views || 0
                    });
                }
            } catch (error) {
                console.error('Error loading overview stats:', error);
            }
        };

        loadOverview();
    }, []);

    // Load views data when period changes
    useEffect(() => {
        const loadViewsData = async () => {
            try {
                const response = await wp.apiFetch({
                    path: `fotogrids/v1/admin/stats/views?days=${selectedPeriod}`
                });

                if (response && viewsChartInstance.current) {
                    viewsChartInstance.current.data.labels = response.labels || [];
                    viewsChartInstance.current.data.datasets[0].data = response.data || [];
                    viewsChartInstance.current.update();
                    setViewsData({
                        labels: response.labels || [],
                        data: response.data || []
                    });
                }
            } catch (error) {
                console.error('Error loading views data:', error);
            }
        };

        loadViewsData();
    }, [selectedPeriod]);

    // Load popular galleries
    useEffect(() => {
        const loadPopularGalleries = async () => {
            try {
                const response = await wp.apiFetch({
                    path: 'fotogrids/v1/admin/stats/popular-galleries'
                });

                if (response && popularChartInstance.current) {
                    popularChartInstance.current.data.labels = response.labels || [];
                    popularChartInstance.current.data.datasets[0].data = response.data || [];
                    popularChartInstance.current.update();
                    setPopularGalleries({
                        labels: response.labels || [],
                        data: response.data || []
                    });
                }
            } catch (error) {
                console.error('Error loading popular galleries:', error);
            }
        };

        loadPopularGalleries();
    }, []);

    // Load recent activity
    useEffect(() => {
        const loadRecentActivity = async () => {
            try {
                const response = await wp.apiFetch({
                    path: 'fotogrids/v1/admin/stats/recent-activity'
                });

                if (response) {
                    setRecentActivity(Array.isArray(response) ? response : []);
                }
                setLoading(false);
            } catch (error) {
                console.error('Error loading recent activity:', error);
                setRecentActivity([]);
                setLoading(false);
            }
        };

        loadRecentActivity();
    }, []);

    // Load top content
    useEffect(() => {
        const loadTopContent = async () => {
            try {
                const response = await wp.apiFetch({
                    path: 'fotogrids/v1/admin/stats/top-content'
                });

                if (response) {
                    setTopContent(Array.isArray(response) ? response : []);
                }
            } catch (error) {
                console.error('Error loading top content:', error);
                setTopContent([]);
            }
        };

        loadTopContent();
    }, []);

    const handlePeriodChange = (days) => {
        setSelectedPeriod(days);
    };

    const getIcon = (iconName) => {
        return window.FotoGridsIcons?.[iconName] || '';
    };

    return (
        <div className="fotogrids-stats-dashboard">
            {/* Overview Cards */}
            <div className="fotogrids-stats-cards">
                <div className="fotogrids-stat-card" data-fotogrids-stat="galleries">
                    <div className="stat-icon" dangerouslySetInnerHTML={{ __html: getIcon('layout_grid') }} />
                    <div className="stat-content">
                        <div className="stat-number">{overview.galleries}</div>
                        <div className="stat-label">{__('Total Galleries', 'fotogrids')}</div>
                    </div>
                </div>

                <div className="fotogrids-stat-card" data-fotogrids-stat="albums">
                    <div className="stat-icon" dangerouslySetInnerHTML={{ __html: getIcon('layout') }} />
                    <div className="stat-content">
                        <div className="stat-number">{overview.albums}</div>
                        <div className="stat-label">{__('Total Albums', 'fotogrids')}</div>
                    </div>
                </div>

                <div className="fotogrids-stat-card" data-fotogrids-stat="items">
                    <div className="stat-icon" dangerouslySetInnerHTML={{ __html: getIcon('image') }} />
                    <div className="stat-content">
                        <div className="stat-number">{overview.items}</div>
                        <div className="stat-label">{__('Total Items', 'fotogrids')}</div>
                    </div>
                </div>

                <div className="fotogrids-stat-card" data-fotogrids-stat="views">
                    <div className="stat-icon" dangerouslySetInnerHTML={{ __html: getIcon('click') }} />
                    <div className="stat-content">
                        <div className="stat-number">{overview.views}</div>
                        <div className="stat-label">{__('Total Interactions', 'fotogrids')}</div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="fotogrids-stats-charts">
                <div className="chart-container">
                    <div className="chart-header">
                        <h3>{__('Views Over Time', 'fotogrids')}</h3>
                        <div className="chart-period">
                            <button
                                className={`period-btn ${selectedPeriod === 7 ? 'fg-is-active' : ''}`}
                                onClick={() => handlePeriodChange(7)}
                            >
                                {__('7 Days', 'fotogrids')}
                            </button>
                            <button
                                className={`period-btn ${selectedPeriod === 30 ? 'fg-is-active' : ''}`}
                                onClick={() => handlePeriodChange(30)}
                            >
                                {__('30 Days', 'fotogrids')}
                            </button>
                            <button
                                className={`period-btn ${selectedPeriod === 90 ? 'fg-is-active' : ''}`}
                                onClick={() => handlePeriodChange(90)}
                            >
                                {__('90 Days', 'fotogrids')}
                            </button>
                        </div>
                    </div>
                    <canvas id="views-chart"></canvas>
                </div>

                <div className="chart-container">
                    <div className="chart-header">
                        <h3>{__('Most Popular Galleries', 'fotogrids')}</h3>
                    </div>
                    <canvas id="popular-galleries-chart"></canvas>
                </div>
            </div>

            {/* Detailed Stats Tables */}
            <div className="fotogrids-stats-tables">
                <div className="stats-table-container">
                    <h3>{__('Recent Activity', 'fotogrids')}</h3>
                    <div className="stats-table-wrapper">
                        <table className="fotogrids-stats-table">
                            <thead>
                                <tr>
                                    <th>{__('Gallery/Album', 'fotogrids')}</th>
                                    <th>{__('Type', 'fotogrids')}</th>
                                    <th>{__('Views', 'fotogrids')}</th>
                                    <th>{__('Last Viewed', 'fotogrids')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="loading">{__('Loading...', 'fotogrids')}</td>
                                    </tr>
                                ) : recentActivity.length > 0 ? (
                                    recentActivity.map((item, index) => (
                                        <tr key={index}>
                                            <td><strong>{item.title}</strong></td>
                                            <td><span className={`type-badge type-${item.type}`}>{item.type}</span></td>
                                            <td>{item.views}</td>
                                            <td>{item.last_viewed}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="no-data">{__('No recent activity', 'fotogrids')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="stats-table-container">
                    <h3>{__('Top Performing Content', 'fotogrids')}</h3>
                    <div className="stats-table-wrapper">
                        <table className="fotogrids-stats-table">
                            <thead>
                                <tr>
                                    <th>{__('Name', 'fotogrids')}</th>
                                    <th>{__('Type', 'fotogrids')}</th>
                                    <th>{__('Views', 'fotogrids')}</th>
                                    <th>{__('Shares', 'fotogrids')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topContent.length > 0 ? (
                                    topContent.map((item, index) => (
                                        <tr key={index}>
                                            <td><strong>{item.title}</strong></td>
                                            <td><span className={`type-badge type-${item.type}`}>{item.type}</span></td>
                                            <td>{item.views}</td>
                                            <td>{item.shares}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="no-data">{__('No data available', 'fotogrids')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPage;
