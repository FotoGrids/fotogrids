/**
 * Setup Checklist Component
 */
import React from 'react';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

const ChecklistItem = ({ completed, href, label }) => {
    const marker = completed ? <Icon name="check" /> : <span />;

    if (completed || !href) {
        return (
            <li className={completed ? 'completed' : ''}>
                {marker}
                {label}
            </li>
        );
    }

    return (
        <li>
            <a className="fg-abc-checklist-link" href={href}>
                {marker}
                {label}
            </a>
        </li>
    );
};

const Checklist = ({ galleriesTotal, galleriesPublished, settingsConfigured }) => {
    const steps = [
        {
            label: __('Plugin installed and activated', 'fotogrids'),
            completed: true
        },
        {
            label: __('Dashboard page visited', 'fotogrids'),
            completed: true
        },
        {
            label: __('Create your first gallery', 'fotogrids'),
            completed: galleriesTotal > 0,
            href: 'post-new.php?post_type=fotogrids_gallery'
        },
        {
            label: __('Configure display settings', 'fotogrids'),
            completed: settingsConfigured,
            href: 'admin.php?page=fotogrids-settings&tab=defaults'
        },
        {
            label: __('Publish gallery on your site', 'fotogrids'),
            completed: galleriesPublished > 0,
            href: 'edit.php?post_type=fotogrids_gallery'
        }
    ];

    const completedSteps = steps.filter((step) => step.completed).length;
    const progressPercent = Math.min(100, (completedSteps / steps.length) * 100);

    return (
        <div className="fotogrids-admin-block-card fg-abc-checklist">
            <div className="fotogrids-admin-block-card-header">
                <Icon name="list" className="fotogrids-admin-block-card-header-icon fg-header-icon-light" />
                <h3>{__('Complete Your Setup', 'fotogrids')}</h3>
            </div>
            <ul className="fg-abc-checklist-items">
                {steps.map((step) => (
                    <ChecklistItem
                        key={step.label}
                        completed={step.completed}
                        href={step.href}
                        label={step.label}
                    />
                ))}
            </ul>
            <div className="progress-bar-container">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    );
};

export default Checklist;
