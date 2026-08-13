import { Box, Text, ScrollArea, useMantineTheme } from '@mantine/core';
import { useIsMobile } from '../Desktop/useIsMobile';

/**
 * Shared responsive navigation component for app windows.
 * On desktop: renders as a fixed 220px sidebar.
 * On mobile: renders as a horizontal scrollable tab bar at the top.
 */
export function AppNavTabs({ title, tabs, activeTab, onTabChange }) {
    const theme = useMantineTheme();
    const isMobile = useIsMobile();

    // Mobile: horizontal scrollable tabs
    if (isMobile) {
        return (
            <Box
                style={{
                    borderBottom: `1px solid ${theme.colors.dark[4]}`,
                    backgroundColor: theme.colors.dark[6],
                }}
            >
                <ScrollArea
                    type="never"
                    styles={{
                        scrollbar: { display: 'none' },
                    }}
                >
                    <Box
                        style={{
                            display: 'flex',
                            gap: '2px',
                            padding: '8px 12px',
                            minWidth: 'max-content',
                        }}
                    >
                        {tabs.map((tab) => (
                            <Box
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: activeTab === tab.id ? theme.colors.blue[6] : 'transparent',
                                    color: activeTab === tab.id ? 'white' : theme.colors.gray[4],
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                }}
                            >
                                <tab.icon size={14} />
                                <Text size="xs" fw={activeTab === tab.id ? 600 : 400}>
                                    {tab.label}
                                </Text>
                            </Box>
                        ))}
                    </Box>
                </ScrollArea>
            </Box>
        );
    }

    // Desktop: sidebar navigation
    return (
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
                {title}
            </Text>
            {tabs.map((tab) => (
                <Box
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
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
    );
}

/**
 * Shared wrapper for app content that uses AppNavTabs.
 * On desktop: flex row with sidebar + content.
 * On mobile: flex column with tab bar + content.
 */
export function AppLayout({ nav, children }) {
    const isMobile = useIsMobile();

    return (
        <Box
            style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                height: '100%',
            }}
        >
            {nav}
            <Box
                style={{
                    flex: 1,
                    padding: isMobile ? '12px' : '24px',
                    overflow: 'auto',
                    backgroundColor: 'var(--mantine-color-dark-7)',
                    minHeight: 0,
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
