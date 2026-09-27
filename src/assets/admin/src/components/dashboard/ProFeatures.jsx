/**
 * Pro Features Component
 */
import React from 'react';
import Icon from '../shared/Icon';
import { Button } from '../shared/Button';
import { fgGoUrl } from '../../utils/go-url';

const { __ } = wp.i18n;

const ProFeatures = () => {
	return (
		<div className="fotogrids-admin-block-card fg-abc-upgrade">
			<div className="fotogrids-admin-block-card-content">
				<div className="fotogrids-pro-badge">
					<div className="fotogrids-fireworks" />
					<span>{__('PRO', 'fotogrids')}</span>
				</div>
				<h3>{__('Unlock PRO Features', 'fotogrids')}</h3>
				<div className="pro-feature-list">
					{[
						{
							key: 'advanced-layouts',
							label: __('Advanced Layouts', 'fotogrids'),
						},
						{
							key: 'seo-optimization',
							label: __('SEO Optimization', 'fotogrids'),
						},
						{
							key: 'e-commerce',
							label: __('E-Commerce', 'fotogrids'),
						},
						{
							key: 'custom-styling',
							label: __('Custom Styling', 'fotogrids'),
						},
						{
							key: 'priority-support',
							label: __('Priority Support', 'fotogrids'),
						},
						{
							key: 'advanced-analytics',
							label: __('Advanced Analytics', 'fotogrids'),
						},
						{
							key: 'powerful-integrations',
							label: __('Powerful Integrations', 'fotogrids'),
						},
						{
							key: 'bulk-operations',
							label: __('Bulk Operations', 'fotogrids'),
						},
					].map((feature) => (
						<div key={feature.key}>
							<Icon name="check_badge_g" />
							{feature.label}
						</div>
					))}
				</div>
				<p>
					{__(
						'Plus many more powerful features designed to save time, optimize performance, and help you grow.',
						'fotogrids'
					)}
				</p>
				<div className="fg-abc-buttons">
					<Button
						href={fgGoUrl('upgrade', 'dashboard', 'upgrade')}
						target="_blank"
						variant="primary"
					>
						{__('Upgrade Now', 'fotogrids')}
					</Button>
					<Button
						href={fgGoUrl('free-vs-pro', 'dashboard', 'comparison')}
						target="_blank"
						variant="accent"
						className="fg-button--invert"
					>
						{__('Free vs. Pro', 'fotogrids')}
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ProFeatures;
