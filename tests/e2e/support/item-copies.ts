import { wpEval } from './roles';

/**
 * Attachments a spec owns, made by copying a seeded one.
 *
 * Item text and link meta are stored per attachment, not per gallery, so a spec
 * that writes them works on copies. A copy points at the source's file; the
 * delete removes only the rows, never the file.
 */

export type ItemCopy = {
	title?: string;
	alt?: string;
	caption?: string;
	description?: string;
	/** Item meta columns, e.g. `external_url`, `link_target`. */
	meta?: Record<string, string>;
};

/** Copy `source` once per entry, applying that entry's fields. */
export function copyItems(source: number, copies: ItemCopy[]): number[] {
	const json = JSON.stringify(copies)
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'");

	return JSON.parse(
		wpEval(`
			$src  = ${source};
			$file = get_attached_file( $src );
			$meta = wp_get_attachment_metadata( $src );
			$ids  = array();
			foreach ( json_decode( '${json}', true ) as $copy ) {
				$id = wp_insert_attachment( array(
					'post_mime_type' => get_post_mime_type( $src ),
					'post_title'     => (string) ( $copy['title'] ?? '' ),
					'post_excerpt'   => (string) ( $copy['caption'] ?? '' ),
					'post_content'   => (string) ( $copy['description'] ?? '' ),
					'post_status'    => 'inherit',
				), $file );
				wp_update_attachment_metadata( $id, $meta );
				if ( isset( $copy['alt'] ) ) {
					update_post_meta( $id, '_wp_attachment_image_alt', $copy['alt'] );
				}
				if ( ! empty( $copy['meta'] ) ) {
					\\FotoGrids\\Galleries\\Item_Meta::save( $id, $copy['meta'] );
				}
				$ids[] = (int) $id;
			}
			echo wp_json_encode( $ids );
		`).trim()
	);
}

/** Remove copies' rows, leaving the shared file on disk. */
export function deleteItems(ids: number[]): void {
	if (!ids.length) {
		return;
	}

	wpEval(`
		global $wpdb;
		foreach ( array( ${ids.join(',')} ) as $id ) {
			$wpdb->delete( $wpdb->posts, array( 'ID' => $id ) );
			$wpdb->delete( $wpdb->postmeta, array( 'post_id' => $id ) );
			$wpdb->delete( \\FotoGrids\\Galleries\\Item_Meta::table(), array( 'attachment_id' => $id ) );
			clean_post_cache( $id );
		}
	`);
}
