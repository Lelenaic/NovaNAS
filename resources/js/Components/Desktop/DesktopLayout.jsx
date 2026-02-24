import { Box, Text, useMantineTheme } from '@mantine/core';
import { WindowProvider, useWindow } from './WindowContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { DesktopIcons } from './DesktopIcons';
import { DraggableWindow } from './DraggableWindow';
import { SampleAppContent } from '../Apps/SampleApp';

const APP_COMPONENTS = {
    files: () => <SampleAppContent title="File Manager" emoji="📁" />,
    settings: () => <SampleAppContent title="Settings" emoji="⚙️" />,
    terminal: () => <SampleAppContent title="Terminal" emoji="💻" />,
    docker: () => <SampleAppContent title="Docker" emoji="🐳" />,
    monitor: () => <SampleAppContent title="Monitor" emoji="📊" />,
    storage: () => <SampleAppContent title="Storage" emoji="💾" />,
};

function DesktopContent({ version }) {
    const theme = useMantineTheme();
    const { windows } = useWindow();

    return (
        <Box
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: theme.colors.dark[9],
                backgroundImage: 'linear-gradient(135deg, #1a1b1e 0%, #25262b 100%)',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <Header />

            {/* Desktop Area */}
            <Box
                style={{
                    position: 'absolute',
                    top: '48px',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Sidebar with widgets */}
                <Sidebar />

                {/* Main desktop area with icons and windows */}
                <Box
                    style={{
                        flex: 1,
                        position: 'relative',
                    }}
                >
                    {/* Desktop Icons */}
                    <DesktopIcons />

                    {/* Windows */}
                    {windows.map((win) => {
                        const AppComponent = APP_COMPONENTS[win.appId];
                        return (
                            <DraggableWindow key={win.id} windowState={win}>
                                {AppComponent ? <AppComponent /> : <SampleAppContent title={win.title} emoji={win.icon} />}
                            </DraggableWindow>
                        );
                    })}
                </Box>
            </Box>

            {/* Footer */}
            <Text
                size="xs"
                c="dimmed"
                style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '12px',
                    zIndex: 10,
                }}
            >
                NovaNAS v{version}
            </Text>
        </Box>
    );
}

export function DesktopLayout({ children, version = '1.0.0' }) {
    return (
        <WindowProvider>
            <DesktopContent version={version} />
            {children}
        </WindowProvider>
    );
}
