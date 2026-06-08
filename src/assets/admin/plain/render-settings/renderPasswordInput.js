/**
 * Password Input Component
 *
 * Renders the gallery password field in the collection settings panel.
 *
 * Behaviour
 * ---------
 * - When no password has been saved (passwordIsSet=false): renders a standard
 *   password input. The eye button toggles visibility of what the user is
 *   currently typing - nothing is fetched from the server.
 *
 * - When a password IS already saved (passwordIsSet=true): the input starts
 *   empty with a "Password saved - type to change" placeholder. The eye button
 *   fires a one-time GET /gallery/{id}/password REST call to retrieve the
 *   decrypted value (permission-gated on the server). On success the decrypted
 *   password is shown in the input and the eye button works on that local value
 *   for subsequent toggles. On permission denial (403) a small inline message
 *   is shown instead.
 *
 * - If the user types anything: the new value is treated as a replacement
 *   password and saved on the next settings save. Clearing the field and saving
 *   removes password protection.
 *
 * Props received via the render-settings framework
 * ------------------------------------------------
 * setting        - the JSON setting definition (key, label, placeholder, …)
 * value          - current field value from React state (always '' for saved passwords)
 * onChange       - callback to update parent state
 * isDisabled     - whether the field is locked/grayed out
 * getFieldState  - returns 'editable' | 'locked' | 'pro'
 * renderIcon     - renders an icon by name string
 * __             - i18n function
 * postId         - gallery post ID (needed for the REST call)
 * restUrl        - base REST URL, e.g. https://example.com/wp-json/fotogrids/v1/
 * restNonce      - wp_rest nonce for authenticating REST requests
 * passwordIsSet  - boolean; true when an encrypted password already exists in DB
 */
const PasswordInputComponent = ({
    setting,
    value,
    onChange,
    isDisabled,
    getFieldState,
    renderIcon,
    __,
    postId,
    restUrl,
    restNonce,
    passwordIsSet,
}) => {
    // Whether the input is currently showing plaintext vs masked.
    const [showPassword, setShowPassword] = React.useState(false);

    // Tracks the fetch lifecycle for the server-side reveal:
    //   'idle'     - not yet attempted
    //   'loading'  - request in flight
    //   'done'     - successfully fetched; revealePassword holds the value
    //   'denied'   - server returned 403 (permission denied)
    //   'error'    - other network/server error
    const [revealState, setRevealState] = React.useState('idle');
    const [revealedPassword, setRevealedPassword] = React.useState('');

    // Track whether the user has actually typed in this field during the current
    // session using a ref that is only set by handleChange, never by prop updates.
    // This is more reliable than `value !== ''` because a stale encrypted blob
    // could leak into `value` through the PHP→JS localization path if the
    // server-side guard were ever bypassed - we never want to show that blob.
    const userHasTypedRef = React.useRef(false);

    const settingState = typeof getFieldState === 'function'
        ? getFieldState(setting.key, value)
        : 'editable';
    const showSettingBadge = settingState !== 'editable';
    const settingBadgeText = settingState === 'locked'
        ? __('Locked', 'fotogrids')
        : __('Pro', 'fotogrids');

    // The effective value shown in the input:
    // - If the user has typed something this session: use `value` (from parent state).
    // - If we fetched the saved password: use revealedPassword.
    // - Otherwise: empty (placeholder is shown instead).
    const hasUserTyped = userHasTypedRef.current;
    const displayValue = hasUserTyped
        ? value
        : ( revealState === 'done' ? revealedPassword : '' );

    const isSavedAndUnchanged = passwordIsSet && !hasUserTyped && revealState !== 'done';

    // Placeholder depends on whether a password is already saved. When one is
    // saved we show a FIXED-WIDTH dot mask rather than the real character count
    // - revealing the true length would shrink an attacker's brute-force space,
    // and this field is visible to every gallery editor (a wider audience than
    // the permission-gated eye-reveal). The dot count is intentionally constant.
    const SAVED_PASSWORD_MASK = '••••••••';
    const placeholder = isSavedAndUnchanged
        ? SAVED_PASSWORD_MASK
        : ( setting.placeholder || '' );

    // Eye-button handler.
    const handleEyeClick = async () => {
        if (isDisabled) return;

        // If the user has already typed something, or no saved password exists,
        // just toggle visibility locally - nothing to fetch.
        if (hasUserTyped || !passwordIsSet) {
            setShowPassword(prev => !prev);
            return;
        }

        // If we already fetched the password, toggle visibility locally.
        if (revealState === 'done') {
            setShowPassword(prev => !prev);
            return;
        }

        // First click when a saved password exists and hasn't been fetched yet.
        if (revealState !== 'loading') {
            setRevealState('loading');
            try {
                const url = `${restUrl}gallery/${postId}/password`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'X-WP-Nonce': restNonce,
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin',
                });

                if (response.status === 403) {
                    setRevealState('denied');
                    return;
                }

                if (!response.ok) {
                    setRevealState('error');
                    return;
                }

                const data = await response.json();
                setRevealedPassword(data.password || '');
                setRevealState('done');
                setShowPassword(true);
            } catch (_err) {
                setRevealState('error');
            }
        }
    };

    // When the user types, mark that they've actively edited the field so we
    // never fall back to the reveal-on-eye-click path for subsequent toggles.
    const handleChange = (newValue) => {
        if (!isDisabled) {
            userHasTypedRef.current = true;
            onChange(newValue);
            if (newValue === '' && revealState === 'done') {
                // User cleared the revealed password. Reset the reveal UI state
                // so the eye button and placeholder behave correctly, but keep
                // userHasTypedRef = true so the empty value is sent on the next
                // save and actually deletes the stored password.
                setRevealedPassword('');
                setRevealState('idle');
                setShowPassword(false);
            }
        }
    };

    // Choose the eye icon based on show/hide state and fetch state.
    const iconName = revealState === 'loading'
        ? 'spinner'
        : ( showPassword ? 'eye_off' : 'eye' );
    const iconElement = renderIcon ? renderIcon(iconName) : null;

    // Tooltip label for the eye button. Kept in sync with show/hide state.
    const toggleLabel = showPassword
        ? __('Hide password', 'fotogrids')
        : __('Show password', 'fotogrids');

    // Bind the shared FgTooltip to the eye button once it mounts. The button
    // mounts after FgTooltip.init()'s first declarative pass, so we bind
    // imperatively via a ref. FgTooltip.bind reads aria-label, which we keep
    // current on every render; refresh() updates an already-visible tooltip
    // after the label flips on toggle.
    const toggleRef = React.useCallback((node) => {
        if (node && window.FgTooltip) {
            if (node.dataset.fgTooltipBound !== '1') {
                window.FgTooltip.bind(node);
            } else {
                window.FgTooltip.refresh(node);
            }
        }
    }, [toggleLabel]);

    // Inline message shown when permission is denied.
    let revealMessage = null;
    if (revealState === 'denied') {
        revealMessage = React.createElement('p', {
            className: 'fotogrids-password-input__denied',
        }, __('You don\'t have permission to view saved passwords.', 'fotogrids'));
    } else if (revealState === 'error') {
        revealMessage = React.createElement('p', {
            className: 'fotogrids-password-input__denied',
        }, __('Could not retrieve the saved password. Please try again.', 'fotogrids'));
    }

    return React.createElement('div', {
        className: 'fotogrids-password-input',
    }, [
        React.createElement('label', {
            key: 'label',
            className: 'fotogrids-setting__label',
        }, [
            setting.label,
            showSettingBadge && React.createElement('span', {
                className: 'fotogrids-pro-badge',
                key: 'pro-badge',
            }, settingBadgeText),
        ].filter(Boolean)),

        React.createElement('div', {
            key: 'wrapper',
            className: 'fotogrids-password-input__wrapper',
        }, [
            React.createElement('input', {
                key: 'input',
                type: showPassword ? 'text' : 'password',
                value: displayValue,
                onChange: (e) => handleChange(e.target.value),
                disabled: isDisabled,
                className: 'fotogrids-input',
                placeholder,
                autoComplete: 'new-password',
            }),
            React.createElement('button', {
                key: 'toggle',
                ref: toggleRef,
                type: 'button',
                className: 'fotogrids-password-input__toggle',
                onClick: handleEyeClick,
                disabled: isDisabled || revealState === 'loading',
                'aria-label': toggleLabel,
                'data-fg-tooltip': toggleLabel,
            }, iconElement),
        ]),

        revealMessage && React.createElement('div', {
            key: 'reveal-message',
        }, revealMessage),
    ].filter(Boolean));
};

window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderPasswordInput = (setting, currentValue, isDisabled, {
    updateSetting,
    getFieldState,
    renderIcon,
    __,
    postId,
    restUrl,
    restNonce,
    passwordIsSet,
}) => {
    return React.createElement(PasswordInputComponent, {
        setting,
        value: currentValue,
        onChange: (value) => updateSetting(setting.key, value),
        isDisabled,
        getFieldState,
        renderIcon,
        __,
        postId,
        restUrl,
        restNonce,
        passwordIsSet: !!passwordIsSet,
    });
};
