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
import { AppNavTabs, AppLayout } from './AppNavTabs';

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
        <AppLayout
            nav={
                <AppNavTabs
                    title="Docker"
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
