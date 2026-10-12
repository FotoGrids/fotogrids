import React, { useState, useEffect, useCallback } from 'react';
import { __ } from '@wordpress/i18n';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import TabBar from '@/admin/src/components/shared/TabBar.jsx';
import OperationBanner from './components/OperationBanner.jsx';
import { TABS } from './constants.js';
import ExportPanel from './export/ExportPanel.jsx';
import HistoryPanel from './history/HistoryPanel.jsx';
import ImportPanel from './import/ImportPanel.jsx';

const ImportExportTool = () => {
	const [activeTab, setActiveTab] = useState('export');
	const [operationMessage, setOperationMessage] = useState(null);

	const handleOperationStart = useCallback(
		(msg) => setOperationMessage(msg),
		[]
	);
	const handleOperationEnd = useCallback(() => setOperationMessage(null), []);

	useEffect(() => {
		if (!operationMessage) {
			return;
		}
		const handler = (e) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	}, [operationMessage]);

	return (
		<div className="fotogrids-sidebar-tabs__content__inner fg-ie-root">
			{operationMessage && <OperationBanner message={operationMessage} />}

			<Panel
				title={__('Import / Export', 'fotogrids')}
				description={__(
					'Move gallery data between sites, or keep a safe copy of your galleries, albums, items, statistics, and settings.',
					'fotogrids'
				)}
				noBodyPadding
			>
				<TabBar
					tabs={TABS}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
			</Panel>

			{activeTab === 'export' && (
				<ExportPanel
					onOperationStart={handleOperationStart}
					onOperationEnd={handleOperationEnd}
				/>
			)}
			{activeTab === 'import' && (
				<ImportPanel
					onOperationStart={handleOperationStart}
					onOperationEnd={handleOperationEnd}
				/>
			)}
			{activeTab === 'history' && <HistoryPanel />}
		</div>
	);
};

export default ImportExportTool;
