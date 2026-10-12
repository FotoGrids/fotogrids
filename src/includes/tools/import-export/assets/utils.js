import { __ } from '@wordpress/i18n';
import { EXPORT_TYPES, LOG_DETAIL_LABELS } from './constants.js';

export function formatDate(iso) {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

/**
 * Turn a stored log summary into chip descriptors.
 *
 * Summaries are plain strings written server-side, e.g.
 * "12 galleries, 1 albums, 0 templates, settings · JSON" (export) or
 * "3 galleries, 8 items · 2 skipped" (import).
 *
 * @param {string} summary Raw summary string.
 * @return {Array} Chip descriptors: { variant, count, label }.
 */
export function parseSummary(summary) {
	if (!summary || !summary.trim()) {
		return [];
	}

	const chips = [];

	summary.split('·').forEach((segment) => {
		const chunk = segment.trim();

		if (!chunk) {
			return;
		}

		// Trailing format marker: JSON / XML.
		if (
			/^[a-z]+$/i.test(chunk) &&
			!LOG_DETAIL_LABELS[chunk.toLowerCase()]
		) {
			chips.push({ variant: 'format', label: chunk.toUpperCase() });
			return;
		}

		// Trailing skip marker written by the importer.
		const skipped = chunk.match(/^(\d+)\s+skipped$/i);
		if (skipped) {
			chips.push({
				variant: 'skipped',
				count: parseInt(skipped[1], 10),
				label: __('skipped', 'fotogrids'),
			});
			return;
		}

		chunk.split(',').forEach((rawPart) => {
			const part = rawPart.trim();

			if (!part) {
				return;
			}

			const counted = part.match(/^(\d+)\s+(.+)$/);

			if (!counted) {
				const labels = LOG_DETAIL_LABELS[part.toLowerCase()];
				chips.push({
					variant: 'count',
					label: labels ? labels[1] : part,
				});
				return;
			}

			const count = parseInt(counted[1], 10);
			const labels = LOG_DETAIL_LABELS[counted[2].toLowerCase()];

			chips.push({
				variant: 0 === count ? 'empty' : 'count',
				count,
				label: labels ? labels[1 === count ? 0 : 1] : counted[2],
			});
		});
	});

	return chips;
}

/**
 * Turn one side of an import response into chip descriptors.
 *
 * @param {Object} counts Data type to count, or `true` for a type imported whole.
 * @return {Array} Chip descriptors in EXPORT_TYPES order: { key, count, label }.
 */
export function importResultChips(counts) {
	return EXPORT_TYPES.filter(
		({ key }) => true === counts?.[key] || counts?.[key] > 0
	).map(({ key, label }) => {
		const count = counts[key];
		const labels = LOG_DETAIL_LABELS[key];

		if (true === count || !labels) {
			return { key, label };
		}

		return { key, count, label: labels[1 === count ? 0 : 1] };
	});
}
