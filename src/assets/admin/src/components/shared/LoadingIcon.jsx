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
// the two vertical bars collapse downwards and redraw from the bottom.
const BARS = [
	{
		x: 0,
		y: 0,
		width: 115,
		height: 29,
		axis: 'width',
		keyTimes: '0;0.267;0.4;0.567;0.7;1',
	},
	{
		x: 0,
		y: 43,
		width: 72,
		height: 29,
		axis: 'width',
		keyTimes: '0;0.3;0.433;0.6;0.733;1',
	},
	{
		x: 0,
		y: 86,
		width: 29,
		height: 29,
		axis: 'width',
		keyTimes: '0;0.333;0.45;0.633;0.75;1',
	},
	{
		x: 43,
		y: 86,
		width: 29,
		height: 29,
		axis: 'height',
		keyTimes: '0;0.367;0.483;0.667;0.783;1',
		opacity: 0.7,
	},
	{
		x: 86,
		y: 43,
		width: 29,
		height: 72,
		axis: 'height',
		keyTimes: '0;0.4;0.533;0.7;0.833;1',
		opacity: 0.7,
	},
];

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
										dur="3s"
										repeatCount="indefinite"
										keyTimes={bar.keyTimes}
										values={spanValues}
									/>
									<animate
										attributeName={originAxis}
										dur="3s"
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
