/**
 * Shared StatsTable component.
 *
 * Props:
 *   title    - Section heading string
 *   columns  - Array of { key, label, render? }
 *              key     - property name on each row object
 *              label   - column header text
 *              render  - optional (value, row) => ReactNode
 *   rows     - Array of row objects
 *   loading  - bool; shows skeleton rows when true
 *   emptyMsg - string shown when rows is empty and not loading
 */
import React from 'react';

const { __ } = wp.i18n;

const SKELETON_ROWS = 5;

const StatsTable = ( { title, columns, rows, loading, emptyMsg } ) => {
    const baseClass = 'fg-stats-table';
    const getColClassName = ( col, type ) => {
        const classes = [ `${baseClass}__${ type }` ];

        if ( col.align === 'center' ) {
            classes.push( `${baseClass}__${ type }--center` );
        }

        if ( col.ellipsis ) {
            classes.push( `${baseClass}__${ type }--ellipsis` );
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

        if ( ! rows || rows.length === 0 ) {
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

        return rows.map( ( row, i ) => (
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
                            { columns.map( ( col ) => (
                                <th key={ col.key } className={ getColClassName( col, 'th' ) } scope="col">
                                    { col.label }
                                </th>
                            ) ) }
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
