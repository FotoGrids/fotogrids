/**
 * Body of the deactivation feedback popup: a radio list of reasons with a
 * conditional detail field, composed with the shared Modal parts so it
 * matches the rest of the FotoGrids admin modals.
 */

import React, { useState } from 'react';
import { Modal } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';
import RadioGroup from '../components/shared/RadioGroup';
import Textarea from '../components/shared/Textarea';

const MAX_DETAIL_LENGTH = 128;

/**
 * @param {Object}   props
 * @param {Object}   props.settings  Localised fotogridsDeactivation data.
 * @param {Function} props.onSubmit  Called with the selected reason + details.
 * @param {Function} props.onSkip    Called when the user skips feedback.
 * @param {Function} props.onCancel  Called when the user cancels.
 * @param {Function} props.onClose   Called when the user dismisses via the header close button.
 * @return {JSX.Element} The composed modal content.
 */
export default function ReasonsForm({
	settings,
	onSubmit,
	onSkip,
	onCancel,
	onClose,
}) {
	const { reasons, i18n } = settings;
	const [selectedId, setSelectedId] = useState(null);
	const [details, setDetails] = useState('');
	const [busy, setBusy] = useState(false);

	const options = reasons.map((reason) => ({
		label: reason.text,
		value: String(reason.id),
	}));

	const selectedReason = reasons.find(
		(reason) => String(reason.id) === selectedId
	);
	const placeholder = selectedReason ? selectedReason.placeholder : '';

	const handleSubmit = async () => {
		if (busy) return;
		setBusy(true);
		await onSubmit({
			id: selectedId,
			details: details.slice(0, MAX_DETAIL_LENGTH),
			snooze: Boolean(selectedReason && selectedReason.snooze),
		});
	};

	return (
		<>
			<Modal.Header compact closeButton={false}>
				<Modal.HeaderLogo />
				<Modal.HeaderTitle>{i18n.title}</Modal.HeaderTitle>
				<Modal.HeaderActions>
					<Modal.HeaderClose
						onClick={(event) => {
							event.preventDefault();
							if (!busy && onClose) onClose();
						}}
					/>
				</Modal.HeaderActions>
			</Modal.Header>

			<Modal.Body>
				<div className="fotogrids-deactivation-form">
					<p className="fotogrids-deactivation-form__intro">
						{i18n.intro}
					</p>

					<RadioGroup
						selected={selectedId}
						options={options}
						ariaLabel={i18n.title}
						onChange={(value) => {
							setSelectedId(value);
							setDetails('');
						}}
					/>

					{placeholder ? (
						<Textarea
							label={i18n.detailsLabel}
							placeholder={placeholder}
							value={details}
							maxLength={MAX_DETAIL_LENGTH}
							onChange={setDetails}
						/>
					) : null}
				</div>
			</Modal.Body>

			<Modal.Footer align="between" compact>
				<Button
					variant="secondary"
					style="ghost"
					size="sm"
					onClick={onCancel}
					disabled={busy}
				>
					{i18n.cancelLabel}
				</Button>
				<div className="fotogrids-deactivation-form__primary-actions">
					<Button
						variant="tertiary"
						size="sm"
						onClick={onSkip}
						disabled={busy}
					>
						{i18n.skipLabel}
					</Button>
					<Button
						variant="primary"
						size="sm"
						onClick={handleSubmit}
						busy={busy}
						disabled={busy || !selectedId}
					>
						{i18n.submitLabel}
					</Button>
				</div>
			</Modal.Footer>
		</>
	);
}
