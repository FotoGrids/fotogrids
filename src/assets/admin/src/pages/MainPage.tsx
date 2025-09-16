import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Card, CardBody, CardHeader } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import type { Statistics } from '../types';

const MainPage = () => {
    const [stats, setStats] = useState<Statistics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            // This would be implemented when we have the stats endpoint
            // const response = await apiFetch({ path: '/fotogrids/v1/stats/totals' });
            // setStats(response);
            
            // Mock data for now
            setStats({
                views: 1250,
                shares: 89,
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fotogrids-main-page">
            <div className="fotogrids-welcome">
                <h2>{__('Welcome to FotoGrids!', 'fotogrids')}</h2>
                <p>
                    {__(
                        'Create beautiful photo galleries and albums with our powerful gallery plugin.',
                        'fotogrids'
                    )}
                </p>
            </div>

            <div className="fotogrids-dashboard-cards">
                <Card>
                    <CardHeader>
                        <h3>{__('Quick Stats', 'fotogrids')}</h3>
                    </CardHeader>
                    <CardBody>
                        {loading ? (
                            <p>{__('Loading...', 'fotogrids')}</p>
                        ) : stats ? (
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <div className="stat-number">{stats.views.toLocaleString()}</div>
                                    <div className="stat-label">{__('Total Views', 'fotogrids')}</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-number">{stats.shares.toLocaleString()}</div>
                                    <div className="stat-label">{__('Total Shares', 'fotogrids')}</div>
                                </div>
                            </div>
                        ) : (
                            <p>{__('No statistics available yet.', 'fotogrids')}</p>
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3>{__('Quick Actions', 'fotogrids')}</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="quick-actions">
                            <a 
                                href="post-new.php?post_type=fotogrids_gallery" 
                                className="button button-primary"
                            >
                                {__('Create New Gallery', 'fotogrids')}
                            </a>
                            <a 
                                href="post-new.php?post_type=fotogrids_album" 
                                className="button button-secondary"
                            >
                                {__('Create New Album', 'fotogrids')}
                            </a>
                            <a 
                                href="admin.php?page=fotogrids-templates" 
                                className="button button-secondary"
                            >
                                {__('Browse Templates', 'fotogrids')}
                            </a>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <h3>{__('Getting Started', 'fotogrids')}</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="getting-started">
                            <ol>
                                <li>{__('Create your first gallery', 'fotogrids')}</li>
                                <li>{__('Add images from your media library', 'fotogrids')}</li>
                                <li>{__('Choose a layout template', 'fotogrids')}</li>
                                <li>{__('Copy the shortcode and paste it in your post or page', 'fotogrids')}</li>
                            </ol>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
};

export default MainPage;
