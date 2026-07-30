import { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Text,
    Card,
    Badge,
    Group,
    Stack,
    Loader,
    Alert,
    Image,
    ActionIcon,
    Tooltip,
    Button,
    Divider,
} from '@mantine/core';
import {
    IconAlertCircle,
    IconRefresh,
    IconPlayerStop,
    IconPlayerPlay,
    IconTrash,
    IconDownload,
    IconInfoCircle,
} from '@tabler/icons-react';
import { AppDetailModal } from './AppDetailModal';

export function InstalledApps({ onAppChange }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [apps, setApps] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [selectedApp, setSelectedApp] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    const fetchInstalled = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/applications/installed');
            if (!response.ok) throw new Error('Failed to fetch installed applications');

            const data = await response.json();
            setApps(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInstalled();
    }, [fetchInstalled]);

    const handleAction = async (appId, storeProvider, action) => {
        try {
            setActionLoading(`${appId}-${action}`);
            setError(null);

            const method = action === 'remove' ? 'DELETE' : 'POST';
            const url = action === 'remove'
                ? `/api/applications/${storeProvider}/apps/${appId}`
                : `/api/applications/${storeProvider}/apps/${appId}/${action}`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Failed to ${action} application`);
            }

            fetchInstalled();
            onAppChange?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleAppClick = (app) => {
        setSelectedApp({ id: app.app_id, title: app.title });
        setDetailModalOpen(true);
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <Stack gap="md" h="100%">
            <Group justify="space-between" align="center">
                <Box>
                    <Text size="xl" fw={700} c="white">
                        Installed Applications
                    </Text>
                    <Text size="sm" c="dimmed">
                        {apps.length} application{apps.length !== 1 ? 's' : ''} installed
                    </Text>
                </Box>
                <Tooltip label="Refresh">
                    <ActionIcon variant="subtle" color="gray" onClick={fetchInstalled}>
                        <IconRefresh size={18} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            {error && (
                <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" variant="light">
                    {error}
                </Alert>
            )}

            {apps.length === 0 ? (
                <Box
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        gap: '12px',
                    }}
                >
                    <IconDownload size={48} color="gray" />
                    <Text c="dimmed">No applications installed yet</Text>
                    <Text size="sm" c="dimmed">
                        Browse the Store tab to install applications
                    </Text>
                </Box>
            ) : (
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {apps.map((app) => (
                        <Card
                            key={app.app_id}
                            padding="md"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                flex: '1 1 280px',
                                maxWidth: '400px',
                            }}
                        >
                            <Group gap="md" align="flex-start">
                                {app.icon ? (
                                    <Image
                                        src={app.icon}
                                        w={48}
                                        h={48}
                                        radius="md"
                                        fit="contain"
                                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Cpath d='m9 12 2 2 4-4'/%3E%3C/svg%3E"
                                    />
                                ) : (
                                    <Box
                                        w={48}
                                        h={48}
                                        radius="md"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <IconInfoCircle size={24} color="gray" />
                                    </Box>
                                )}
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                        size="sm"
                                        fw={600}
                                        c="white"
                                        truncate="end"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleAppClick(app)}
                                    >
                                        {app.title}
                                    </Text>
                                    <Text size="xs" c="dimmed" truncate="end" mt={2}>
                                        v{app.installed_version}
                                    </Text>
                                    <Group gap="xs" mt="xs">
                                        <Badge
                                            size="xs"
                                            color={app.status === 'running' ? 'green' : app.status === 'stopped' ? 'yellow' : 'red'}
                                            variant="light"
                                        >
                                            {app.status === 'running' ? 'Running' : app.status === 'stopped' ? 'Stopped' : 'Error'}
                                        </Badge>
                                        <Text size="xs" c="dimmed">
                                            {app.store_provider}
                                        </Text>
                                    </Group>
                                </Box>
                            </Group>

                            <Divider my="sm" />

                            <Group justify="flex-end" gap="xs">
                                {app.status === 'running' ? (
                                    <Tooltip label="Stop">
                                        <ActionIcon
                                            variant="subtle"
                                            color="yellow"
                                            size="sm"
                                            loading={actionLoading === `${app.app_id}-stop`}
                                            onClick={() => handleAction(app.app_id, app.store_provider, 'stop')}
                                        >
                                            <IconPlayerStop size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                ) : (
                                    <Tooltip label="Start">
                                        <ActionIcon
                                            variant="subtle"
                                            color="green"
                                            size="sm"
                                            loading={actionLoading === `${app.app_id}-start`}
                                            onClick={() => handleAction(app.app_id, app.store_provider, 'start')}
                                        >
                                            <IconPlayerPlay size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                )}
                                <Tooltip label="Remove">
                                    <ActionIcon
                                        variant="subtle"
                                        color="red"
                                        size="sm"
                                        loading={actionLoading === `${app.app_id}-remove`}
                                        onClick={() => handleAction(app.app_id, app.store_provider, 'remove')}
                                    >
                                        <IconTrash size={14} />
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        </Card>
                    ))}
                </Box>
            )}

            {selectedApp && (
                <AppDetailModal
                    opened={detailModalOpen}
                    onClose={() => setDetailModalOpen(false)}
                    app={selectedApp}
                    storeProvider="casaos"
                    onInstallComplete={fetchInstalled}
                />
            )}
        </Stack>
    );
}
