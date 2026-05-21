import React from 'react';

/**
 * SettingsPanel — a card "block".
 *
 * A white surface with border + radius, an optional header (title +
 * description + optional action on the right), and a body. Multiple panels
 * stack to form a settings page, replacing the single flat content panel.
 *
 * @param {Object} props
 * @param {string|React.ReactNode} [props.title]       Panel heading.
 * @param {string|React.ReactNode} [props.description] Sub-text under the heading.
 * @param {React.ReactNode}        [props.action]      Right-aligned header action (e.g. a button).
 * @param {boolean}                [props.noBodyPadding] Drop the body padding (for tables/grids that pad themselves).
 * @param {string}                 [props.className]   Extra class on the root.
 * @param {React.ReactNode}        props.children      Panel body.
 */
const SettingsPanel = ({
    title,
    description,
    action,
    noBodyPadding = false,
    className = '',
    children,
}) => {
    const hasHeader = title || description || action;

    return (
        <section className={`fotogrids-settings-panel ${className}`.trim()}>
            {hasHeader && (
                <header className="fotogrids-settings-panel__head">
                    <div className="fotogrids-settings-panel__heading">
                        {title && (
                            <h2 className="fotogrids-settings-panel__title">{title}</h2>
                        )}
                        {description && (
                            <p className="fotogrids-settings-panel__description">{description}</p>
                        )}
                    </div>
                    {action && (
                        <div className="fotogrids-settings-panel__action">{action}</div>
                    )}
                </header>
            )}
            <div
                className={
                    'fotogrids-settings-panel__body' +
                    (noBodyPadding ? ' fotogrids-settings-panel__body--flush' : '')
                }
            >
                {children}
            </div>
        </section>
    );
};

export default SettingsPanel;
