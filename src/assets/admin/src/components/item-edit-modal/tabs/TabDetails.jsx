import React from 'react';
import { __ } from '@wordpress/i18n';
import { Editor } from '@shared/text-editor';
import FormField from '../../shared/FormField/FormField.jsx';
import FormFields from '../../shared/FormField/FormFields.jsx';
import useTextEditorConfig from '../useTextEditorConfig';

const TabDetails = ({
	formData,
	handleInputChange,
	strings,
	disabled = false,
}) => {
	const textEditor = useTextEditorConfig();
	const editorProps = {
		profile: textEditor.profile,
		disabledReason: textEditor.disabledReason,
		reasonLink: textEditor.reasonLink,
		stripsFormatting: textEditor.stripsFormatting,
		linkDefaults: textEditor.linkDefaults,
		disabled,
	};
	const formattingHint = textEditor.disabledReason
		? undefined
		: __(
				'Bold, italic and links show in Lightboxes. Thumbnails and album tiles show links as plain text.',
				'fotogrids'
			);

	return (
		<div className="fotogrids-tab-panel fg-is-active">
			<FormFields>
				<FormField
					label={strings.title || 'Title'}
					htmlFor="fotogrids-item-title"
					layout="column"
				>
					<input
						type="text"
						id="fotogrids-item-title"
						value={formData?.title || ''}
						onChange={(e) =>
							handleInputChange('title', e.target.value)
						}
						disabled={disabled}
					/>
				</FormField>

				<FormField
					label={strings.altText || 'Alt Text'}
					htmlFor="fotogrids-item-alt"
					layout="column"
				>
					<input
						type="text"
						id="fotogrids-item-alt"
						value={formData?.alt || ''}
						onChange={(e) =>
							handleInputChange('alt', e.target.value)
						}
						disabled={disabled}
					/>
				</FormField>

				<FormField
					label={strings.caption || 'Caption'}
					htmlFor="fotogrids-item-caption"
					layout="column"
				>
					<Editor
						{...editorProps}
						id="fotogrids-item-caption"
						field="caption"
						label={strings.caption || 'Caption'}
						rows={3}
						value={formData?.caption || ''}
						onChange={(value) =>
							handleInputChange('caption', value)
						}
					/>
				</FormField>

				<FormField
					label={strings.description || 'Description'}
					htmlFor="fotogrids-item-description"
					layout="column"
					description={formattingHint}
				>
					<Editor
						{...editorProps}
						id="fotogrids-item-description"
						field="description"
						label={strings.description || 'Description'}
						rows={4}
						value={formData?.description || ''}
						onChange={(value) =>
							handleInputChange('description', value)
						}
					/>
				</FormField>

				<FormField
					label={strings.credit || 'Credit'}
					htmlFor="fotogrids-item-credit"
					layout="column"
				>
					<input
						type="text"
						id="fotogrids-item-credit"
						value={formData?.credit || ''}
						onChange={(e) =>
							handleInputChange('credit', e.target.value)
						}
						disabled={disabled}
					/>
				</FormField>
			</FormFields>
		</div>
	);
};

export default TabDetails;
