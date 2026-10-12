import React from 'react';
import Icon from '@/admin/src/components/shared/Icon.jsx';
import { LOG_STATUS_META, LOG_TYPE_META } from '../constants.js';

export const LogTypePill = ({ type }) => {
	const meta = LOG_TYPE_META[type] || { icon: 'info_circle', label: type };

	return (
		<span className={`fg-ie-type-pill fg-ie-type-pill--${type}`}>
			<Icon name={meta.icon} className="fg-ie-type-pill__icon" />
			<span className="fg-ie-type-pill__label">{meta.label}</span>
		</span>
	);
};

export const LogStatusPill = ({ status }) => {
	const meta = LOG_STATUS_META[status] || {
		icon: 'info_circle',
		label: status,
	};

	return (
		<span className={`fg-ie-status-pill fg-ie-status-pill--${status}`}>
			<Icon name={meta.icon} className="fg-ie-status-pill__icon" />
			<span className="fg-ie-status-pill__label">{meta.label}</span>
		</span>
	);
};
