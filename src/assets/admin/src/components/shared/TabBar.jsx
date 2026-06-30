import React from 'react';
import Icon from './Icon.jsx';

/**
 * TabBar - a horizontal tab strip for switching between named panels.
 *
 * Renders a `role="tablist"` container with one `role="tab"` button per entry.
 * The active tab receives `aria-selected="true"` and the `fg-is-active`
 * modifier, matching the convention used across the admin UI.
 *
 * @param {Object}   props
 * @param {Array}    props.tabs           [{ id: string, label: string, icon?: string }]
 *                                        `icon` is a FotoGridsIcons name - renders left of the label.
 * @param {string}   props.activeTab      The `id` of the currently active tab.
 * @param {Function} props.onTabChange    Called with the tab `id` when a tab is clicked.
 * @param {string}   [props.className]    Extra class(es) on the wrapper element.
 */
const TabBar = ( {
    tabs        = [],
    activeTab,
    onTabChange,
    className   = '',
} ) => {
    const wrapperClass = [ 'fotogrids-tab-bar', className ]
        .filter( Boolean )
        .join( ' ' );

    return (
        <div className={ wrapperClass } role="tablist">
            { tabs.map( ( tab ) => (
                <button
                    key={ tab.id }
                    type="button"
                    role="tab"
                    aria-selected={ activeTab === tab.id }
                    className={
                        'fotogrids-tab-bar__tab' +
                        ( activeTab === tab.id ? ' fg-is-active' : '' )
                    }
                    onClick={ () => onTabChange( tab.id ) }
                >
                    { tab.icon && (
                        <Icon name={ tab.icon } className="fotogrids-tab-bar__icon" />
                    ) }
                    { tab.label }
                </button>
            ) ) }
        </div>
    );
};

export default TabBar;
