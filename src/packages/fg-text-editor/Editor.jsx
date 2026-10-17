import React, {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';
import { __ } from '@wordpress/i18n';
import { bundledProfile } from '../fg-formatted-text';
import { TextEngine } from './engine';
import { matchesShortcut } from './features';
import { linkAttributes } from './link';
import { load } from './model';
import { removeLink, setLink } from './commands';
import { defaultRegistry } from './registry';
import LinkPopover from './LinkPopover';

export const CHANGE_EVENT = 'fotogrids:admin:text_editor:change';

const DEFAULT_LINKS = { newTab: true, nofollow: false };

function ToolbarIcon({ icon }) {
	if (icon?.path) {
		return (
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				aria-hidden="true"
				focusable="false"
			>
				<path d={icon.path} fill="currentColor" />
			</svg>
		);
	}
	return (
		<span className="fotogrids-text-editor__glyph" aria-hidden="true">
			{icon?.text ?? '?'}
		</span>
	);
}

function shortcutLabel(shortcut) {
	if (!shortcut) {
		return undefined;
	}
	const mac =
		typeof navigator !== 'undefined' &&
		/Mac|iPhone|iPad/.test(navigator.platform || '');
	return shortcut
		.split('+')
		.map((part) => {
			if (part === 'primary') {
				return mac ? 'Meta' : 'Control';
			}
			return part.length === 1 ? part.toUpperCase() : part;
		})
		.join('+');
}

/**
 * Visual editor for short formatted text: captions and descriptions.
 *
 * The value is the stored text. onChange receives the stored form only when
 * the user changes something.
 *
 * @param {Object}      props
 * @param {string}      [props.id]             Id of the editing area.
 * @param {string}      props.value            Stored value.
 * @param {(value: string) => void} props.onChange Called with the new stored value.
 * @param {string}      props.label            Accessible name of the field.
 * @param {Object}      [props.profile]        Effective profile; the bundled one when omitted.
 * @param {string}      [props.profileName]    Profile name passed in the change event.
 * @param {string}      [props.field]          Field name passed in the change event.
 * @param {string|null} [props.disabledReason] Why formatting is unavailable; null when it is.
 * @param {Object}      [props.reasonLink]     Link shown after the reason: { url, label }.
 * @param {boolean}     [props.stripsFormatting] Saving a change drops the formatting.
 * @param {boolean}     [props.disabled]       The whole field is read-only.
 * @param {Object}      [props.linkDefaults]   Site link defaults { newTab, nofollow }.
 * @param {number}      [props.rows]           Visible lines.
 * @param {string}      [props.describedBy]    Extra description id.
 * @param {Object}      [props.registry]       Feature registry; the shared one when omitted.
 */
const Editor = ({
	id,
	value,
	onChange,
	label,
	profile: profileProp,
	profileName = 'item_text',
	field = '',
	disabledReason = null,
	reasonLink = null,
	stripsFormatting = false,
	disabled = false,
	linkDefaults = DEFAULT_LINKS,
	rows = 3,
	describedBy,
	registry = defaultRegistry,
}) => {
	const autoId = useId().replace(/:/g, '');
	const baseId = id || `fotogrids-text-editor-${autoId}`;
	const profile = useMemo(
		() => profileProp || bundledProfile(),
		[profileProp]
	);
	const canFormat = !disabledReason && !disabled;
	const features = useMemo(() => registry.list(profile), [registry, profile]);
	const toolbarFeatures = features.filter((feature) => feature.toolbar);

	const wrapperRef = useRef(null);
	const areaRef = useRef(null);
	const engineRef = useRef(null);
	const lastValueRef = useRef(String(value ?? ''));
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const initialUnsupported = useMemo(
		() => load(String(value ?? ''), profile).unsupported,
		// eslint-disable-next-line react-hooks/exhaustive-deps -- decided once per mount and per external value change below.
		[]
	);
	const [mode, setMode] = useState(initialUnsupported ? 'html' : 'visual');
	const [htmlValue, setHtmlValue] = useState(String(value ?? ''));
	const [state, setState] = useState(null);
	const [popover, setPopover] = useState(null);
	const [focusIndex, setFocusIndex] = useState(0);

	const emit = useCallback(
		(next) => {
			lastValueRef.current = next;
			onChangeRef.current?.(next);
			wrapperRef.current?.dispatchEvent(
				new CustomEvent(CHANGE_EVENT, {
					bubbles: true,
					detail: { profile: profileName, field, value: next },
				})
			);
		},
		[profileName, field]
	);

	const openLinkPopover = useCallback(() => {
		const engine = engineRef.current;
		if (!engine || !canFormat) {
			return;
		}
		const current = engine.state();
		const link = current.link;
		setPopover({
			name: 'link',
			range:
				link && current.selection.start === current.selection.end
					? { start: link.start, end: link.end }
					: current.selection,
			attributes: link ? link.mark.attributes : [],
			existing: !!link,
		});
	}, [canFormat]);

	const runFeature = useCallback(
		(feature) => {
			const engine = engineRef.current;
			if (!engine || !canFormat) {
				return;
			}
			feature.command({
				engine,
				state: engine.state(),
				openPopover: () => {
					if (feature.name === 'link') {
						openLinkPopover();
					}
				},
			});
			if (feature.name !== 'link') {
				engine.focus();
			}
		},
		[canFormat, openLinkPopover]
	);

	const keyHandlerRef = useRef(null);
	keyHandlerRef.current = (event) => {
		const feature = features.find(
			(candidate) =>
				candidate.shortcut && matchesShortcut(event, candidate.shortcut)
		);
		if (!feature) {
			return false;
		}
		if (canFormat) {
			runFeature(feature);
		}
		return true;
	};

	useEffect(() => {
		if (mode !== 'visual' || !areaRef.current) {
			return undefined;
		}
		const engine = new TextEngine(areaRef.current, {
			profile,
			value: lastValueRef.current,
			canFormat,
			onChange: (next) => emit(next),
			onState: (next) => setState(next),
			onKeyDown: (event) => keyHandlerRef.current(event),
		});
		engineRef.current = engine;
		return () => {
			engine.destroy();
			engineRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- the engine is rebuilt only when the mode or profile changes.
	}, [mode, profile]);

	useEffect(() => {
		engineRef.current?.configure({ canFormat });
	}, [canFormat]);

	useEffect(() => {
		const incoming = String(value ?? '');
		if (incoming === lastValueRef.current) {
			return;
		}
		lastValueRef.current = incoming;
		setPopover(null);
		setHtmlValue(incoming);
		if (load(incoming, profile).unsupported) {
			setMode('html');
		} else if (mode === 'visual') {
			engineRef.current?.setValue(incoming);
		} else {
			setMode('visual');
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to values set from outside the editor only.
	}, [value]);

	const htmlLossy = useMemo(
		() => mode === 'html' && load(htmlValue, profile).unsupported,
		[mode, htmlValue, profile]
	);

	const switchMode = (next) => {
		if (next === mode) {
			return;
		}
		if (next === 'html') {
			setHtmlValue(engineRef.current?.getValue() ?? String(value ?? ''));
			setPopover(null);
			setMode('html');
			return;
		}
		if (htmlLossy) {
			return;
		}
		setMode('visual');
	};

	const applyLink = (choice) => {
		const engine = engineRef.current;
		if (!engine || !popover) {
			return;
		}
		const attributes = linkAttributes(choice, popover.attributes, profile);
		const range = popover.range;
		setPopover(null);
		engine.focus();
		engine.run((doc) => setLink(doc, range, attributes, profile));
	};

	const removeCurrentLink = () => {
		const engine = engineRef.current;
		if (!engine || !popover) {
			return;
		}
		const range = popover.range;
		setPopover(null);
		engine.focus();
		engine.run((doc) => removeLink(doc, range, profile));
	};

	const closePopover = () => {
		setPopover(null);
		engineRef.current?.focus();
	};

	const toolbarButtons = [
		...toolbarFeatures.map((feature) => ({
			key: feature.name,
			feature,
		})),
		{ key: 'mode-visual', mode: 'visual' },
		{ key: 'mode-html', mode: 'html' },
	];

	const onToolbarKeyDown = (event) => {
		const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
		if (!keys.includes(event.key)) {
			return;
		}
		event.preventDefault();
		const count = toolbarButtons.length;
		let next;
		if (event.key === 'ArrowRight') {
			next = (focusIndex + 1) % count;
		} else if (event.key === 'ArrowLeft') {
			next = (focusIndex - 1 + count) % count;
		} else if (event.key === 'Home') {
			next = 0;
		} else {
			next = count - 1;
		}
		setFocusIndex(next);
		wrapperRef.current
			?.querySelectorAll('.fotogrids-text-editor__tool')
			[next]?.focus();
	};

	const reasonId = `${baseId}-reason`;
	const noticeId = `${baseId}-notice`;
	const visualBlockedReason = htmlLossy
		? __(
				'This text has markup the visual editor cannot show. Remove it to switch back to Visual.',
				'fotogrids'
			)
		: '';
	const showPlainNotice =
		stripsFormatting && !disabled && /[<&]/.test(String(value ?? ''));

	const describedIds = [
		describedBy,
		disabledReason ? reasonId : null,
		visualBlockedReason ? noticeId : null,
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div
			ref={wrapperRef}
			className={[
				'fotogrids-text-editor',
				`fotogrids-text-editor--${mode}`,
				disabled ? 'fotogrids-text-editor--disabled' : '',
				state?.focused ? 'fotogrids-text-editor--focused' : '',
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div
				className="fotogrids-text-editor__toolbar"
				role="toolbar"
				aria-label={__('Formatting', 'fotogrids')}
				aria-controls={baseId}
				onKeyDown={onToolbarKeyDown}
			>
				{toolbarButtons.map((button, index) => {
					const tabIndex = index === focusIndex ? 0 : -1;
					if (button.feature) {
						const feature = button.feature;
						const unavailable =
							!canFormat || mode !== 'visual' || !state;
						const active =
							mode === 'visual' &&
							!!state &&
							!!feature.isActive?.({
								engine: engineRef.current,
								state,
								openPopover: () => {},
							});
						const pressable = feature.name !== 'link';
						return (
							<button
								key={button.key}
								type="button"
								className={[
									'fotogrids-text-editor__tool',
									`fotogrids-text-editor__tool--${feature.name}`,
									active
										? 'fotogrids-text-editor__tool--active'
										: '',
								]
									.filter(Boolean)
									.join(' ')}
								tabIndex={tabIndex}
								aria-label={feature.toolbar.label}
								title={feature.toolbar.label}
								aria-pressed={pressable ? active : undefined}
								aria-expanded={
									feature.name === 'link'
										? popover?.name === 'link'
										: undefined
								}
								aria-disabled={unavailable ? 'true' : undefined}
								aria-describedby={
									disabledReason ? reasonId : undefined
								}
								aria-keyshortcuts={shortcutLabel(
									feature.shortcut
								)}
								onMouseDown={(event) => event.preventDefault()}
								onFocus={() => setFocusIndex(index)}
								onClick={() => {
									if (!unavailable) {
										runFeature(feature);
									}
								}}
							>
								<ToolbarIcon icon={feature.toolbar.icon} />
							</button>
						);
					}
					const isHtml = button.mode === 'html';
					const blocked = isHtml
						? !canFormat && mode !== 'html'
						: !!visualBlockedReason;
					return (
						<button
							key={button.key}
							type="button"
							className={[
								'fotogrids-text-editor__tool',
								'fotogrids-text-editor__mode',
								isHtml
									? ''
									: 'fotogrids-text-editor__mode--start',
								mode === button.mode
									? 'fotogrids-text-editor__tool--active'
									: '',
							]
								.filter(Boolean)
								.join(' ')}
							tabIndex={tabIndex}
							aria-pressed={mode === button.mode}
							aria-disabled={
								blocked || disabled ? 'true' : undefined
							}
							aria-describedby={
								!isHtml && visualBlockedReason
									? noticeId
									: isHtml && blocked && disabledReason
										? reasonId
										: undefined
							}
							onMouseDown={(event) => event.preventDefault()}
							onFocus={() => setFocusIndex(index)}
							onClick={() => {
								if (!blocked && !disabled) {
									switchMode(button.mode);
								}
							}}
						>
							{isHtml
								? __('HTML', 'fotogrids')
								: __('Visual', 'fotogrids')}
						</button>
					);
				})}
			</div>

			{popover?.name === 'link' && mode === 'visual' && (
				<LinkPopover
					id={`${baseId}-link`}
					attributes={popover.attributes}
					defaults={linkDefaults}
					profile={profile}
					onApply={applyLink}
					onRemove={popover.existing ? removeCurrentLink : undefined}
					onClose={closePopover}
				/>
			)}

			{mode === 'visual' ? (
				<div
					ref={areaRef}
					id={baseId}
					className="fotogrids-text-editor__area"
					role="textbox"
					aria-multiline="true"
					aria-label={label}
					aria-describedby={describedIds || undefined}
					aria-readonly={disabled ? 'true' : undefined}
					contentEditable={!disabled}
					suppressContentEditableWarning
					spellCheck
					style={{
						'--fotogrids-text-editor-rows': Math.max(1, rows),
					}}
				/>
			) : (
				<textarea
					id={baseId}
					className="fotogrids-text-editor__html"
					aria-label={label}
					aria-describedby={describedIds || undefined}
					rows={Math.max(rows, 3)}
					value={htmlValue}
					disabled={disabled}
					spellCheck={false}
					onChange={(event) => {
						const next = event.target.value.replace(/\r\n?/g, '\n');
						setHtmlValue(next);
						emit(next);
					}}
				/>
			)}

			{disabledReason && (
				<p className="fotogrids-text-editor__reason" id={reasonId}>
					{disabledReason}
					{showPlainNotice &&
						' ' +
							__(
								'Changing this text saves it without its formatting.',
								'fotogrids'
							)}
					{reasonLink?.url && (
						<>
							{' '}
							<a href={reasonLink.url}>{reasonLink.label}</a>
						</>
					)}
				</p>
			)}
			{visualBlockedReason && (
				<p
					className="fotogrids-text-editor__notice"
					id={noticeId}
					role="status"
				>
					{visualBlockedReason}
				</p>
			)}
		</div>
	);
};

export default Editor;
