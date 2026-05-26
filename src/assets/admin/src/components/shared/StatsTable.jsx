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
    const renderBody = () => {
        if ( loading ) {
            return Array.from( { length: SKELETON_ROWS } ).map( ( _, i ) => (
                <tr key={ i } className="fg-stats-table__row fg-stats-table__row--skeleton">
                    { columns.map( ( col ) => (
                        <td key={ col.key } className="fg-stats-table__cell">
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
                        className="fg-stats-table__cell fg-stats-table__cell--empty"
                    >
                        { emptyMsg || __( 'No data available', 'fotogrids' ) }
                    </td>
                </tr>
            );
        }

        return rows.map( ( row, i ) => (
            <tr
                key={ row.id != null ? `${ row.type }-${ row.id }` : i }
                className="fg-stats-table__row"
            >
                { columns.map( ( col ) => (
                    <td key={ col.key } className="fg-stats-table__cell">
                        { col.render ? col.render( row[ col.key ], row ) : row[ col.key ] }
                    </td>
                ) ) }
            </tr>
        ) );
    };

    return (
        <div className="fg-stats-table-container">
            { title && <h3 className="fg-stats-table__title">{ title }</h3> }
            <div className="fg-stats-table__wrapper">
                <table className="fg-stats-table">
                    <thead>
                        <tr>
                            { columns.map( ( col ) => (
                                <th key={ col.key } className="fg-stats-table__th">
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
