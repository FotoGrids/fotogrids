/**
 * Tests for renderConditionalMessage.js
 */
import '@/admin/plain/render-settings/renderConditionalMessage';
import { renderElement } from '@tests/helpers/render-component';

const build = (setting, value) =>
	window.FotoGridsRenderSettings.renderConditionalMessage(setting, value);

describe('renderConditionalMessage', () => {
	it('returns null when there is no conditionalMessage', () => {
		expect(build({ key: 'k' }, 'x')).toBeNull();
	});

	it('returns null when the current value is not in the condition set', () => {
		const out = build(
			{
				conditionalMessage: {
					condition: { values: ['a', 'b'] },
					message: 'shown',
				},
			},
			'c'
		);
		expect(out).toBeNull();
	});

	it('renders the message when the value matches', () => {
		const { container } = renderElement(
			build(
				{
					conditionalMessage: {
						condition: { values: ['a', 'b'] },
						message: 'shown message',
					},
				},
				'b'
			)
		);
		expect(
			container.querySelector('.fotogrids-conditional-message p')
				.textContent
		).toBe('shown message');
	});
});
