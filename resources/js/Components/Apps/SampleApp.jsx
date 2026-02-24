import { Box, Text, useMantineTheme } from '@mantine/core';

export function SampleAppContent({ title, emoji }) {
    const theme = useMantineTheme();

    return (
        <Box
            style={{
                padding: '24px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.dark[8],
            }}
        >
            <Text size="4rem" mb="md">
                {emoji}
            </Text>
            <Text size="xl" fw={600} c="white" mb="sm">
                {title}
            </Text>
            <Text c="dimmed" ta="center">
                This is a sample application window.
                <br />
                You can drag, resize, minimize, and maximize this window.
            </Text>
        </Box>
    );
}
