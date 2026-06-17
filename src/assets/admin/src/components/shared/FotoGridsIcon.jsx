import React from 'react';

/**
 * FotoGrids brand icon - the 5-rect mark as a self-contained SVG
 * component. Distinct from the runtime-driven `<Icon name="…">`
 * (a sibling in this directory) which renders any icon from the
 * `window.FotoGridsIcons` payload; `FotoGridsIcon` is specifically the
 * fixed brand mark, hand-rolled so it never has to depend on the
 * icons JS payload being loaded.
 *
 * Default-sized for chrome surfaces (modal headers, admin headers) at
 * 20×20 but scales cleanly to any dimension because the viewBox is
 * fixed at 0 0 60 60.
 *
 * Props
 * ----
 * - size:    number | string - applied to both width and height. Number
 *                              becomes a `px` value; string is passed
 *                              through verbatim (so `'2em'`, `'100%'`,
 *                              etc. all work). Defaults to 20.
 * - variant: 'full' | 'mono' - `full` uses the canonical brand colours
 *                              (the orange / red / yellow / dark / blue
 *                              mix); `mono` makes every rect use
 *                              `currentColor` so the surrounding text
 *                              colour drives tone. Use mono for
 *                              greyscale UI, white-on-dark surfaces,
 *                              accessibility printouts, etc. - set
 *                              `color: …` on the parent and the logo
 *                              follows. Defaults to `full`.
 * - className - passed through to the root `<svg>`. Useful for surface-
 *               specific positional tweaks (margin, flex-shrink, …)
 *               without redefining sizing.
 *
 * Brand colours are kept as literal hex values inside the component
 * because the brand-core CSS variables aren't reliably available on
 * every surface this can render in (e.g. the Elementor preview iframe
 * loads only the page-builder bundle).
 */

const COLORS = {
    top:         '#3c46f0', // primary blue
    midLeft:     '#f01e32', // red
    bottomLeft:  '#ffb914', // yellow
    bottomMid:   '#323232', // dark
    midRight:    '#323232', // dark
};

const FotoGridsIcon = ({
    size = 20,
    variant = 'full',
    className,
    ...rest
}) => {
    const dim = typeof size === 'number' ? `${ size }` : size;
    const fill = variant === 'mono' ? 'currentColor' : null;

    const f = (key) => (fill !== null ? fill : COLORS[ key ]);

    return (
        <svg
            width={ dim }
            height={ dim }
            viewBox="0 0 60 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            className={ className }
            { ...rest }
        >
            <rect x="1.42"  y="1.42"  width="56.69" height="14.17" fill={ f('top') } />
            <rect x="1.42"  y="22.68" width="35.43" height="14.17" fill={ f('midLeft') } />
            <rect x="1.42"  y="43.94" width="14.17" height="14.17" fill={ f('bottomLeft') } />
            <rect x="22.68" y="43.94" width="14.17" height="14.17" fill={ f('bottomMid') } />
            <rect x="43.94" y="22.68" width="14.17" height="35.43" fill={ f('midRight') } />
        </svg>
    );
};

export default FotoGridsIcon;
