import React, { useState, useEffect, useCallback } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import PanelRow from '@/admin/src/components/shared/SidebarTabs/elements/PanelRow.jsx';
import TabBar from '@/admin/src/components/shared/TabBar.jsx';
import Icon from '@/admin/src/components/shared/Icon.jsx';
import Tooltip from '@/admin/src/components/Tooltip.jsx';
import { Button } from '@/admin/src/components/shared/Button';
import { copyToClipboard } from '@/admin/src/utils/copy-to-clipboard';

const baseClass = 'fg-system-info';

const STATUS_ICONS = {
	ok: 'check_circle',
	warn: 'alert_circle',
	error: 'x_circle',
};

/**
 * Turns whatever an endpoint failed with into one readable line.
 *
 * A PHP fatal is returned as a block of HTML, so the markup is stripped and the
 * result trimmed - this tool has to stay legible on exactly the broken sites it
 * exists to describe.
 *
 * @param  {*} err Rejection value from apiFetch.
 * @return {string} Message to display.
 */
const readableError = (err) => {
	const fallback = __('That could not be loaded.', 'fotogrids');
	const raw = typeof err?.message === 'string' ? err.message : '';

	if (!raw) {
		return fallback;
	}

	const text = raw
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	if (!text) {
		return fallback;
	}

	return text.length > 300 ? `${text.slice(0, 300)}…` : text;
};

/**
 * Status mark shown beside a report value. Rows with no status render nothing,
 * which is the common case - only actionable rows carry a mark.
 *
 * @param {Object} props
 * @param {string} [props.status] One of 'ok', 'warn', 'error'.
 * @param {string} [props.note]   Explanation shown on hover.
 */
const StatusMark = ({ status, note }) => {
	const iconName = STATUS_ICONS[status];

	if (!iconName) {
		return null;
	}

	const mark = (
		<span
			className={`${baseClass}__status ${baseClass}__status--${status}`}
			aria-hidden="true"
		>
			<Icon name={iconName} />
		</span>
	);

	return note ? (
		<Tooltip content={note} position="left">
			{mark}
		</Tooltip>
	) : (
		mark
	);
};

/**
 * One captured error, expandable to show where it came from.
 *
 * @param {Object} props
 * @param {Object} props.entry Stored error entry.
 */
const ErrorRow = ({ entry }) => {
	const [open, setOpen] = useState(false);
	const stack = entry.context?.stack || '';
	const pageUrl = entry.context?.url || '';
	const raisedIn = entry.context?.raised_in || '';
	const hasDetail = Boolean(entry.file || stack || pageUrl || raisedIn);

	return (
		<>
			<tr className={`${baseClass}__error-row`}>
				<td>
					<span
						className={`${baseClass}__level ${baseClass}__level--${entry.level}`}
					>
						{entry.level}
					</span>
				</td>
				<td className={`${baseClass}__error-message`}>
					{hasDetail ? (
						<button
							type="button"
							className={`${baseClass}__disclose`}
							onClick={() => setOpen(!open)}
							aria-expanded={open}
						>
							{entry.message}
						</button>
					) : (
						entry.message
					)}
				</td>
				<td>{entry.source === 'pro' ? 'Pro' : 'Free'}</td>
				<td className={`${baseClass}__error-times`}>{entry.times}</td>
				<td className={`${baseClass}__error-seen`}>
					{entry.last_seen}
				</td>
			</tr>
			{open && (
				<tr className={`${baseClass}__error-detail`}>
					<td colSpan={5}>
						{entry.file && (
							<p>
								<strong>{__('Origin', 'fotogrids')}:</strong>{' '}
								<code>
									{entry.file}
									{entry.line ? `:${entry.line}` : ''}
								</code>
							</p>
						)}
						{raisedIn && (
							<p>
								<strong>{__('Raised in', 'fotogrids')}:</strong>{' '}
								<code>{raisedIn}</code>
							</p>
						)}
						{pageUrl && (
							<p>
								<strong>{__('Page', 'fotogrids')}:</strong>{' '}
								<code>{pageUrl}</code>
							</p>
						)}
						{stack && <pre>{stack}</pre>}
					</td>
				</tr>
			)}
		</>
	);
};

/**
 * Table of captured errors of one type, with a clear action.
 *
 * @param {Object} props
 * @param {string} props.type      'php' or 'js'.
 * @param {string} props.title     Panel heading.
 * @param {string} props.emptyText Message shown when nothing was captured.
 * @param {string} props.about     Panel description.
 */
const ErrorTable = ({ type, title, emptyText, about }) => {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const load = useCallback(() => {
		setLoading(true);
		setError('');

		apiFetch({
			path: `/fotogrids/v1/admin/tools/system-info/errors?type=${type}`,
		})
			.then((data) => {
				setItems(data?.items || []);
				setLoading(false);
			})
			.catch((err) => {
				setError(readableError(err));
				setLoading(false);
			});
	}, [type]);

	useEffect(() => {
		load();
	}, [load]);

	const handleClear = useCallback(async () => {
		// window.FotoGridsAdmin.modal is installed on every admin page; the
		// fallback only covers it not having initialised yet.
		const modal = window.FotoGridsAdmin?.modal;
		const message = __(
			'This permanently removes the captured entries. New errors will still be recorded.',
			'fotogrids'
		);

		const confirmed = modal
			? await modal.confirm({
					title: __('Clear this log?', 'fotogrids'),
					message,
					confirmLabel: __('Clear log', 'fotogrids'),
					cancelLabel: __('Cancel', 'fotogrids'),
					headerIcon: false,
				})
			: true;

		if (!confirmed) {
			return;
		}

		try {
			await apiFetch({
				path: `/fotogrids/v1/admin/tools/system-info/errors?type=${type}`,
				method: 'DELETE',
			});
			setItems([]);
			window.fotogridsToast?.success(
				__('Log cleared.', 'fotogrids'),
				2000
			);
		} catch (err) {
			window.fotogridsToast?.error(readableError(err));
		}
	}, [type]);

	return (
		<Panel
			title={title}
			titleTag="h3"
			description={about}
			noBodyPadding={items.length > 0}
			action={
				items.length > 0 ? (
					<Button
						variant="danger"
						style="ghost"
						onClick={handleClear}
					>
						{__('Clear log', 'fotogrids')}
					</Button>
				) : null
			}
		>
			{loading && (
				<p className={`${baseClass}__message`}>
					{__('Loading…', 'fotogrids')}
				</p>
			)}

			{!loading && error && (
				<p
					className={`${baseClass}__message ${baseClass}__message--error`}
					role="alert"
				>
					{error}
				</p>
			)}

			{!loading && !error && items.length === 0 && (
				<p
					className={`${baseClass}__message ${baseClass}__message--good`}
				>
					<Icon name="check_circle" /> {emptyText}
				</p>
			)}

			{!loading && !error && items.length > 0 && (
				<table className={`${baseClass}__errors`}>
					<thead>
						<tr>
							<th>{__('Level', 'fotogrids')}</th>
							<th>{__('Message', 'fotogrids')}</th>
							<th>{__('Source', 'fotogrids')}</th>
							<th>{__('Count', 'fotogrids')}</th>
							<th>{__('Last seen (UTC)', 'fotogrids')}</th>
						</tr>
					</thead>
					<tbody>
						{items.map((entry) => (
							<ErrorRow key={entry.fingerprint} entry={entry} />
						))}
					</tbody>
				</table>
			)}
		</Panel>
	);
};

/**
 * Collapsed tail of wp-content/debug.log. Renders nothing when the log is off,
 * so it never appears as an empty broken box.
 */
const DebugLogPanel = () => {
	const [data, setData] = useState(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		apiFetch({ path: '/fotogrids/v1/admin/tools/system-info/debug-log' })
			.then(setData)
			.catch(() => setData(null));
	}, []);

	if (!data?.available) {
		return null;
	}

	return (
		<Panel
			title={__('WordPress debug log', 'fotogrids')}
			titleTag="h3"
			description={__(
				'The tail of the log WordPress writes itself. It catches what FotoGrids cannot see on its own, such as a failure before the plugin loaded.',
				'fotogrids'
			)}
			noBody={!open}
			action={
				<Button
					variant="secondary"
					style="ghost"
					onClick={() => setOpen(!open)}
				>
					{open
						? __('Hide log', 'fotogrids')
						: __('Show log', 'fotogrids')}
				</Button>
			}
		>
			{open && data.lines.length === 0 && (
				<p className={`${baseClass}__message`}>
					{__('The debug log is empty.', 'fotogrids')}
				</p>
			)}

			{open && data.lines.length > 0 && (
				<>
					<p className={`${baseClass}__log-note`}>
						{data.truncated
							? sprintf(
									/* translators: 1: line count, 2: file path, 3: formatted file size. */
									__(
										'Showing the last %1$d lines of %2$s (%3$s).',
										'fotogrids'
									),
									data.shown,
									data.path,
									data.size_label
								)
							: sprintf(
									/* translators: 1: line count, 2: file path. */
									__(
										'Showing all %1$d lines of %2$s.',
										'fotogrids'
									),
									data.shown,
									data.path
								)}
					</p>
					<pre className={`${baseClass}__debug-log`}>
						{data.lines.join('\n')}
					</pre>
				</>
			)}
		</Panel>
	);
};

const SystemInfoTool = () => {
	const [activeTab, setActiveTab] = useState('report');
	const [report, setReport] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const loadReport = useCallback(() => {
		setLoading(true);
		setError('');

		apiFetch({ path: '/fotogrids/v1/admin/tools/system-info/report' })
			.then((data) => {
				setReport(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(readableError(err));
				setLoading(false);
			});
	}, []);

	useEffect(() => {
		loadReport();
	}, [loadReport]);

	const handleCopy = useCallback(async () => {
		if (!report?.text) {
			return;
		}

		try {
			await copyToClipboard(report.text);
			window.fotogridsToast?.success(
				__('System report copied.', 'fotogrids'),
				2000
			);
		} catch (err) {
			window.fotogridsToast?.error(
				__('The report could not be copied.', 'fotogrids')
			);
		}
	}, [report]);

	const handleDownload = useCallback(() => {
		if (!report?.text) {
			return;
		}

		const stamp = new Date().toISOString().slice(0, 10);
		const blob = new Blob([report.text], {
			type: 'text/plain;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');

		link.href = url;
		link.download = `fotogrids-system-info-${stamp}.txt`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}, [report]);

	const tabs = [
		{
			id: 'report',
			label: __('System Info', 'fotogrids'),
			icon: 'info_circle',
		},
		{
			id: 'errors',
			label: __('Error Log', 'fotogrids'),
			icon: 'x_circle',
		},
	];

	const sections = report?.sections || [];

	return (
		<>
			<Panel
				title={__('System Info', 'fotogrids')}
				description={__(
					'Your site environment, your FotoGrids setup, and any errors FotoGrids has recorded.',
					'fotogrids'
				)}
				className={`${baseClass}__header`}
				noBodyPadding
			>
				<TabBar
					tabs={tabs}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
			</Panel>

			{activeTab === 'report' && loading && (
				<Panel titleTag="h3">
					<p className={`${baseClass}__message`}>
						{__('Reading your site environment…', 'fotogrids')}
					</p>
				</Panel>
			)}

			{activeTab === 'report' && !loading && error && (
				<Panel titleTag="h3">
					<p
						className={`${baseClass}__message ${baseClass}__message--error`}
						role="alert"
					>
						{error}
					</p>
					<Button variant="secondary" onClick={loadReport}>
						{__('Try again', 'fotogrids')}
					</Button>
				</Panel>
			)}

			{activeTab === 'report' &&
				!loading &&
				!error &&
				sections.map((section) => (
					<Panel
						key={section.id}
						title={section.label}
						titleTag="h3"
						className={`${baseClass}__report-panel`}
					>
						{(section.rows || []).map((row, index) => (
							<PanelRow
								key={`${section.id}-${index}`}
								title={row.label}
								description={row.note || undefined}
							>
								<span className={`${baseClass}__value`}>
									<span
										className={`${baseClass}__value-text`}
									>
										{row.value}
									</span>
									<StatusMark
										status={row.status}
										note={row.note}
									/>
								</span>
							</PanelRow>
						))}
					</Panel>
				))}

			{activeTab === 'report' && !loading && !error && (
				<Panel
					title={__('Send this report', 'fotogrids')}
					titleTag="h3"
				>
					<div className={`${baseClass}__cta`}>
						<Button
							variant="primary"
							size="lg"
							icon="clipboard"
							onClick={handleCopy}
						>
							{__('Copy report', 'fotogrids')}
						</Button>
						<Button
							variant="secondary"
							size="lg"
							icon="download"
							onClick={handleDownload}
						>
							{__('Download .txt', 'fotogrids')}
						</Button>
					</div>

					{report?.generated_at && (
						<p className={`${baseClass}__generated`}>
							{sprintf(
								/* translators: %s: report generation time. */
								__('Generated %s', 'fotogrids'),
								new Date(report.generated_at).toLocaleString()
							)}
						</p>
					)}
				</Panel>
			)}

			{activeTab === 'errors' && (
				<>
					<ErrorTable
						type="php"
						title={__('PHP error log', 'fotogrids')}
						about={__(
							'PHP errors raised by FotoGrids code. Errors from other plugins and from WordPress itself are not listed here.',
							'fotogrids'
						)}
						emptyText={__(
							'No FotoGrids PHP errors recorded.',
							'fotogrids'
						)}
					/>
					<ErrorTable
						type="js"
						title={__('JavaScript error log', 'fotogrids')}
						about={__(
							'Browser errors from FotoGrids scripts, recorded while a logged-in administrator is on the page.',
							'fotogrids'
						)}
						emptyText={__(
							'No FotoGrids JavaScript errors recorded.',
							'fotogrids'
						)}
					/>
					<DebugLogPanel />
				</>
			)}
		</>
	);
};

export default SystemInfoTool;
