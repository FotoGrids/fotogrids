import React from 'react';

/**
 * Animated FotoGrids mark, used as the admin loading indicator.
 *
 * The five brand bars wipe away and redraw in turn. The animation is CSS
 * transforms on plain elements rather than SVG (SMIL) or animated geometry,
 * because a loading indicator has to keep moving while the main thread is busy
 * downloading and parsing the admin bundles - which is exactly the wait it
 * covers. Transform animations run on the compositor and survive that; SMIL
 * and anything that triggers layout do not.
 *
 * Styles, including the `prefers-reduced-motion` rule that stops the bars,
 * live in `styles/loading-screen.scss`.
 *
 * Props
 * ----
 * - size:      number | string - width of the mark, which is square. A number
 *                                becomes a `px` value; a string is passed
 *                                through verbatim. Defaults to 40.
 * - label:     string - accessible name. Omit it when adjacent text already
 *                       announces the loading state; the mark is then hidden
 *                       from assistive technology.
 * - className - passed through to the root element.
 */

const BARS = [1, 2, 3, 4, 5];

const LoadingIcon = ({ size = 40, label, className = '', ...rest }) => {
	const dim = typeof size === 'number' ? `${size}px` : size;

	return (
		<span
			className={`fotogrids-loading-mark ${className}`.trim()}
			style={{ width: dim }}
			role={label ? 'img' : undefined}
			aria-label={label || undefined}
			aria-hidden={label ? undefined : 'true'}
			{...rest}
		>
			{BARS.map((bar) => (
				<span
					key={bar}
					className={`fotogrids-loading-mark__bar fotogrids-loading-mark__bar--${bar}`}
				/>
			))}
		</span>
	);
};

export default LoadingIcon;
