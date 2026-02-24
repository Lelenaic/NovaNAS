import { Box, Text } from '@mantine/core';
import { IconFolder, IconSettings, IconTerminal2, IconBrandDocker, IconChartBar, IconHierarchy2 } from '@tabler/icons-react';
import { useWindow } from './WindowContext';

const APPS = [
    { id: 'files', name: 'File Manager', icon: IconFolder, color: '#228be6' },
    { id: 'settings', name: 'Settings', icon: IconSettings, color: '#868e96' },
    { id: 'terminal', name: 'Terminal', icon: IconTerminal2, color: '#40c057' },
    { id: 'docker', name: 'Docker', icon: IconBrandDocker, color: '#228be6' },
    { id: 'monitor', name: 'Monitor', icon: IconChartBar, color: '#fa5252' },
    { id: 'storage', name: 'Storage', icon: IconHierarchy2, color: '#fab005' },
];

export function DesktopIcons() {
    const { windows, openWindow, focusWindow } = useWindow();

    const handleDoubleClick = (app) => {
        // Check if window is already open, if so focus it
        const existingWindow = windows.find(w => w.appId === app.id && !w.minimized);
        if (existingWindow) {
            focusWindow(existingWindow.id);
        } else {
            openWindow(app.id, app.name, app.icon);
        }
    };

    return (
        <Box
            style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                display: 'flex',
                flexDirection: 'column',
                flexWrap: 'wrap',
                gap: '24px',
                alignContent: 'flex-start',
                maxHeight: 'calc(100vh - 100px)',
                width: '120px',
            }}
        >
            {APPS.map((app) => {
                const Icon = app.icon;
                return (
                    <Box
                        key={app.id}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'background-color 0.2s',
                            width: '100px',
                        }}
                        onDoubleClick={() => handleDoubleClick(app)}
                        onClick={() => openWindow(app.id, app.name, app.icon)}
                        className="desktop-icon"
                    >
                        <Box
                            style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '16px',
                                backgroundColor: app.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            }}
                        >
                            <Icon size={32} color="white" />
                        </Box>
                        <Text
                            size="sm"
                            c="white"
                            style={{
                                textAlign: 'center',
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                fontWeight: 500,
                                lineHeight: 1.2,
                            }}
                        >
                            {app.name}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}
