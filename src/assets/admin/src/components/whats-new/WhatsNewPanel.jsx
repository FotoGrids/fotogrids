import { useCallback, useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import Modal from '../shared/Modal/Modal';

const { __ } = wp.i18n;

/**
 * What's New drawer.
 *
 * Slides in from the right with the announcements served by
 * /fotogrids/v1/admin/news. Opened from the "What's New" link in the FotoGrids
 * admin header; it never opens on its own.
 */
const WhatsNewPanel = ({ isOpen, onClose }) => {
	const [status, setStatus] = useState('idle');
	const [items, setItems] = useState([]);
	const [enabled, setEnabled] = useState(true);

	const load = useCallback(() => {
		setStatus('loading');
		apiFetch({ path: '/fotogrids/v1/admin/news' })
			.then((data) => {
				setItems(Array.isArray(data?.items) ? data.items : []);
				setEnabled(data?.enabled !== false);
				setStatus('ready');
			})
			.catch(() => setStatus('error'));
	}, []);

	useEffect(() => {
		if (isOpen && status === 'idle') {
			load();
		}
	}, [isOpen, status, load]);

	const renderItem = (item, index) => (
		<article className="fg-whats-new__item" key={item.id || index}>
			<header className="fg-whats-new__item-header">
				<h3 className="fg-whats-new__item-title">
					{item.url ? (
						<a
							href={item.url}
							target="_blank"
							rel="noopener noreferrer"
						>
							{item.title}
						</a>
					) : (
						item.title
					)}
				</h3>
				<span className="fg-whats-new__tag">
					{__('New', 'fotogrids')}
				</span>
			</header>

			{item.date_label && (
				<div className="fg-whats-new__item-date">{item.date_label}</div>
			)}

			{item.summary && (
				<p className="fg-whats-new__summary">{item.summary}</p>
			)}

			{item.url && (
				<a
					className="fg-whats-new__link"
					href={item.url}
					target="_blank"
					rel="noopener noreferrer"
				>
					{__('Read more', 'fotogrids')}
				</a>
			)}
		</article>
	);

	const renderContent = () => {
		if (status === 'loading' || status === 'idle') {
			return (
				<p className="fg-whats-new__message">
					{__('Loading…', 'fotogrids')}
				</p>
			);
		}

		if (status === 'error') {
			return (
				<div className="fg-whats-new__message">
					<p>{__('Unable to load the latest news.', 'fotogrids')}</p>
					<button
						type="button"
						className="button button-secondary"
						onClick={load}
					>
						{__('Try again', 'fotogrids')}
					</button>
				</div>
			);
		}

		if (!enabled) {
			return (
				<p className="fg-whats-new__message">
					{__(
						'News is turned off in FotoGrids Settings > Advanced.',
						'fotogrids'
					)}
				</p>
			);
		}

		if (!items.length) {
			return (
				<p className="fg-whats-new__message">
					{__('No news available at this time.', 'fotogrids')}
				</p>
			);
		}

		return items.map(renderItem);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			position="right"
			size="sm"
			type="whats-new"
			className="fg-whats-new"
		>
			<Modal.Header>
				<Modal.HeaderLogo />
				<Modal.HeaderTitle>
					{__("What's New in FotoGrids", 'fotogrids')}
				</Modal.HeaderTitle>
			</Modal.Header>
			<Modal.Body>{renderContent()}</Modal.Body>
		</Modal>
	);
};

export default WhatsNewPanel;
