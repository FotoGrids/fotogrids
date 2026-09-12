import React from 'react';

/**
 * Animated FotoGrids mark, used as the admin loading indicator.
 *
 * The five brand rects wipe away and redraw on a 3s loop, each one
 * staggered behind the last. Markup is hand-rolled rather than read from
 * `window.FotoGridsLoadingIcons`, whose payload is fetched asynchronously
 * and can therefore arrive after the moment a loading indicator is needed.
 *
 * Props
 * ----
 * - size:      number | string - width and height. A number becomes a `px`
 *                                value; a string is passed through verbatim.
 *                                Defaults to 40.
 * - label:     string - accessible name. Omit it when adjacent text already
 *                       announces the loading state; the icon is then hidden
 *                       from assistive technology.
 * - className - passed through to the root `<svg>`.
 *
 * Under `prefers-reduced-motion` the mark renders as its static first frame.
 * SMIL animation cannot be stopped from CSS, so the preference is read here.
 */

// The three horizontal bars wipe out to the right and redraw from the left;
// the two vertical bars collapse downwards and redraw from the bottom. The
// key times leave only a short rest at the end of each cycle, so a loader that
// is only on screen for a moment is visibly moving the whole time.
const BARS = [
	{
		x: 0,
		y: 0,
		width: 115,
		height: 29,
		axis: 'width',
		keyTimes: '0;0.03;0.251;0.528;0.749;1',
	},
	{
		x: 0,
		y: 43,
		width: 72,
		height: 29,
		axis: 'width',
		keyTimes: '0;0.085;0.306;0.583;0.804;1',
	},
	{
		x: 0,
		y: 86,
		width: 29,
		height: 29,
		axis: 'width',
		keyTimes: '0;0.14;0.334;0.638;0.832;1',
	},
	{
		x: 43,
		y: 86,
		width: 29,
		height: 29,
		axis: 'height',
		keyTimes: '0;0.196;0.389;0.694;0.887;1',
		opacity: 0.7,
	},
	{
		x: 86,
		y: 43,
		width: 29,
		height: 72,
		axis: 'height',
		keyTimes: '0;0.251;0.472;0.749;0.97;1',
		opacity: 0.7,
	},
];

// One cycle of the mark. Shorter than the source asset so the loader reads as
// moving even when it is on screen briefly.
const DURATION = '1.8s';

const prefersReducedMotion = () =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const barAnimation = (bar) => {
	const horizontal = 'width' === bar.axis;
	const span = horizontal ? bar.width : bar.height;
	const start = horizontal ? bar.x : bar.y;
	const end = start + span;

	return {
		spanValues: `${span};${span};0;0;${span};${span}`,
		originAxis: horizontal ? 'x' : 'y',
		originValues: horizontal
			? `${start};${start};${end};${start};${start};${start}`
			: `${start};${start};${end};${end};${start};${start}`,
	};
};

const LoadingIcon = ({ size = 40, label, className, ...rest }) => {
	const dim = typeof size === 'number' ? `${size}` : size;
	const animated = !prefersReducedMotion();

	return (
		<svg
			width={dim}
			height={dim}
			viewBox="0 0 131 131"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label={label || undefined}
			aria-hidden={label ? undefined : 'true'}
			focusable="false"
			className={className}
			{...rest}
		>
			<g transform="translate(8,8)">
				{BARS.map((bar) => {
					const { spanValues, originAxis, originValues } =
						barAnimation(bar);

					return (
						<rect
							key={`${bar.x}-${bar.y}`}
							x={bar.x}
							y={bar.y}
							width={bar.width}
							height={bar.height}
							opacity={bar.opacity}
						>
							{animated && (
								<>
									<animate
										attributeName={bar.axis}
										dur={DURATION}
										repeatCount="indefinite"
										keyTimes={bar.keyTimes}
										values={spanValues}
									/>
									<animate
										attributeName={originAxis}
										dur={DURATION}
										repeatCount="indefinite"
										keyTimes={bar.keyTimes}
										values={originValues}
									/>
								</>
							)}
						</rect>
					);
				})}
			</g>
		</svg>
	);
};

export default LoadingIcon;
