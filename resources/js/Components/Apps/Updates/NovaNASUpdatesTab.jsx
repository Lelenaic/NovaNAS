import { useState } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    Alert,
    Loader,
    Badge,
    useMantineTheme,
} from '@mantine/core';
import {
    IconRefresh,
    IconArrowUp,
    IconCheck,
    IconX,
    IconInfoCircle,
} from '@tabler/icons-react';

export function NovaNASUpdatesTab() {
    const theme = useMantineTheme();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState(null);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/updates/novanas/status');
            const data = await response.json();

            if (response.ok) {
                setStatus(data);
            } else {
                setError(data.message || 'Failed to fetch update status');
            }
        } catch (err) {
            setError('Failed to fetch update status');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckUpdates = async () => {
        try {
            setChecking(true);
            setError(null);
            await fetchStatus();
        } catch (err) {
            setError('Failed to check for updates');
            console.error(err);
        } finally {
            setChecking(false);
        }
    };

    const handleUpdate = async () => {
        try {
            setUpdating(true);
            setError(null);

            const response = await fetch('/api/updates/novanas/update', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (response.ok) {
                // Refresh the window after a short delay to allow the update to start
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                setError(data.message || 'Failed to start update');
            }
        } catch (err) {
            setError('Failed to start update');
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    // Fetch status on mount
    useState(() => {
        fetchStatus();
    }, []);

    return (
        <Box style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
            <Title order={2} c="white" mb="xl">NovaNAS Updates</Title>

            {error && (
                <Alert color="red" icon={<IconX />} mb="md">
                    {error}
                </Alert>
            )}

            <Box
                style={{
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '12px',
                    padding: '24px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                }}
                mb="md"
            >
                <Group justify="space-between" mb="md">
                    <Title order={3} c="white">Current Version</Title>
                    {loading ? (
                        <Loader size="sm" />
                    ) : (
                        status?.current_version && (
                            <Badge size="lg" variant="light">
                                v{status.current_version}
                            </Badge>
                        )
                    )}
                </Group>

                <Text c="dimmed" mb="lg">
                    Keep your NovaNAS application up to date with the latest features and security improvements.
                </Text>

                <Group>
                    <Button
                        leftSection={<IconRefresh size={16} />}
                        onClick={handleCheckUpdates}
                        loading={checking}
                        disabled={updating}
                    >
                        {checking ? 'Checking...' : 'Check for Updates'}
                    </Button>

                    {status?.available && (
                        <Button
                            leftSection={<IconArrowUp size={16} />}
                            color="green"
                            onClick={handleUpdate}
                            loading={updating}
                            disabled={checking}
                        >
                            {updating ? 'Starting Update...' : 'Update Now'}
                        </Button>
                    )}
                </Group>
            </Box>

            {status && (
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '24px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group mb="md">
                        <IconInfoCircle size={20} color={theme.colors.blue[4]} />
                        <Title order={4} c="white">Status</Title>
                    </Group>

                    {status.available ? (
                        <Alert color="blue" icon={<IconArrowUp />}>
                            <Text c="white">
                                New version {status.latest_version} is available! Click "Update Now" to start the update process.
                            </Text>
                        </Alert>
                    ) : (
                        <Alert color="green" icon={<IconCheck />}>
                            <Text c="white">
                                {status.message || 'NovaNAS is up to date.'}
                            </Text>
                        </Alert>
                    )}
                </Box>
            )}
        </Box>
    );
}