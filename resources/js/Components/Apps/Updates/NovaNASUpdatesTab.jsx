import { Box, Title, Text, useMantineTheme } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

export function NovaNASUpdatesTab() {
    const theme = useMantineTheme();

    return (
        <Box style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box
                style={{
                    textAlign: 'center',
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '12px',
                    padding: '40px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                    maxWidth: '400px',
                }}
            >
                <IconRefresh size={48} color={theme.colors.gray[5]} style={{ marginBottom: '20px' }} />
                <Title order={3} c="white" mb="md">NovaNAS Updates</Title>
                <Text c="dimmed" size="lg" mb="md">
                    NovaNAS update functionality will be implemented here.
                </Text>
                <Text c="dimmed" size="sm">
                    This feature will allow updating the NovaNAS application itself.
                </Text>
            </Box>
        </Box>
    );
}