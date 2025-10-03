import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Card, CardBody, CardHeader, SelectControl } from '@wordpress/components';

const StatsPage = () => {
    const [selectedGallery, setSelectedGallery] = useState('all');
    const [dateRange, setDateRange] = useState('30');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, [selectedGallery, dateRange]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            // Mock data for now - this would fetch from the REST API
            setTimeout(() => {
                setStats({
                    totalViews: 1250,
                    totalShares: 89,
                    avgTime: '00:25s',
                    topItems: [
                        { title: 'Beach Sunset', views: 120 },
                        { title: 'City Night', views: 60 },
                        { title: 'Hike Trail', views: 50 },
                    ],
                    chartData: [
                        { date: '2024-01-01', views: 45, shares: 3 },
                        { date: '2024-01-02', views: 52, shares: 5 },
                        { date: '2024-01-03', views: 38, shares: 2 },
                        { date: '2024-01-04', views: 61, shares: 7 },
                        { date: '2024-01-05', views: 55, shares: 4 },
                    ],
                });
                setLoading(false);
            }, 1000);
        } catch (error) {
            console.error('Error fetching stats:', error);
            setLoading(false);
        }
    };

    const galleryOptions = [
        { label: __('All Galleries', 'fotogrids'), value: 'all' },
        { label: __('Summer Trip', 'fotogrids'), value: '1' },
        { label: __('Product Launch', 'fotogrids'), value: '2' },
        { label: __('Portrait Set', 'fotogrids'), value: '3' },
    ];

    const dateRangeOptions = [
        { label: __('Last 7 Days', 'fotogrids'), value: '7' },
        { label: __('Last 30 Days', 'fotogrids'), value: '30' },
        { label: __('Last 90 Days', 'fotogrids'), value: '90' },
        { label: __('Last Year', 'fotogrids'), value: '365' },
    ];

    return (
        <div className="fotogrids-stats-page">
            <div className="stats-filters">
                <SelectControl
                    label={__('Gallery', 'fotogrids')}
                    value={selectedGallery}
                    options={galleryOptions}
                    onChange={setSelectedGallery}
                />
                <SelectControl
                    label={__('Date Range', 'fotogrids')}
                    value={dateRange}
                    options={dateRangeOptions}
                    onChange={setDateRange}
                />
            </div>

            {loading ? (
                <div className="loading">{__('Loading statistics...', 'fotogrids')}</div>
            ) : (
                <div className="stats-content">
                    <div className="stats-overview">
                        <Card>
                            <CardBody>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <div className="stat-number">{stats?.totalViews?.toLocaleString()}</div>
                                        <div className="stat-label">{__('Views', 'fotogrids')}</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-number">{stats?.totalShares?.toLocaleString()}</div>
                                        <div className="stat-label">{__('Shares', 'fotogrids')}</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-number">{stats?.avgTime}</div>
                                        <div className="stat-label">{__('Avg. Time', 'fotogrids')}</div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <div className="stats-charts">
                        <Card>
                            <CardHeader>
                                <h3>{__('Views Over Time', 'fotogrids')}</h3>
                            </CardHeader>
                            <CardBody>
                                <div className="chart-placeholder">
                                    <p>{__('Chart visualization would be implemented here using Chart.js', 'fotogrids')}</p>
                                    {/* Simple ASCII chart for demonstration */}
                                    <pre className="ascii-chart">
{`Views
 |    ****
 |   ******
 | *********
 |________________________
   ${__('Time', 'fotogrids')}`}
                                    </pre>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <div className="stats-top-content">
                        <Card>
                            <CardHeader>
                                <h3>{__('Top Items (by views)', 'fotogrids')}</h3>
                            </CardHeader>
                            <CardBody>
                                <div className="top-items-list">
                                    {stats?.topItems?.map((item: any, index: number) => (
                                        <div key={index} className="top-item-item">
                                            <span className="rank">{index + 1}.</span>
                                            <span className="item-title">{item.title}</span>
                                            <span className="item-views">{item.views} {__('views', 'fotogrids')}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsPage;
