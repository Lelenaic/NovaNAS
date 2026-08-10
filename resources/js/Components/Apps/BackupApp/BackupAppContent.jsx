import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import { IconDatabase, IconDatabaseExport, IconClock, IconCamera } from '@tabler/icons-react';
import { JobsTab } from './tabs/JobsTab';
import { RepositoriesTab } from './tabs/RepositoriesTab';
import { SnapshotsTab } from './tabs/SnapshotsTab';

const tabs = [
    { id: 'jobs', label: 'Jobs', icon: IconClock },
    { id: 'repositories', label: 'Destinations', icon: IconDatabase },
    { id: 'snapshots', label: 'Backups', icon: IconCamera },
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
            default:
                return <JobsTab />;
        }
    };

    return (
        <Box style={{ display: 'flex', height: '100%' }}>
            <Box
                style={{
                    width: '220px',
                    minWidth: '220px',
                    backgroundColor: theme.colors.dark[5],
                    borderRight: `1px solid ${theme.colors.dark[4]}`,
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    mb="xs"
                    px="sm"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                    Backup
                </Text>
                {tabs.map((tab) => (
                    <Box
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: activeTab === tab.id ? theme.colors.green[6] : 'transparent',
                            color: activeTab === tab.id ? 'white' : theme.colors.gray[4],
                            transition: 'all 0.15s ease',
                            marginBottom: '2px',
                        }}
                    >
                        <tab.icon size={18} />
                        <Text size="sm" fw={activeTab === tab.id ? 600 : 400}>
                            {tab.label}
                        </Text>
                    </Box>
                ))}
            </Box>

            <Box
                style={{
                    flex: 1,
                    padding: '24px',
                    overflow: 'auto',
                    backgroundColor: theme.colors.dark[7],
                }}
            >
                {renderTabContent()}
            </Box>
        </Box>
    );
}
