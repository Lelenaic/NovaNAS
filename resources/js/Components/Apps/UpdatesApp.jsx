import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import {
    IconRefresh,
    IconPackage,
} from '@tabler/icons-react';
import { SystemUpdatesTab } from './Updates/SystemUpdatesTab';
import { NovaNASUpdatesTab } from './Updates/NovaNASUpdatesTab';
import { AppNavTabs, AppLayout } from './AppNavTabs';

const tabs = [
    { id: 'system', label: 'System Updates', icon: IconPackage },
    { id: 'novanas', label: 'NovaNAS Updates', icon: IconRefresh },
];

export function UpdatesAppContent() {
    const [activeTab, setActiveTab] = useState('system');
    const theme = useMantineTheme();

    const renderTabContent = () => {
        switch (activeTab) {
            case 'system':
                return <SystemUpdatesTab />;
            case 'novanas':
                return <NovaNASUpdatesTab />;
            default:
                return <SystemUpdatesTab />;
        }
    };

    return (
        <AppLayout
            nav={
                <AppNavTabs
                    title="Updates"
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
