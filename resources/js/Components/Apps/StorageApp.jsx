import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import {
    IconDisc,
    IconStack2,
    IconHeart,
    IconApps,
    IconFolderShare,
} from '@tabler/icons-react';
import { DisksTab } from './Storage/DisksTab';
import { HealthTab } from './Storage/HealthTab';
import { PoolsTab } from './Storage/PoolsTab';
import { AppTab } from './Storage/AppTab';
import { SharesTab } from './Storage/SharesTab';
import { AppNavTabs, AppLayout } from './AppNavTabs';

const tabs = [
    { id: 'disks', label: 'Disks', icon: IconDisc },
    { id: 'health', label: 'Health', icon: IconHeart },
    { id: 'pools', label: 'Pools', icon: IconStack2 },
    { id: 'shares', label: 'Shares', icon: IconFolderShare },
    { id: 'app', label: 'Apps', icon: IconApps },
];

export function StorageAppContent() {
    const [activeTab, setActiveTab] = useState('disks');
    const theme = useMantineTheme();

    const renderTabContent = () => {
        switch (activeTab) {
            case 'disks':
                return <DisksTab />;
            case 'health':
                return <HealthTab />;
            case 'pools':
                return <PoolsTab />;
            case 'shares':
                return <SharesTab />;
            case 'app':
                return <AppTab />;
            default:
                return <DisksTab />;
        }
    };

    return (
        <AppLayout
            nav={
                <AppNavTabs
                    title="Storage"
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
