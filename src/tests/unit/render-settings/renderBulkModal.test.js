/**
 * Tests for renderBulkModal.js
 */
import '@/admin/plain/render-settings/renderBulkModal';
import { renderElement, click } from '@tests/helpers/render-component';

const __ = (t) => t;
const build = (props) =>
	window.FotoGridsRenderSettings.renderBulkModal({
		showBulkModal: true,
		bulkAction: 'apply_to_all',
		bulkUrl: '',
		setBulkUrl: jest.fn(),
		bulkTarget: '_self',
		setBulkTarget: jest.fn(),
		validateUrl: () => ({ valid: true }),
		closeBulkModal: jest.fn(),
		executeBulkAction: jest.fn(),
		__,
		...props,
	});

describe('renderBulkModal', () => {
	it('returns null when the modal is hidden', () => {
		expect(build({ showBulkModal: false })).toBeNull();
	});

	it('renders the apply-to-all title and footer', () => {
		const { container } = renderElement(build({ bulkUrl: 'https://x.test' }));
		expect(container.querySelector('h3').textContent).toBe(
			'Apply URL to All Items'
		);
		expect(container.textContent).toContain('Apply to All');
	});

	it('renders the clear-all confirmation', () => {
		const { container } = renderElement(build({ bulkAction: 'clear_all' }));
		expect(container.querySelector('h3').textContent).toBe('Clear All URLs');
		expect(container.textContent).toContain('cannot be undone');
	});

	it('disables Apply when the URL is empty or invalid', () => {
		const { container } = renderElement(
			build({ bulkUrl: '', validateUrl: () => ({ valid: false }) })
		);
		const apply = [...container.querySelectorAll('button')].find(
			(b) => b.textContent === 'Apply to All'
		);
		expect(apply.disabled).toBe(true);
	});

	it('enables Apply with a valid URL', () => {
		const { container } = renderElement(
			build({ bulkUrl: 'https://x.test', validateUrl: () => ({ valid: true }) })
		);
		const apply = [...container.querySelectorAll('button')].find(
			(b) => b.textContent === 'Apply to All'
		);
		expect(apply.disabled).toBe(false);
	});

	it('always enables Clear All', () => {
		const { container } = renderElement(build({ bulkAction: 'clear_all' }));
		const clear = [...container.querySelectorAll('button')].find(
			(b) => b.textContent === 'Clear All'
		);
		expect(clear.disabled).toBe(false);
	});

	it('calls closeBulkModal from the close button and Cancel', () => {
		const closeBulkModal = jest.fn();
		const { container } = renderElement(build({ closeBulkModal }));
		click(container.querySelector('.fotogrids-modal__close'));
		const cancel = [...container.querySelectorAll('button')].find(
			(b) => b.textContent === 'Cancel'
		);
		click(cancel);
		expect(closeBulkModal).toHaveBeenCalledTimes(2);
	});

	it('closes on overlay click', () => {
		const closeBulkModal = jest.fn();
		const { container } = renderElement(build({ closeBulkModal }));
		click(container.querySelector('.fotogrids-modal__overlay'));
		expect(closeBulkModal).toHaveBeenCalled();
	});

	it('executes the bulk action from the primary button', () => {
		const executeBulkAction = jest.fn();
		const { container } = renderElement(
			build({ bulkUrl: 'https://x.test', executeBulkAction })
		);
		const apply = [...container.querySelectorAll('button')].find(
			(b) => b.textContent === 'Apply to All'
		);
		click(apply);
		expect(executeBulkAction).toHaveBeenCalled();
	});
});
