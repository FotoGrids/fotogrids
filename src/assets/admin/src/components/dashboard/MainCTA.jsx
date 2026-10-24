/**
 * Main CTA Component
 * Shows different CTAs based on whether galleries exist
 */
import React from 'react';
import { __ } from '@wordpress/i18n';
import LockedReason from './LockedReason';
import { DASHBOARD_ACCESS } from './access';
import { userCan } from '../../utils/capabilities';
import { GALLERY_POST_TYPE } from '../../utils/post-types';

const CtaLink = ({ href, className, children }) => {
	if (userCan(DASHBOARD_ACCESS.gallery.cap)) {
		return (
			<a href={href} className={className}>
				{children}
			</a>
		);
	}

	return (
		<span className={`${className} fg-abc-main-cta-disabled`}>
			{children}
		</span>
	);
};

const CtaReason = () =>
	userCan(DASHBOARD_ACCESS.gallery.cap) ? null : (
		<LockedReason>{DASHBOARD_ACCESS.gallery.reason}</LockedReason>
	);

const MainCTA = ({ galleriesCount, itemsCount }) => {
	if (galleriesCount === 0) {
		return (
			<div
				className="fotogrids-admin-block-card fg-abc-main-cta"
				data-fg-walkthrough="dashboard-start"
			>
				<div className="fotogrids-admin-block-card-content">
					<h3>
						<span>{__('Create Your', 'fotogrids')} </span>
						{__('First Gallery', 'fotogrids')}
					</h3>
					<p>
						{__(
							'Build the first beautiful photo gallery in minutes.',
							'fotogrids'
						)}
					</p>
					<CtaLink
						href={`post-new.php?post_type=${GALLERY_POST_TYPE}`}
						className="button button-primary"
					>
						{__('Get Started', 'fotogrids')}
					</CtaLink>
					<CtaReason />
				</div>
			</div>
		);
	}

	return (
		<div
			className="fotogrids-admin-block-card fg-abc-main-cta"
			data-fg-walkthrough="dashboard-start"
		>
			<div className="fotogrids-admin-block-card-content">
				<h3>{__('Grow Your Gallery', 'fotogrids')}</h3>
				<p>
					{itemsCount === 0
						? __(
								'Add photos to your galleries to bring them to life.',
								'fotogrids'
							)
						: __(
								'Create more galleries or explore advanced features to showcase your photos.',
								'fotogrids'
							)}
				</p>
				<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
					<CtaLink
						href={`post-new.php?post_type=${GALLERY_POST_TYPE}`}
						className="button button-primary"
					>
						{__('New Gallery', 'fotogrids')}
					</CtaLink>
					{itemsCount === 0 && (
						<CtaLink
							href={`edit.php?post_type=${GALLERY_POST_TYPE}`}
							className="button button-secondary"
						>
							{__('Add Photos', 'fotogrids')}
						</CtaLink>
					)}
				</div>
				<CtaReason />
			</div>
		</div>
	);
};

export default MainCTA;
