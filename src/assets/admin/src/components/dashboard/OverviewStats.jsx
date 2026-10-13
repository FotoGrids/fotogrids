/**
 * Overview Statistics Component - Dashboard
 */
import React from 'react';
import { __ } from '@wordpress/i18n';
import StatCard from '../shared/StatCard';
import LockedReason from './LockedReason';
import { DASHBOARD_ACCESS } from './access';
import { userCan } from '../../utils/capabilities';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : n);
const STATS_PAGE_URL = 'admin.php?page=fotogrids-stats';
const OVERVIEW_CARDS = [
	{
		key: 'galleries',
		iconName: 'layout_3x3',
		label: __('Galleries', 'fotogrids'),
		accent: 'blue',
	},
	{
		key: 'albums',
		iconName: 'layout_2x2',
		label: __('Albums', 'fotogrids'),
		accent: 'red',
	},
	{
		key: 'items',
		iconName: 'image',
		label: __('Items', 'fotogrids'),
		accent: 'yellow',
	},
	{
		key: 'views',
		iconName: 'eye',
		label: __('Views', 'fotogrids'),
		accent: 'grey',
	},
	{
		key: 'shares',
		iconName: 'click',
		label: __('Interactions', 'fotogrids'),
		accent: 'green',
	},
];

const OverviewStats = ({ stats, loading }) => {
	const canOpenStats = userCan(DASHBOARD_ACCESS.stats.cap);

	return (
		<div className="fotogrids-overview">
			<h2>{__('Overview', 'fotogrids')}</h2>
			{!canOpenStats && (
				<LockedReason>{DASHBOARD_ACCESS.stats.reason}</LockedReason>
			)}
			<div className="fg-stats-cards">
				{OVERVIEW_CARDS.map((card) => (
					<StatCard
						key={card.key}
						iconName={card.iconName}
						value={fmt(stats[card.key])}
						label={card.label}
						accent={card.accent}
						invert
						loading={loading}
						href={canOpenStats ? STATS_PAGE_URL : undefined}
					/>
				))}
			</div>
		</div>
	);
};

export default OverviewStats;
