/**
 * Radio - shared React radio button.
 *
 * A single accessible radio option with FotoGrids brand styling. Mirrors
 * Checkbox: a native <input type="radio"> drives behaviour while a sibling
 * span renders the visual circle + dot, so it works inside <label>, forms,
 * and wp-admin tables without fighting wp-admin core CSS.
 *
 * Typically rendered as a child of RadioGroup, which wires `name`,
 * `checked`, and `onChange` for each option. Can also be used standalone.
 *
 * Props
 * ─────
 * checked      boolean        Current state.
 * onChange     fn(value, evt) Called with this option's value on select.
 * label        string|node    Optional visible label next to the circle.
 * id           string         Optional - ties label[for] to the input.
 * name         string         Native input name (groups radios together).
 * value        string         Native input value; passed to onChange.
 * disabled     boolean        Greys out and disables interaction.
 * size         'sm'|'md'|'lg' Maps to the --size-* modifier (default 'md').
 * ariaLabel    string         Accessible label when no visible `label`.
 * description  string|node    Optional helper text under the option.
 * className    string         Extra classes on the wrapper.
 */

import React from 'react';

const SIZES = new Set(['sm', 'md', 'lg']);

const Radio = ({
	checked = false,
	onChange,
	label,
	strongerLabel = false,
	id,
	name,
	value,
	disabled = false,
	size = 'md',
	ariaLabel,
	className = '',
	description,
	...rest
}) => {
	const resolvedSize = SIZES.has(size) ? size : 'md';

	const classes = [
		'fg-radio',
		`fg-radio--size-${resolvedSize}`,
		checked && 'fg-radio--checked',
		disabled && 'fg-radio--disabled',
		className,
	]
		.filter(Boolean)
		.join(' ');

	const handleChange = (event) => {
		if (!onChange) return;
		onChange(event.target.value, event);
	};

	const Wrapper = label ? 'label' : 'span';

	return (
		<div className="fg-radio__wrapper">
			<Wrapper className={classes} htmlFor={label ? id : undefined}>
				<span className="fg-radio__control">
					<input
						type="radio"
						id={id}
						name={name}
						value={value}
						checked={checked}
						disabled={disabled}
						onChange={handleChange}
						aria-label={!label ? ariaLabel : undefined}
						className="fg-radio__input"
						{...rest}
					/>
					<span className="fg-radio__circle" aria-hidden="true">
						<span className="fg-radio__dot" />
					</span>
				</span>
				{label && (
					<span
						className={`fg-radio__label ${strongerLabel ? 'fg-radio__label--stronger' : ''}`.trim()}
					>
						{label}
					</span>
				)}
			</Wrapper>
			{description && (
				<span className="fg-radio__description">{description}</span>
			)}
		</div>
	);
};

export default Radio;
