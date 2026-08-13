import { useState } from 'react';
import { Box, Text, useMantineTheme } from '@mantine/core';
import {
    IconSettings,
    IconNetwork,
    IconUsers,
    IconShield,
    IconBell,
    IconCloud,
    IconWifi,
    IconMail,
    IconServer,
    IconCpu,
    IconBrandDocker,
    IconLock,
    IconFolder,
    IconPlug,
} from '@tabler/icons-react';
import { GeneralTab } from './Settings/GeneralTab';
import { NetworkTab } from './Settings/NetworkTab';
import { DynDnsTab } from './Settings/DynDnsTab';
import { UpnpTab } from './Settings/UpnpTab';
import { UsersTab } from './Settings/UsersTab';
import { EmailTab } from './Settings/EmailTab';
import { ServicesTab } from './Settings/ServicesTab';
import { GPUTab } from './Settings/GPUTab';
import { DockerTab } from './Settings/DockerTab';
import { SslTab } from './Settings/SslTab';
import { FileManagerTab } from './Settings/FileManagerTab';
import { UpsTab } from './Settings/UpsTab';
import { AppNavTabs, AppLayout } from './AppNavTabs';

const tabs = [
    { id: 'general', label: 'General', icon: IconSettings },
    { id: 'ups', label: 'UPS', icon: IconPlug },
    { id: 'network', label: 'Network', icon: IconNetwork },
    { id: 'upnp', label: 'UPNP', icon: IconWifi },
    { id: 'dyndns', label: 'DynDNS', icon: IconCloud },
    { id: 'ssl', label: 'SSL', icon: IconLock },
    { id: 'docker', label: 'Docker', icon: IconBrandDocker },
    { id: 'filemanager', label: 'File Manager', icon: IconFolder },
    { id: 'services', label: 'Services', icon: IconServer },
    { id: 'gpus', label: 'GPUs', icon: IconCpu },
    { id: 'account', label: 'Users', icon: IconUsers },
    { id: 'security', label: 'Security', icon: IconShield },
    { id: 'email', label: 'Email', icon: IconMail },
    { id: 'notifications', label: 'Notifications', icon: IconBell },
];

export function SettingsAppContent() {
    const [activeTab, setActiveTab] = useState('general');
    const theme = useMantineTheme();

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return <GeneralTab />;
            case 'ups':
                return <UpsTab />;
            case 'network':
                return <NetworkTab />;
            case 'upnp':
                return <UpnpTab />;
            case 'dyndns':
                return <DynDnsTab />;
            case 'ssl':
                return <SslTab />;
            case 'docker':
                return <DockerTab />;
            case 'services':
                return <ServicesTab />;
            case 'gpus':
                return <GPUTab />;
            case 'filemanager':
                return <FileManagerTab />;
            case 'appearance':
                return <Text c="dimmed">Appearance settings will appear here.</Text>;
            case 'account':
                return <UsersTab />;
            case 'security':
                return <Text c="dimmed">Security settings will appear here.</Text>;
            case 'email':
                return <EmailTab />;
            case 'notifications':
                return <Text c="dimmed">Notification settings will appear here.</Text>;
            default:
                return <GeneralTab />;
        }
    };

    return (
        <AppLayout
            nav={
                <AppNavTabs
                    title="Settings"
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
