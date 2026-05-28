/**
 * Main Dashboard Component
 */
import React, { useState, useEffect } from 'react';
import { fetchDashboardStats } from '../../utils/api';
import { createGalleryFromImages } from '../../utils/gallery';

import MainCTA from '../dashboard/MainCTA';
import Checklist from '../dashboard/Checklist';
import FileUploader from '../dashboard/FileUploader';
import CreateOptions from '../dashboard/CreateOptions';
import LearnSection from '../dashboard/LearnSection';
import ProFeatures from '../dashboard/ProFeatures';
import OverviewStats from '../dashboard/OverviewStats';

const { __ } = wp.i18n;

const Dashboard = () => {
    const [stats, setStats] = useState({
        galleries: 0,
        albums: 0,
        items: 0,
        views: 0,
        shares: 0,
        shortcodes_used: false
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = () => {
        setLoading(true);
        fetchDashboardStats()
            .then(data => {
                setStats({
                    galleries: data.galleries || 0,
                    albums: data.albums || 0,
                    items: data.items || 0,
                    views: data.views || 0,
                    shares: data.shares || 0,
                    shortcodes_used: data.shortcodes_used || false
                });
                setLoading(false);
            })
            .catch(error => {
                console.error('Error loading dashboard stats:', error);
                setLoading(false);
            });
    };

    const handleUploadComplete = async (imageIds) => {
        try {
            await createGalleryFromImages(imageIds);
            loadStats();
            alert(__('Gallery created successfully!', 'fotogrids'));
        } catch (error) {
            console.error('Error creating gallery from upload:', error);
            alert(error.message || __('Failed to create gallery.', 'fotogrids'));
        }
    };

    return (
        <div className="fotogrids-dashboard">
            <div className="fotogrids-admin-blocks-grid">
                <MainCTA
                    galleriesCount={stats.galleries}
                    itemsCount={stats.items}
                />

                <Checklist
                    galleriesCount={stats.galleries}
                    shortcodesUsed={stats.shortcodes_used}
                />

                <FileUploader onUploadComplete={handleUploadComplete} />

                <CreateOptions />

                <LearnSection />

                <ProFeatures />
            </div>

            <OverviewStats stats={stats} loading={loading} />
        </div>
    );
};

export default Dashboard;
