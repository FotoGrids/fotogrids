window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderConditionalMessage = (
	setting,
	currentValue
) => {
	if (!setting.conditionalMessage) return null;

	const { condition, message } = setting.conditionalMessage;
	const shouldShow = condition.values.includes(currentValue);

	if (!shouldShow) return null;

	const { createElement: h } = wp.element;

	return h(
		'div',
		{
			className: 'fotogrids-conditional-message',
		},
		h(
			'p',
			{
				className: 'description',
			},
			message
		)
	);
};
