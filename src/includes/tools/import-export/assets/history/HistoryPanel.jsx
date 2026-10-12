import React, { useState, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import ChipList from '../components/ChipList.jsx';
import { formatDate, parseSummary } from '../utils.js';
import { LogStatusPill, LogTypePill } from './LogPills.jsx';

const LogSummary = ({ summary }) => {
	const chips = parseSummary(summary);

	if (0 === chips.length) {
		return <span className="fg-ie-log-detail__empty">&mdash;</span>;
	}

	return <ChipList chips={chips} />;
};

const HistoryPanel = () => {
	const [log, setLog] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		apiFetch({ path: '/fotogrids/v1/admin/tools/import-export/log' })
			.then((data) => setLog(data?.log ?? []))
			.catch((err) =>
				setError(
					err.message ||
						__('Could not load operation log.', 'fotogrids')
				)
			)
			.finally(() => setLoading(false));
	}, []);

	return (
		<Panel title={__('Import / Export Log', 'fotogrids')} titleTag="h3">
			{loading && (
				<p className="fg-ie-hint">{__('Loading log…', 'fotogrids')}</p>
			)}

			{!loading && error && (
				<div className="fg-ie-error-notice" role="alert">
					{error}
				</div>
			)}

			{!loading && !error && (!log || log.length === 0) && (
				<p className="fg-ie-empty">
					{__(
						'No operations recorded yet. Export or import data to see a log here.',
						'fotogrids'
					)}
				</p>
			)}

			{!loading && !error && log && log.length > 0 && (
				<table className="fg-ie-log-table widefat striped">
					<thead>
						<tr>
							<th>{__('Date', 'fotogrids')}</th>
							<th>{__('Type', 'fotogrids')}</th>
							<th>{__('Details', 'fotogrids')}</th>
							<th>{__('Status', 'fotogrids')}</th>
						</tr>
					</thead>
					<tbody>
						{log.map((entry) => (
							<tr key={entry.id}>
								<td className="fg-ie-log-date">
									{formatDate(entry.date)}
								</td>
								<td className="fg-ie-log-op">
									<LogTypePill type={entry.type} />
								</td>
								<td className="fg-ie-log-detail">
									<LogSummary summary={entry.summary} />
								</td>
								<td className="fg-ie-log-status">
									<LogStatusPill status={entry.status} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</Panel>
	);
};

export default HistoryPanel;
