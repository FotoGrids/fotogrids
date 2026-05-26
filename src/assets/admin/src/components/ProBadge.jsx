import Tooltip from './Tooltip';

/**
 * Maps the tier_required JSON value to a human-readable plan label.
 *
 * @param {string} tier  Value from the settings JSON (e.g. "pro_starter").
 * @returns {string}
 */
const tierLabel = ( tier ) => {
    switch ( tier ) {
        case 'pro_starter': return 'Pro Starter';
        case 'pro_plus':    return 'Pro Plus';
        case 'agency':      return 'Agency';
        default:            return 'Pro';
    }
};

/**
 * Lock icon SVG - inline so there is no extra HTTP request.
 */
const LockIcon = () => (
    <svg
        className="fg-pro-badge__lock-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="10"
        height="10"
        aria-hidden="true"
        focusable="false"
    >
        <path
            fill="currentColor"
            d="M11 7V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1ZM6 5a2 2 0 1 1 4 0v2H6V5Z"
        />
    </svg>
);

/**
 * A small lock badge that shows a "Available from <Plan>" tooltip on hover.
 *
 * For React admin pages - import and use directly.
 * For vanilla render helpers - use window.FotoGridsTooltip.ProBadge() instead.
 *
 * @param {object}  props
 * @param {string}  props.tier   tier_required value from settings JSON
 *                               ("pro_starter" | "pro_plus" | "agency").
 * @param {string}  [props.state]  "teaser" | "locked" (reserved for future copy variants).
 * @param {string}  [props.position]  Tooltip position, forwarded to <Tooltip>.
 */
const ProBadge = ( { tier, state, position = 'top' } ) => {
    // Never render for free-tier options.
    if ( ! tier || tier === 'free' ) {
        return null;
    }

    const label = tierLabel( tier );
    const tooltipContent = state === 'locked'
        ? `Renew your ${ label } plan to unlock this feature`
        : `Available from ${ label } plan`;

    return (
        <Tooltip content={ tooltipContent } position={ position }>
            <span className="fg-pro-badge" aria-label={ tooltipContent }>
                <LockIcon />
            </span>
        </Tooltip>
    );
};

export default ProBadge;
