import React from 'react';

/**
 * A row of count chips.
 *
 * @param {Object} props
 * @param {Array}  props.chips     Chip descriptors: { key?, variant?, count?, label, detail? }.
 * @param {string} [props.variant] Variant for chips that do not carry their own.
 */
const ChipList = ({ chips, variant }) => (
	<span className="fg-ie-chips">
		{chips.map((chip, index) => (
			<span
				key={chip.key ?? `${chip.label}-${index}`}
				className={`fg-ie-chip fg-ie-chip--${chip.variant ?? variant}`}
			>
				{undefined !== chip.count && (
					<span className="fg-ie-chip__count">{chip.count}</span>
				)}
				<span className="fg-ie-chip__label">{chip.label}</span>
				{chip.detail && (
					<span className="fg-ie-chip__detail">{chip.detail}</span>
				)}
			</span>
		))}
	</span>
);

export default ChipList;
