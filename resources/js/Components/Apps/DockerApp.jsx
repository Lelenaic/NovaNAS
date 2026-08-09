import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import {
    IconBrandDocker,
    IconBox,
    IconPhoto,
    IconHierarchy2,
    IconNetwork,
    IconCloud,
    IconStack2,
} from '@tabler/icons-react';
import { DashboardTab } from './Docker/DashboardTab';
import { ContainersTab } from './Docker/ContainersTab';
import { ImagesTab } from './Docker/ImagesTab';
import { VolumesTab } from './Docker/VolumesTab';
import { NetworksTab } from './Docker/NetworksTab';
import { RegistriesTab } from './Docker/RegistriesTab';
import { ProjectsTab } from './Docker/ProjectsTab';

const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: IconBrandDocker },
    { id: 'containers', label: 'Containers', icon: IconBox },
    { id: 'projects', label: 'Projects', icon: IconStack2 },
    { id: 'images', label: 'Images', icon: IconPhoto },
    { id: 'volumes', label: 'Volumes', icon: IconHierarchy2 },
    { id: 'networks', label: 'Networks', icon: IconNetwork },
    { id: 'registries', label: 'Registries', icon: IconCloud },
];

export function DockerAppContent() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const theme = useMantineTheme();

    const renderTabContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <DashboardTab />;
            case 'containers':
                return <ContainersTab />;
            case 'projects':
                return <ProjectsTab />;
            case 'images':
                return <ImagesTab />;
            case 'volumes':
                return <VolumesTab />;
            case 'networks':
                return <NetworksTab />;
            case 'registries':
                return <RegistriesTab />;
            default:
                return <DashboardTab />;
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
                    Docker
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
                            backgroundColor: activeTab === tab.id ? theme.colors.blue[6] : 'transparent',
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
