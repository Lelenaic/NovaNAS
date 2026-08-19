import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import { IconDatabase, IconDatabaseExport, IconClock, IconCamera, IconServer } from '@tabler/icons-react';
import { JobsTab } from './tabs/JobsTab';
import { RepositoriesTab } from './tabs/RepositoriesTab';
import { SnapshotsTab } from './tabs/SnapshotsTab';
import { BackupServerTab } from './tabs/BackupServerTab';
import { AppNavTabs, AppLayout } from '../AppNavTabs';

const tabs = [
    { id: 'jobs', label: 'Jobs', icon: IconClock },
    { id: 'repositories', label: 'Destinations', icon: IconDatabase },
    { id: 'snapshots', label: 'Backups', icon: IconCamera },
    { id: 'backup-server', label: 'Backup Server', icon: IconServer },
];

export function BackupAppContent() {
    const [activeTab, setActiveTab] = useState('jobs');
    const theme = useMantineTheme();

    const renderTabContent = () => {
        switch (activeTab) {
            case 'jobs':
                return <JobsTab />;
            case 'repositories':
                return <RepositoriesTab />;
            case 'snapshots':
                return <SnapshotsTab />;
            case 'backup-server':
                return <BackupServerTab />;
            default:
                return <JobsTab />;
        }
    };

    return (
        <AppLayout
            nav={
                <AppNavTabs
                    title="Backup"
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
