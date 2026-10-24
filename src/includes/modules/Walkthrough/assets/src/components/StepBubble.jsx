/**
 * The bubble that points at one walkthrough step's target.
 */
import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { __, sprintf } from '@wordpress/i18n';
import { bubbleWidth, computePosition } from '../utils/positioning';
import { findTarget, revealTarget } from '../utils/steps';

const prefersReducedMotion = () =>
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isRtl = () =>
	document.documentElement.dir === 'rtl' ||
	document.body.classList.contains('rtl');

const fixedChromeHeight = () => {
	const bar = document.getElementById('wpadminbar');
	if (!bar || window.getComputedStyle(bar).position !== 'fixed') {
		return 0;
	}
	return bar.getBoundingClientRect().bottom;
};

/**
 * Whether Escape belongs to another dialog (a modal, the media frame).
 *
 * @param {Element|null} bubble The walkthrough bubble.
 * @returns {boolean}
 */
const escapeBelongsElsewhere = (bubble) => {
	const active = bubble?.ownerDocument.activeElement;
	if (!active || (bubble && bubble.contains(active))) {
		return false;
	}
	return Boolean(
		active.closest('[role="dialog"], [role="alertdialog"], .media-modal')
	);
};

/**
 * @param {Object}   props
 * @param {Object}   props.step       Step definition.
 * @param {number}   props.index      Zero-based step position.
 * @param {number}   props.total      Number of steps in the run.
 * @param {boolean}  props.deferred   Whether the `place` steps wait for a save.
 * @param {() => void} props.onBack     Previous step.
 * @param {() => void} props.onNext     Next step, or finish on the last one.
 * @param {() => void} props.onSkip     Close the tour.
 * @param {() => void} props.onMissing  The target could not be found.
 * @returns {JSX.Element|null}
 */
const StepBubble = ({
	step,
	index,
	total,
	deferred,
	onBack,
	onNext,
	onSkip,
	onMissing,
}) => {
	const [target, setTarget] = useState(null);
	const [position, setPosition] = useState(null);
	const bubbleRef = useRef(null);
	const titleRef = useRef(null);
	const focusedRef = useRef(false);

	const isLast = index === total - 1;
	const titleId = `fotogrids-walkthrough-title-${step.id}`;
	const bodyId = `fotogrids-walkthrough-body-${step.id}`;

	useEffect(() => {
		let cancelled = false;
		setTarget(null);
		setPosition(null);
		focusedRef.current = false;

		revealTarget(step).then((el) => {
			if (cancelled) {
				return;
			}
			if (!el) {
				onMissing();
				return;
			}
			el.scrollIntoView({
				block: 'center',
				inline: 'nearest',
				behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			});
			setTarget(el);
		});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step]);

	const update = useCallback(() => {
		let el = target;
		if (el && !el.isConnected) {
			el = findTarget(step);
			if (!el) {
				onMissing();
				return;
			}
			setTarget(el);
		}
		if (!el || !bubbleRef.current) {
			return;
		}
		const rect = el.getBoundingClientRect();
		const bubbleRect = bubbleRef.current.getBoundingClientRect();
		const next = computePosition({
			target: rect,
			bubble: { width: bubbleRect.width, height: bubbleRect.height },
			viewport: {
				width: document.documentElement.clientWidth,
				height: window.innerHeight,
				top: fixedChromeHeight(),
			},
			rtl: isRtl(),
		});
		setPosition((prev) =>
			prev &&
			prev.top === next.top &&
			prev.left === next.left &&
			prev.placement === next.placement &&
			prev.arrow === next.arrow &&
			prev.rect &&
			prev.rect.top === rect.top &&
			prev.rect.left === rect.left &&
			prev.rect.width === rect.width &&
			prev.rect.height === rect.height
				? prev
				: {
						...next,
						rect: {
							top: rect.top,
							left: rect.left,
							width: rect.width,
							height: rect.height,
						},
					}
		);
	}, [target, step, onMissing]);

	useLayoutEffect(() => {
		if (!target) {
			return undefined;
		}
		update();

		let frame = 0;
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(update);
		};
		window.addEventListener('scroll', schedule, true);
		window.addEventListener('resize', schedule);

		const resizeObserver =
			typeof ResizeObserver === 'function'
				? new ResizeObserver(schedule)
				: null;
		if (resizeObserver) {
			resizeObserver.observe(target);
			if (bubbleRef.current) {
				resizeObserver.observe(bubbleRef.current);
			}
		}
		const mutationObserver = new MutationObserver(schedule);
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule, true);
			window.removeEventListener('resize', schedule);
			resizeObserver?.disconnect();
			mutationObserver.disconnect();
		};
	}, [target, update]);

	useEffect(() => {
		if (position && !focusedRef.current && titleRef.current) {
			focusedRef.current = true;
			titleRef.current.focus({ preventScroll: true });
		}
	}, [position]);

	useEffect(() => {
		const onKeyDown = (event) => {
			if (event.key !== 'Escape' || event.defaultPrevented) {
				return;
			}
			if (escapeBelongsElsewhere(bubbleRef.current)) {
				return;
			}
			event.preventDefault();
			onSkip();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [onSkip]);

	if (!target) {
		return null;
	}

	const width = bubbleWidth(document.documentElement.clientWidth);
	const body =
		deferred && step.deferredBody
			? `${step.body} ${step.deferredBody}`
			: step.body;
	const nextLabel = isLast
		? deferred
			? __('Got it', 'fotogrids')
			: __('Done', 'fotogrids')
		: __('Next', 'fotogrids');

	const ring = position?.rect && (
		<div
			className="fotogrids-walkthrough-spotlight"
			aria-hidden="true"
			style={{
				top: position.rect.top - 4,
				left: position.rect.left - 4,
				width: position.rect.width + 8,
				height: position.rect.height + 8,
			}}
		/>
	);

	return createPortal(
		<>
			{ring}
			<div
				ref={bubbleRef}
				className={`fotogrids-walkthrough-bubble${position ? ' is-placed' : ''}`}
				role="dialog"
				aria-modal="false"
				aria-labelledby={titleId}
				aria-describedby={bodyId}
				data-placement={position?.placement || 'below'}
				data-step={step.id}
				style={{
					width,
					top: position ? position.top : -9999,
					left: position ? position.left : -9999,
					'--fotogrids-walkthrough-arrow': `${position ? position.arrow : 24}px`,
				}}
			>
				<p className="fotogrids-walkthrough-bubble__count">
					{sprintf(
						/* translators: 1: current step number, 2: number of steps. */
						__('Step %1$d of %2$d', 'fotogrids'),
						index + 1,
						total
					)}
				</p>
				<h2
					ref={titleRef}
					id={titleId}
					className="fotogrids-walkthrough-bubble__title"
					tabIndex={-1}
				>
					{step.title}
				</h2>
				<p id={bodyId} className="fotogrids-walkthrough-bubble__body">
					{body}
				</p>
				<div className="fotogrids-walkthrough-bubble__actions">
					<button
						type="button"
						className="fg-button fg-button--variant-link fg-button--size-sm fotogrids-walkthrough-bubble__skip"
						onClick={onSkip}
					>
						{__('Skip tour', 'fotogrids')}
					</button>
					<div className="fotogrids-walkthrough-bubble__nav">
						{index > 0 && (
							<button
								type="button"
								className="fg-button fg-button--variant-secondary fg-button--size-sm fotogrids-walkthrough-bubble__back"
								onClick={onBack}
							>
								{__('Back', 'fotogrids')}
							</button>
						)}
						<button
							type="button"
							className="fg-button fg-button--variant-primary fg-button--size-sm fotogrids-walkthrough-bubble__next"
							onClick={onNext}
						>
							{nextLabel}
						</button>
					</div>
				</div>
			</div>
		</>,
		document.body
	);
};

export default StepBubble;
