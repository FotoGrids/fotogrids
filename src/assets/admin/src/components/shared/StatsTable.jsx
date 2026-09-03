/**
 * Shared StatsTable component.
 *
 * Props:
 *   title    - Section heading string
 *   columns  - Array of { key, label, render?, modifier? }
 *              key      - property name on each row object
 *              label    - column header text
 *              render   - optional (value, row) => ReactNode
 *              modifier - optional BEM modifier suffix for the th and cell
 *              sortable - optional bool; makes the column header a sort control
 *              sortValue - optional (row) => comparable, when the raw cell
 *                          value is not what should be sorted on
 *   rows     - Array of row objects
 *   loading  - bool; shows skeleton rows when true
 *   emptyMsg - string shown when rows is empty and not loading
 *   defaultSort - optional { key, direction }; the order rows arrive in, so the
 *                 header reflects it before the user sorts anything
 */
import React, { useMemo, useState } from 'react';
import Icon from './Icon';

const { __, sprintf } = wp.i18n;

const SKELETON_ROWS = 5;

/**
 * Compare two cell values, ordering numbers numerically and text naturally.
 *
 * Empty values always sort last regardless of direction, so untitled or
 * never-viewed rows do not crowd the top of a descending sort.
 *
 * @param {*} a First value.
 * @param {*} b Second value.
 * @returns {number} Standard comparator result.
 */
const compareValues = ( a, b ) => {
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';

    if ( aEmpty || bEmpty ) return aEmpty && bEmpty ? 0 : ( aEmpty ? 1 : -1 );

    if ( typeof a === 'number' && typeof b === 'number' ) return a - b;

    return String( a ).localeCompare( String( b ), undefined, { numeric: true } );
};

const StatsTable = ( { title, columns, rows, loading, emptyMsg, defaultSort = null } ) => {
    const baseClass = 'fg-stats-table';
    const [ sort, setSort ] = useState( defaultSort );

    const sortedRows = useMemo( () => {
        if ( ! sort || ! Array.isArray( rows ) ) return rows;
        if ( defaultSort && sort.key === defaultSort.key && sort.direction === defaultSort.direction ) {
            return rows;
        }

        const col = columns.find( ( c ) => c.key === sort.key );
        if ( ! col ) return rows;

        const read = col.sortValue || ( ( row ) => row[ col.key ] );

        return [ ...rows ].sort( ( a, b ) => (
            sort.direction === 'asc'
                ? compareValues( read( a ), read( b ) )
                : compareValues( read( b ), read( a ) )
        ) );
    }, [ rows, columns, sort, defaultSort ] );

    const toggleSort = ( key ) => setSort( ( current ) => (
        current && current.key === key && current.direction === 'desc'
            ? { key, direction: 'asc' }
            : { key, direction: 'desc' }
    ) );
    const getColClassName = ( col, type ) => {
        const classes = [ `${baseClass}__${ type }` ];

        if ( col.align === 'center' ) {
            classes.push( `${baseClass}__${ type }--center` );
        }

        if ( col.ellipsis ) {
            classes.push( `${baseClass}__${ type }--ellipsis` );
        }

        if ( col.modifier ) {
            classes.push( `${baseClass}__${ type }--${ col.modifier }` );
        }

        return classes.join( ' ' );
    };

    const renderBody = () => {
        if ( loading ) {
            return Array.from( { length: SKELETON_ROWS } ).map( ( _, i ) => (
                <tr key={ i } className={`${baseClass}__row ${baseClass}__row--skeleton`}>
                    { columns.map( ( col ) => (
                        <td key={ col.key } className={ getColClassName( col, 'cell' ) }>
                            <span className="fg-skeleton-line" aria-hidden="true" />
                        </td>
                    ) ) }
                </tr>
            ) );
        }

        if ( ! sortedRows || sortedRows.length === 0 ) {
            return (
                <tr>
                    <td
                        colSpan={ columns.length }
                        className={`${baseClass}__cell ${baseClass}__cell--empty`}
                    >
                        { emptyMsg || __( 'No data available', 'fotogrids' ) }
                    </td>
                </tr>
            );
        }

        return sortedRows.map( ( row, i ) => (
            <tr
                key={ row.id != null ? `${ row.type }-${ row.id }` : i }
                className={`${baseClass}__row`}
            >
                { columns.map( ( col ) => (
                    <td key={ col.key } className={ getColClassName( col, 'cell' ) }>
                        { col.render ? col.render( row[ col.key ], row ) : row[ col.key ] }
                    </td>
                ) ) }
            </tr>
        ) );
    };

    return (
        <div className={`${baseClass}__container fg-stats-card`}>
            { title && <h3 className={`${baseClass}__title`}>{ title }</h3> }
            <div className={`${baseClass}__wrapper`}>
                <table className={`${baseClass} widefat striped`}>
                    <thead>
                        <tr>
                            { columns.map( ( col ) => {
                                const isSorted = !! sort && sort.key === col.key;
                                const ariaSort = isSorted
                                    ? ( sort.direction === 'asc' ? 'ascending' : 'descending' )
                                    : 'none';

                                return (
                                    <th
                                        key={ col.key }
                                        className={ getColClassName( col, 'th' ) }
                                        scope="col"
                                        aria-sort={ col.sortable ? ariaSort : undefined }
                                    >
                                        { col.sortable ? (
                                            <button
                                                type="button"
                                                className={ `${baseClass}__sort${ isSorted ? ` ${baseClass}__sort--active` : '' }` }
                                                onClick={ () => toggleSort( col.key ) }
                                                aria-label={ sprintf(
                                                    /* translators: %s: column name. */
                                                    __( 'Sort by %s', 'fotogrids' ),
                                                    col.label
                                                ) }
                                            >
                                                { col.label }
                                                <Icon
                                                    name={ isSorted ? 'arrow_down' : 'sort' }
                                                    className={ `${baseClass}__sort-arrow${ isSorted && sort.direction === 'asc' ? ` ${baseClass}__sort-arrow--asc` : '' }` }
                                                />
                                            </button>
                                        ) : col.label }
                                    </th>
                                );
                            } ) }
                        </tr>
                    </thead>
                    <tbody>
                        { renderBody() }
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StatsTable;
