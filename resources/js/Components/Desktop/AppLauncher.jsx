import { Box, Text, SimpleGrid, useMantineTheme } from '@mantine/core';
import { useWindow } from './WindowContext';

const AVAILABLE_APPS = [
    {
        id: 'files',
        name: 'File Manager',
        icon: '📁',
        description: 'Manage your files',
    },
    {
        id: 'settings',
        name: 'Settings',
        icon: '⚙️',
        description: 'System settings',
    },
    {
        id: 'terminal',
        name: 'Terminal',
        icon: '💻',
        description: 'Command line access',
    },
    {
        id: 'docker',
        name: 'Docker',
        icon: '🐳',
        description: 'Container management',
    },
    {
        id: 'monitor',
        name: 'Monitor',
        icon: '📊',
        description: 'System monitoring',
    },
    {
        id: 'storage',
        name: 'Storage',
        icon: '💾',
        description: 'Storage management',
    },
];

export function AppLauncher({ onClose }) {
    const theme = useMantineTheme();
    const { openWindow } = useWindow();

    const handleAppClick = (app) => {
        openWindow(app.id, app.name, app.icon);
        if (onClose) onClose();
    };

    return (
        <Box
            style={{
                position: 'absolute',
                bottom: '56px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: theme.colors.dark[7],
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                border: `1px solid ${theme.colors.dark[5]}`,
                minWidth: '500px',
                maxWidth: '600px',
                zIndex: 1000,
            }}
        >
            <Text size="lg" fw={600} c="white" mb="md">
                Applications
            </Text>
            <SimpleGrid cols={3} spacing="md">
                {AVAILABLE_APPS.map((app) => (
                    <Box
                        key={app.id}
                        onClick={() => handleAppClick(app)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '16px 8px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.dark[5];
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <Text size="2rem" mb="xs">
                            {app.icon}
                        </Text>
                        <Text size="sm" c="white" ta="center">
                            {app.name}
                        </Text>
                        <Text size="xs" c="dimmed" ta="center">
                            {app.description}
                        </Text>
                    </Box>
                ))}
            </SimpleGrid>
        </Box>
    );
}

export { AVAILABLE_APPS };
