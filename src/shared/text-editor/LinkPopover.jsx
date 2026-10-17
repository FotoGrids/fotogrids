import React, { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { completeHref, initialChoice, isAllowedHref } from './link';

/**
 * Link editing panel shown under the toolbar.
 *
 * @param {Object}   props
 * @param {string}   props.id         Element id.
 * @param {Array}    props.attributes Existing link attributes, or [] for a new link.
 * @param {Object}   props.defaults   Site link defaults { newTab, nofollow }.
 * @param {Object}   props.profile    Effective profile.
 * @param {(choice: Object) => void} props.onApply  Called with the choice.
 * @param {() => void}               [props.onRemove] Removes the link; omitted for a new link.
 * @param {() => void}               props.onClose   Called on cancel or Escape.
 */
const LinkPopover = ({
	id,
	attributes,
	defaults,
	profile,
	onApply,
	onRemove,
	onClose,
}) => {
	const [choice, setChoice] = useState(() =>
		initialChoice(attributes, defaults)
	);
	const [error, setError] = useState('');
	const inputRef = useRef(null);
	const panelRef = useRef(null);
	const keyHandlerRef = useRef(null);
	const errorId = `${id}-error`;

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) {
			return undefined;
		}
		const listener = (event) => keyHandlerRef.current?.(event);
		panel.addEventListener('keydown', listener);
		return () => panel.removeEventListener('keydown', listener);
	}, []);

	const update = (patch) => {
		setChoice((prev) => ({ ...prev, ...patch }));
		setError('');
	};

	const apply = () => {
		const href = completeHref(choice.href);
		if (!isAllowedHref(href, profile)) {
			setError(
				__(
					'Enter a web address (https://…), an email address or a phone link.',
					'fotogrids'
				)
			);
			inputRef.current?.focus();
			return;
		}
		const initial = initialChoice(attributes, defaults);
		onApply({
			...choice,
			href,
			newTabTouched: choice.newTab !== initial.newTab,
			nofollowTouched: choice.nofollow !== initial.nofollow,
		});
	};

	keyHandlerRef.current = (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onClose();
		} else if (event.key === 'Enter' && event.target === inputRef.current) {
			event.preventDefault();
			apply();
		}
	};

	const defaultLabel = (on) =>
		on
			? __('Site default: on', 'fotogrids')
			: __('Site default: off', 'fotogrids');

	const hasTarget = !!profile.elements.a?.attributes?.target;
	const hasRel =
		!!profile.elements.a?.attributes?.rel?.values?.includes('nofollow');

	return (
		<div
			className="fotogrids-text-editor__link"
			id={id}
			ref={panelRef}
			role="group"
			aria-label={__('Link', 'fotogrids')}
		>
			<label
				className="fotogrids-text-editor__link-label"
				htmlFor={`${id}-url`}
			>
				{__('Link address', 'fotogrids')}
			</label>
			<input
				ref={inputRef}
				id={`${id}-url`}
				type="text"
				inputMode="url"
				className="fotogrids-text-editor__link-url"
				value={choice.href}
				placeholder="https://"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? errorId : undefined}
				onChange={(event) => update({ href: event.target.value })}
			/>
			{error && (
				<p
					className="fotogrids-text-editor__link-error"
					id={errorId}
					role="alert"
				>
					{error}
				</p>
			)}
			{hasTarget && (
				<div className="fotogrids-text-editor__link-option">
					<input
						id={`${id}-new-tab`}
						type="checkbox"
						checked={choice.newTab}
						onChange={(event) =>
							update({
								newTab: event.target.checked,
								newTabTouched: true,
							})
						}
					/>
					<label htmlFor={`${id}-new-tab`}>
						{__('Open in a new tab', 'fotogrids')}
					</label>
					<span className="fotogrids-text-editor__link-default">
						{defaultLabel(defaults.newTab)}
					</span>
				</div>
			)}
			{hasRel && (
				<div className="fotogrids-text-editor__link-option">
					<input
						id={`${id}-nofollow`}
						type="checkbox"
						checked={choice.nofollow}
						onChange={(event) =>
							update({
								nofollow: event.target.checked,
								nofollowTouched: true,
							})
						}
					/>
					<label htmlFor={`${id}-nofollow`}>
						{__('Ask search engines not to follow', 'fotogrids')}
					</label>
					<span className="fotogrids-text-editor__link-default">
						{defaultLabel(defaults.nofollow)}
					</span>
				</div>
			)}
			<div className="fotogrids-text-editor__link-actions">
				{onRemove && (
					<button
						type="button"
						className="fotogrids-text-editor__link-button fotogrids-text-editor__link-button--remove"
						onClick={onRemove}
					>
						{__('Remove link', 'fotogrids')}
					</button>
				)}
				<button
					type="button"
					className="fotogrids-text-editor__link-button"
					onClick={onClose}
				>
					{__('Cancel', 'fotogrids')}
				</button>
				<button
					type="button"
					className="fotogrids-text-editor__link-button fotogrids-text-editor__link-button--primary"
					onClick={apply}
				>
					{__('Apply', 'fotogrids')}
				</button>
			</div>
		</div>
	);
};

export default LinkPopover;
