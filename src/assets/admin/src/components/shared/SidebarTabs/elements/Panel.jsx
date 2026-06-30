import React from 'react';

/**
 * Panel - a generic card surface with an optional header and body.
 *
 * A white surface with border + radius, an optional header (title +
 * description + optional action on the right), and a padded body. Multiple
 * panels can stack to form any page section - settings tabs, tool UIs,
 * library views, etc.
 *
 * @param {Object}                 props
 * @param {string|React.ReactNode} [props.title]         Panel heading.
 * @param {string}                 [props.titleTag]      HTML tag used for the title (h1-h6, p, div, span).
 * @param {string|React.ReactNode} [props.description]   Sub-text under the heading.
 * @param {React.ReactNode}        [props.action]        Right-aligned header action (e.g. a button).
 * @param {boolean}                [props.noBody]        Omit the body wrapper; header-only panel.
 * @param {boolean}                [props.noBodyPadding] Drop the body padding (for tables/grids that pad themselves).
 * @param {boolean}                [props.bare]          Remove background, border, border-radius, and padding
 *                                                       entirely. Use when the parent already provides a surface
 *                                                       (e.g. inside a SidebarTabs content pane) and you just
 *                                                       need the stacking / spacing behaviour.
 * @param {string}                 [props.className]     Extra class on the root.
 * @param {React.ReactNode}        props.children        Panel body.
 */
const Panel = ({
    title,
    titleTag = 'h2',
    description,
    action,
    noBody = false,
    noBodyPadding = false,
    equalBodyPadding = false,
    longDescription = false,
    bare = false,
    className = '',
    children,
}) => {
    const hasHeader = title || description || action;
    const allowedTitleTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span']);
    const safeTitleTag = typeof titleTag === 'string' && allowedTitleTags.has(titleTag) ? titleTag : 'h2';
    const TitleTag = safeTitleTag;

    const baseClass = 'fotogrids-sidebar-layout__panel';

    const rootClass = [
        baseClass,
        bare ? `${baseClass}--bare` : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <section className={rootClass}>
            {hasHeader && (
                <header
                    className={[
                        `${baseClass}__head`,
                        noBody ? `${baseClass}__head--no-body` : '',
                    ].filter(Boolean).join(' ')}
                >
                    <div className={`${baseClass}__heading`}>
                        {title && (
                            <TitleTag className={`${baseClass}__title ${baseClass}__title--${safeTitleTag}`}>{title}</TitleTag>
                        )}
                        {description && (
                            <p className={`${baseClass}__description ${longDescription ? `${baseClass}__description--long` : ''}`}>{description}</p>
                        )}
                    </div>
                    {action && (
                        <div className={`${baseClass}__action`}>{action}</div>
                    )}
                </header>
            )}
            {!noBody && (
                <div
                    className={[
                        `${baseClass}__body`,
                        noBodyPadding ? `${baseClass}__body--flush` : '',
                        equalBodyPadding ? `${baseClass}__body--equal` : '',
                    ].filter(Boolean).join(' ')}
                >
                    {children}
                </div>
            )}
        </section>
    );
};

export default Panel;
