/**
 * Create Options Component
 */
import React from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '../shared/Icon';
import LockedReason from './LockedReason';
import { DASHBOARD_ACCESS } from './access';
import { userCan } from '../../utils/capabilities';
import { ALBUM_POST_TYPE, GALLERY_POST_TYPE } from '../../utils/post-types';

const OPTIONS = [
	{
		href: `post-new.php?post_type=${GALLERY_POST_TYPE}`,
		icon: 'layout_3x3',
		label: __('New Gallery', 'fotogrids'),
		access: DASHBOARD_ACCESS.gallery,
	},
	{
		href: `post-new.php?post_type=${ALBUM_POST_TYPE}`,
		icon: 'layout_2x2',
		label: __('New Album', 'fotogrids'),
		access: DASHBOARD_ACCESS.album,
	},
	{
		href: 'admin.php?page=fotogrids-templates',
		icon: 'templates',
		label: __('Browse Templates', 'fotogrids'),
		access: DASHBOARD_ACCESS.templates,
	},
	{
		href: 'admin.php?page=fotogrids-settings',
		icon: 'settings',
		label: __('Finetune Settings', 'fotogrids'),
		access: DASHBOARD_ACCESS.settings,
	},
];

const CreateOption = ({ href, icon, label, access }) => {
	const iconNode = (
		<Icon name={icon} className="fotogrids-admin-block-card-icon" />
	);

	if (userCan(access.cap)) {
		return (
			<a href={href} className="create-option">
				{iconNode}
				<span>{label}</span>
			</a>
		);
	}

	return (
		<div className="create-option is-disabled">
			{iconNode}
			<span>{label}</span>
			<LockedReason>{access.reason}</LockedReason>
		</div>
	);
};

const CreateOptions = () => {
	return (
		<div className="fotogrids-admin-block-card fg-abc-create-options">
			<div className="fotogrids-admin-block-card-header">
				<Icon
					name="plus_square"
					className="fotogrids-admin-block-card-header-icon"
				/>
				<h3>{__('Create', 'fotogrids')}</h3>
				<p>
					{__(
						'Create a new gallery, browse pre-defined templates and adjust settings to your own likes and needs.',
						'fotogrids'
					)}
				</p>
			</div>
			<div className="create-grid">
				{OPTIONS.map((option) => (
					<CreateOption key={option.href} {...option} />
				))}
			</div>
		</div>
	);
};

export default CreateOptions;
