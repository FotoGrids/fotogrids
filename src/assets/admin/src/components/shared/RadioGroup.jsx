/**
 * RadioGroup - shared React radio group.
 *
 * Renders a vertical list of mutually-exclusive Radio options and owns the
 * group's accessibility semantics (role="radiogroup"). A controlled
 * component: pass `selected` and an `onChange(value)` handler.
 *
 * The options/selected/onChange shape intentionally mirrors the
 * @wordpress/components RadioControl it replaces, so existing call sites
 * migrate with minimal change. Each option may also carry a `description`
 * and `disabled` flag.
 *
 * Props
 * ─────
 * options    Array          [{ label, value, description?, disabled? }].
 * selected   string         Currently selected option value.
 * onChange   fn(value, evt) Called with the chosen value.
 * name       string         Native radio group name. Auto-generated if omitted.
 * label      string|node    Optional group label rendered above the options.
 * disabled   boolean        Disables every option.
 * size       'sm'|'md'|'lg' Forwarded to each Radio (default 'md').
 * ariaLabel  string         Accessible label for the group when no `label`.
 * className  string         Extra classes on the group wrapper.
 */

import React, { useState } from 'react';
import Radio from './Radio';

let nextGroupId = 1;

const RadioGroup = ({
	options = [],
	selected,
	onChange,
	name,
	label,
	disabled = false,
	size = 'md',
	ariaLabel,
	className = '',
	...rest
}) => {
	const [autoId] = useState(() => nextGroupId++);
	const groupName = name || `fg-radio-group-${autoId}`;

	const classes = ['fg-radio-group', className].filter(Boolean).join(' ');

	return (
		<div
			className={classes}
			role="radiogroup"
			aria-label={!label ? ariaLabel : undefined}
			{...rest}
		>
			{label && <span className="fg-radio-group__label">{label}</span>}
			{options.map((option) => (
				<Radio
					key={String(option.value)}
					name={groupName}
					value={String(option.value)}
					label={option.label}
					description={option.description}
					checked={String(option.value) === String(selected)}
					disabled={disabled || Boolean(option.disabled)}
					size={size}
					onChange={onChange}
				/>
			))}
		</div>
	);
};

export default RadioGroup;
