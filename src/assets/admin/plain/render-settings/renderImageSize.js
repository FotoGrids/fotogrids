window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderImageSize = (
	setting,
	currentValue,
	isDisabled,
	{
		updateSetting,
		renderIcon,
		getFieldState,
		isDefaultsMode,
		getOptionState,
		__,
	}
) => {
	const renderAdditionalContent = (selectedOption, options, currentValue) => {
		if (!selectedOption || selectedOption.value === 'custom') {
			return null;
		}

		let sizeInfo = null;
		if (selectedOption.width && selectedOption.height) {
			sizeInfo = React.createElement('span', { key: 'size' }, [
				React.createElement(
					'strong',
					null,
					__('Image Size:', 'fotogrids')
				),
				` ${selectedOption.width}x${selectedOption.height}`,
			]);
		} else if (selectedOption.value === 'full') {
			sizeInfo = React.createElement('span', { key: 'size' }, [
				React.createElement(
					'strong',
					null,
					__('Image Size:', 'fotogrids')
				),
				` ${__('Original', 'fotogrids')}`,
			]);
		} else {
			return null;
		}

		const cropText =
			selectedOption.crop !== undefined
				? React.createElement('span', { key: 'crop' }, [
						React.createElement(
							'strong',
							null,
							__('Crop:', 'fotogrids')
						),
						` ${selectedOption.crop ? __('Yes', 'fotogrids') : __('No', 'fotogrids')}`,
					])
				: null;

		return React.createElement(
			'div',
			{
				key: 'size-info',
				className: 'fotogrids-setting__description',
			},
			[
				sizeInfo,
				cropText &&
					React.createElement('span', { key: 'separator' }, '. '),
				cropText,
			].filter(Boolean)
		);
	};

	return window.FotoGridsRenderSettings.renderButtonGroupDynamic(
		setting,
		currentValue,
		isDisabled,
		{
			updateSetting,
			renderIcon,
			getFieldState,
			isDefaultsMode,
			getOptionState,
			__,
			renderAdditionalContent,
		}
	);
};
