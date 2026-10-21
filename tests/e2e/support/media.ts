import { wpEval } from './roles';

/**
 * Attachments a spec owns, copied from a seeded one's original file so nothing
 * is uploaded over HTTP. Delete them with `deleteAttachments` when done.
 */

export type SizeEntry = { file: string; width: number; height: number };

export type AttachmentMeta = {
	file: string;
	width: number;
	height: number;
	sizes: Record<string, SizeEntry>;
};

function php(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * A new image attachment holding a copy of another's original file.
 *
 * @param sourceId Attachment to copy.
 * @param filename Name the copy is stored under, sanitised but with its case
 *                 kept, as a file placed by FTP or a migration would be.
 * @param generate Whether to generate subsizes, as an upload does.
 */
export function cloneAttachment(
	sourceId: number,
	filename: string,
	generate = true
): number {
	return Number(
		wpEval(`
			require_once ABSPATH . 'wp-admin/includes/image.php';
			$src  = wp_get_original_image_path( ${sourceId} ) ?: get_attached_file( ${sourceId} );
			$dir  = wp_upload_dir();
			$up   = array( 'file' => trailingslashit( $dir['path'] ) . sanitize_file_name( ${php(filename)} ) );
			copy( $src, $up['file'] );
			$type = wp_check_filetype( $up['file'] );
			$id   = wp_insert_attachment( array(
				'post_mime_type' => $type['type'],
				'post_title'     => ${php(filename)},
				'post_status'    => 'inherit',
			), $up['file'] );
			if ( ${generate ? 'true' : 'false'} ) {
				wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $up['file'] ) );
			} else {
				$size = wp_getimagesize( $up['file'] );
				wp_update_attachment_metadata( $id, array( 'width' => $size[0], 'height' => $size[1], 'file' => _wp_relative_upload_path( $up['file'] ), 'sizes' => array() ) );
			}
			update_post_meta( $id, '_wp_attachment_image_alt', 'Clone of ' . ${sourceId} );
			echo $id;
		`).trim()
	);
}

/** Delete attachments and every file WordPress knows belongs to them. */
export function deleteAttachments(ids: number[]): void {
	if (ids.length) {
		wpEval(
			`foreach ( array( ${ids.join(',')} ) as $id ) { wp_delete_attachment( $id, true ); }`
		);
	}
}

export function attachmentMeta(id: number): AttachmentMeta {
	return JSON.parse(
		wpEval(`echo wp_json_encode( wp_get_attachment_metadata( ${id} ) );`)
	);
}

/** Absolute path of one of an attachment's subsize files. */
export function sizePath(id: number, size: string): string {
	return wpEval(
		`$m = wp_get_attachment_metadata( ${id} ); echo trailingslashit( wp_get_upload_dir()['basedir'] ) . trailingslashit( dirname( $m['file'] ) ) . $m['sizes'][ ${php(size)} ]['file'];`
	).trim();
}
