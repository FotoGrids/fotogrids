/**
 * Textarea - shared React multi-line text input.
 *
 * A branded <textarea> with an optional label and helper/error text. The
 * label/value/onChange shape mirrors the @wordpress/components
 * TextareaControl it replaces, so existing call sites migrate with minimal
 * change. `onChange` is called with the raw string value (not the event).
 *
 * Props
 * ─────
 * value        string         Current value (controlled).
 * onChange     fn(value, evt) Called with the next string value.
 * label        string|node    Optional visible label above the field.
 * id           string         Optional - ties label[for] to the textarea.
 * placeholder  string         Placeholder text.
 * rows         number         Visible rows (default 3).
 * maxLength    number         Native maxlength.
 * disabled     boolean        Disables the field.
 * required     boolean        Marks the field required.
 * description  string|node    Helper text under the field.
 * error        string|node    Error text under the field (overrides description).
 * ariaLabel    string         Accessible label when no visible `label`.
 * className    string         Extra classes on the wrapper.
 */

import React, { useState } from 'react';

let nextTextareaId = 1;

const Textarea = ({
	value = '',
	onChange,
	label,
	id,
	placeholder,
	rows = 3,
	maxLength,
	disabled = false,
	required = false,
	description,
	error,
	ariaLabel,
	className = '',
	...rest
}) => {
	const [autoId] = useState(() => nextTextareaId++);
	const fieldId = id || `fg-textarea-${autoId}`;

	const classes = [
		'fg-textarea',
		error && 'fg-textarea--has-error',
		disabled && 'fg-textarea--disabled',
		className,
	]
		.filter(Boolean)
		.join(' ');

	const handleChange = (event) => {
		if (!onChange) return;
		onChange(event.target.value, event);
	};

	return (
		<div className={classes}>
			{label && (
				<label className="fg-textarea__label" htmlFor={fieldId}>
					{label}
					{required && (
						<span
							className="fg-textarea__required"
							aria-hidden="true"
						>
							*
						</span>
					)}
				</label>
			)}
			<textarea
				id={fieldId}
				className="fg-textarea__control"
				value={value}
				onChange={handleChange}
				placeholder={placeholder}
				rows={rows}
				maxLength={maxLength}
				disabled={disabled}
				required={required}
				aria-label={!label ? ariaLabel : undefined}
				{...rest}
			/>
			{error ? (
				<p className="fg-textarea__error" role="alert">
					{error}
				</p>
			) : description ? (
				<p className="fg-textarea__description">{description}</p>
			) : null}
		</div>
	);
};

export default Textarea;
