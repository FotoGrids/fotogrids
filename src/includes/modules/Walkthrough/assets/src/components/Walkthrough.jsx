/**
 * Runs the walkthrough for the current screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import StepBubble from './StepBubble';
import { planSteps, waitFor } from '../utils/steps';
import { saveState } from '../utils/api';

export const START_EVENT = 'fotogrids:walkthrough:start';
const READY_TIMEOUT = 10000;
const SETTLE_MS = 300;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const modalApi = () => window.FotoGridsAdmin?.modal || null;

/**
 * @param {Object} props
 * @param {Object} props.tour   Tour definition for this screen.
 * @param {Object} props.config Localised walkthrough data.
 * @returns {JSX.Element}
 */
const Walkthrough = ({ tour, config }) => {
	const [run, setRun] = useState(null);
	const [announcement, setAnnouncement] = useState('');
	const runningRef = useRef(false);
	const returnFocusRef = useRef(null);
	const pendingSavedRef = useRef(false);
	const directionRef = useRef(1);
	const liveRef = useRef(null);

	const close = useCallback(() => {
		runningRef.current = false;
		setRun(null);
		setAnnouncement('');
		const back = returnFocusRef.current;
		returnFocusRef.current = null;
		if (back && back.isConnected && typeof back.focus === 'function') {
			back.focus({ preventScroll: true });
		}
	}, []);

	const begin = useCallback(
		async ({ mode, intro }) => {
			if (runningRef.current) {
				return;
			}
			runningRef.current = true;
			returnFocusRef.current =
				liveRef.current?.ownerDocument.activeElement || null;

			await waitFor(
				() => document.querySelector(tour.ready),
				READY_TIMEOUT
			);
			await sleep(SETTLE_MS);

			const plan = planSteps(tour.steps, { mode });
			if (plan.steps.length === 0) {
				runningRef.current = false;
				return;
			}

			const modal = modalApi();
			if (intro && modal?.question) {
				const copy = tour.intro(plan.steps.length);
				const start = await modal.question({
					title: copy.title,
					message: copy.message,
					confirmLabel: __('Start the tour', 'fotogrids'),
					cancelLabel: __('Not now', 'fotogrids'),
				});
				if (!start) {
					saveState(config.tour, 'skipped', config);
					close();
					return;
				}
			}

			pendingSavedRef.current = false;
			directionRef.current = 1;
			setRun({ steps: plan.steps, deferred: plan.deferred, index: 0 });
		},
		[tour, config, close]
	);

	useEffect(() => {
		const onStart = () => begin({ mode: 'full', intro: false });
		document.addEventListener(START_EVENT, onStart);

		if (config.forced || config.autoStart) {
			begin({ mode: 'full', intro: true });
		} else if (config.resume) {
			begin({ mode: 'resume', intro: false });
		}

		return () => document.removeEventListener(START_EVENT, onStart);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const step = run ? run.steps[run.index] : null;

	useEffect(() => {
		if (!run || !step) {
			return;
		}
		setAnnouncement(
			sprintf(
				/* translators: 1: current step number, 2: number of steps, 3: step title. */
				__('Step %1$d of %2$d: %3$s', 'fotogrids'),
				run.index + 1,
				run.steps.length,
				step.title
			)
		);
		if (run.deferred && step.deferredBody && !pendingSavedRef.current) {
			pendingSavedRef.current = true;
			saveState(config.tour, 'publish-pending', config);
		}
	}, [run, step, config]);

	const finish = useCallback(() => {
		const deferred = run?.deferred;
		close();
		if (deferred) {
			if (!pendingSavedRef.current) {
				pendingSavedRef.current = true;
				saveState(config.tour, 'publish-pending', config);
			}
			return;
		}
		saveState(config.tour, 'done', config);
		const modal = modalApi();
		if (modal?.success && tour.finish) {
			modal.success({
				title: tour.finish.title,
				message: tour.finish.message,
			});
		}
	}, [run, close, config, tour]);

	const goTo = useCallback((delta) => {
		directionRef.current = delta;
		setRun((current) => {
			if (!current) {
				return current;
			}
			const index = current.index + delta;
			if (index < 0) {
				return { ...current, index: 0 };
			}
			return { ...current, index };
		});
	}, []);

	const onNext = useCallback(() => {
		if (run && run.index >= run.steps.length - 1) {
			finish();
			return;
		}
		goTo(1);
	}, [run, finish, goTo]);

	const onBack = useCallback(() => goTo(-1), [goTo]);

	const onSkip = useCallback(() => {
		saveState(config.tour, 'skipped', config);
		close();
	}, [config, close]);

	const onMissing = useCallback(() => {
		if (!run) {
			return;
		}
		const steps = run.steps.filter((_, i) => i !== run.index);
		if (steps.length === 0) {
			close();
			return;
		}
		if (directionRef.current < 0) {
			setRun({ ...run, steps, index: Math.max(0, run.index - 1) });
			return;
		}
		if (run.index >= steps.length) {
			finish();
			return;
		}
		setRun({ ...run, steps });
	}, [run, close, finish]);

	return (
		<>
			<div
				ref={liveRef}
				className="screen-reader-text"
				aria-live="polite"
				aria-atomic="true"
			>
				{announcement}
			</div>
			{step && (
				<StepBubble
					key={`${step.id}-${run.index}`}
					step={step}
					index={run.index}
					total={run.steps.length}
					deferred={run.deferred}
					onBack={onBack}
					onNext={onNext}
					onSkip={onSkip}
					onMissing={onMissing}
				/>
			)}
		</>
	);
};

export default Walkthrough;
