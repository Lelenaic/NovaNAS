import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import {
    IconFileText,
    IconStack,
} from '@tabler/icons-react';
import { LogsTab } from './Logs/LogsTab';
import { QueuesTab } from './Logs/QueuesTab';
import { AppNavTabs, AppLayout } from './AppNavTabs';

const tabs = [
    { id: 'logs', label: 'Logs', icon: IconFileText },
    { id: 'queues', label: 'Queues', icon: IconStack },
];

export function LogsAppContent() {
    const [activeTab, setActiveTab] = useState('logs');
    const theme = useMantineTheme();

    const renderTabContent = () => {
        switch (activeTab) {
            case 'logs':
                return <LogsTab />;
            case 'queues':
                return <QueuesTab />;
            default:
                return <LogsTab />;
        }
    };

    return (
        <AppLayout
            nav={
                <AppNavTabs
                    title="Logs"
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
