import React from 'react';
import { formatFileSize } from '@/admin/src/utils/format-file-size';
import { EXPORT_TYPES } from '../constants.js';
import { itemsDetail } from '../utils.js';

const FileSummary = ({ file, summary }) => {
	const counts = summary?.contents ?? {};
	// Drive chips from EXPORT_TYPES order so hidden/unknown keys from the API
	// are either labelled correctly or suppressed - never shown as raw key names.
	const chips = EXPORT_TYPES.filter(({ key }) => counts[key] > 0);

	return (
		<div className="fg-ie-summary">
			<div className="fg-ie-summary__file">
				<span className="fg-ie-summary__file-name">{file.name}</span>
				<span className="fg-ie-summary__file-size">
					{formatFileSize(file.size)}
				</span>
			</div>
			{chips.length > 0 && (
				<div className="fg-ie-summary__chips">
					{chips.map(({ key, label }) => {
						const n = counts[key];
						const showCount = typeof n === 'number' && n > 0;
						const detail =
							'items' === key
								? itemsDetail(counts.items_detail)
								: '';
						return (
							<span key={key} className="fg-ie-summary__chip">
								{showCount && (
									<>
										<strong>{n}</strong>{' '}
									</>
								)}
								{label}
								{detail && (
									<span className="fg-ie-summary__chip-detail">
										{detail}
									</span>
								)}
							</span>
						);
					})}
				</div>
			)}
			{(summary?.notices ?? []).map(({ code, message }) => (
				<div key={code} className="fg-ie-warning-notice" role="status">
					{message}
				</div>
			))}
		</div>
	);
};

export default FileSummary;
