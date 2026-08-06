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

const groups = [
    {
        label: 'General',
        items: [
            { id: 'general', label: 'General', icon: IconSettings },
            { id: 'ups', label: 'UPS', icon: IconPlug },
        ],
    },
    {
        label: 'Network',
        items: [
            { id: 'network', label: 'Network', icon: IconNetwork },
            { id: 'upnp', label: 'UPNP', icon: IconWifi },
            { id: 'dyndns', label: 'DynDNS', icon: IconCloud },
            { id: 'ssl', label: 'SSL', icon: IconLock },
        ],
    },
    {
        label: 'Apps',
        items: [
            { id: 'docker', label: 'Docker', icon: IconBrandDocker },
            { id: 'filemanager', label: 'File Manager', icon: IconFolder },
            { id: 'services', label: 'Services', icon: IconServer },
            { id: 'gpus', label: 'GPUs', icon: IconCpu },
        ],
    },
    {
        label: 'Access & Security',
        items: [
            { id: 'account', label: 'Users', icon: IconUsers },
            { id: 'security', label: 'Security', icon: IconShield },
        ],
    },
    {
        label: 'Communication',
        items: [
            { id: 'email', label: 'Email', icon: IconMail },
            { id: 'notifications', label: 'Notifications', icon: IconBell },
        ],
    },
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
                    Settings
                </Text>
                <Box style={{ overflowY: 'auto', flex: 1 }}>
                    {groups.map((group) => (
                        <Box key={group.label} mb="sm">
                            <Text
                                size="xs"
                                fw={600}
                                c="dimmed"
                                mb={4}
                                px="sm"
                                pt="sm"
                                pb={4}
                                style={{ textTransform: 'uppercase', letterSpacing: '0.3px' }}
                            >
                                {group.label}
                            </Text>
                            {group.items.map((tab) => (
                                <Box
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        backgroundColor: activeTab === tab.id ? theme.colors.blue[6] : 'transparent',
                                        color: activeTab === tab.id ? 'white' : theme.colors.gray[4],
                                        transition: 'all 0.15s ease',
                                        marginBottom: '2px',
                                    }}
                                >
                                    <tab.icon size={16} />
                                    <Text size="sm" fw={activeTab === tab.id ? 600 : 400}>
                                        {tab.label}
                                    </Text>
                                </Box>
                            ))}
                        </Box>
                    ))}
                </Box>
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
