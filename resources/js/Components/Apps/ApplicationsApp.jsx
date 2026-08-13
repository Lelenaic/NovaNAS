import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import { IconDownload, IconLayoutGrid } from '@tabler/icons-react';
import { StoreBrowser } from './Applications/StoreBrowser';
import { InstalledApps } from './Applications/InstalledApps';
import { AppNavTabs, AppLayout } from './AppNavTabs';

const tabs = [
    { id: 'store', label: 'Store', icon: IconLayoutGrid },
    { id: 'installed', label: 'Installed', icon: IconDownload },
];

export function ApplicationsAppContent({ onDesktopChange }) {
    const [activeTab, setActiveTab] = useState('store');
    const theme = useMantineTheme();

    const renderTabContent = () => {
        switch (activeTab) {
            case 'store':
                return <StoreBrowser onInstallComplete={onDesktopChange} />;
            case 'installed':
                return <InstalledApps onAppChange={onDesktopChange} />;
            default:
                return <StoreBrowser onInstallComplete={onDesktopChange} />;
        }
    };

    return (
        <AppLayout
            nav={
                <AppNavTabs
                    title="Applications"
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            }
        >
            {renderTabContent()}
        </AppLayout>
    );
}
