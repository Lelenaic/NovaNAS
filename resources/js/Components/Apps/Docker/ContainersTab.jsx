import { useEffect, useState } from 'react';
import { Box, Title, Text, Card, Badge, Group, ActionIcon, Stack, Loader, Button, Modal, Switch, Alert } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconRefresh, IconTrash, IconBox, IconAlertCircle } from '@tabler/icons-react';

export function ContainersTab() {
    const [loading, setLoading] = useState(true);
    const [containers, setContainers] = useState([]);
    const [showAll, setShowAll] = useState(true);
    const [actionLoading, setActionLoading] = useState({});
    const [deleteModal, setDeleteModal] = useState({ open: false, container: null });
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchContainers();
    }, [showAll]);

    const fetchContainers = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/docker/containers?all=${showAll}`);
            if (response.ok) {
                const data = await response.json();
                setContainers(data);
            }
        } catch (err) {
            console.error('Failed to fetch containers:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (containerId, action) => {
        setActionLoading((prev) => ({ ...prev, [containerId]: action }));
        setError(null);
        try {
            const response = await fetch(`/api/docker/containers/${containerId}/${action}`, {
                method: 'POST',
            });
            const data = await response.json();
            if (response.ok) {
                fetchContainers();
            } else {
                setError(data.details || data.error || `Failed to ${action} container`);
            }
        } catch (err) {
            setError(`Failed to ${action} container`);
            console.error(`Failed to ${action} container:`, err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [containerId]: null }));
        }
    };

    const handleDelete = async () => {
        const { container } = deleteModal;
        if (!container) return;

        setActionLoading((prev) => ({ ...prev, [container.ID]: 'deleting' }));
        setError(null);
        try {
            const response = await fetch(`/api/docker/containers/${container.ID}?force=true&v=true`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (response.ok) {
                fetchContainers();
                setDeleteModal({ open: false, container: null });
            } else {
                setError(data.details || data.error || 'Failed to delete container');
            }
        } catch (err) {
            setError('Failed to delete container');
            console.error('Failed to delete container:', err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [container.ID]: null }));
        }
    };

    const getStatusColor = (state) => {
        switch (state) {
            case 'running':
                return 'green';
            case 'exited':
                return 'red';
            case 'paused':
                return 'yellow';
            case 'created':
                return 'blue';
            default:
                return 'gray';
        }
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Box>
                    <Title order={3}>Containers</Title>
                    <Text c="dimmed" size="sm">
                        Manage your Docker containers
                    </Text>
                </Box>
                <Group>
                    <Switch
                        label="Show stopped"
                        checked={showAll}
                        onChange={(e) => setShowAll(e.currentTarget.checked)}
                    />
                    <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchContainers}
                    >
                        Refresh
                    </Button>
                </Group>
            </Group>

            {containers.length === 0 ? (
                <Card padding="lg" radius="md" withBorder>
                    <Box style={{ textAlign: 'center', padding: '40px' }}>
                        <IconBox size={48} style={{ opacity: 0.3 }} />
                        <Text mt="md" c="dimmed">No containers found</Text>
                    </Box>
                </Card>
            ) : (
                <>
                    {error && (
                        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                            {error}
                        </Alert>
                    )}
                    {containers.map((container) => (
                    <Card key={container.ID} padding="md" radius="md" withBorder>
                        <Group justify="space-between">
                            <Box>
                                <Group gap="sm">
                                    <Text fw={600}>{container.Names || 'Unnamed'}</Text>
                                    <Badge color={getStatusColor(container.State)} variant="light">
                                        {container.State}
                                    </Badge>
                                </Group>
                                <Text size="xs" c="dimmed" mt={4}>
                                    ID: {container.ID.substring(0, 12)} | Image: {container.Image}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    Created: {container.CreatedAt}
                                </Text>
                            </Box>
                            <Group gap="xs">
                                {container.State === 'running' ? (
                                    <>
                                        <ActionIcon
                                            variant="light"
                                            color="yellow"
                                            onClick={() => handleAction(container.ID, 'stop')}
                                            loading={actionLoading[container.ID] === 'stop'}
                                            title="Stop"
                                        >
                                            <IconPlayerStop size={16} />
                                        </ActionIcon>
                                        <ActionIcon
                                            variant="light"
                                            color="blue"
                                            onClick={() => handleAction(container.ID, 'restart')}
                                            loading={actionLoading[container.ID] === 'restart'}
                                            title="Restart"
                                        >
                                            <IconRefresh size={16} />
                                        </ActionIcon>
                                    </>
                                ) : (
                                    <ActionIcon
                                        variant="light"
                                        color="green"
                                        onClick={() => handleAction(container.ID, 'start')}
                                        loading={actionLoading[container.ID] === 'start'}
                                        title="Start"
                                    >
                                        <IconPlayerPlay size={16} />
                                    </ActionIcon>
                                )}
                                <ActionIcon
                                    variant="light"
                                    color="red"
                                    onClick={() => setDeleteModal({ open: true, container })}
                                    loading={actionLoading[container.ID] === 'deleting'}
                                    title="Delete"
                                >
                                    <IconTrash size={16} />
                                </ActionIcon>
                            </Group>
                        </Group>
                    </Card>
                    ))}
                </>
            )}

            <Modal
                opened={deleteModal.open}
                onClose={() => { setDeleteModal({ open: false, container: null }); setError(null); }}
                title="Delete Container"
            >
                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                        {error}
                    </Alert>
                )}
                <Text>
                    Are you sure you want to delete container{' '}
                    <strong>{deleteModal.container?.Names}</strong>?
                    This will also remove associated volumes.
                </Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setDeleteModal({ open: false, container: null })}>
                        Cancel
                    </Button>
                    <Button color="red" onClick={handleDelete}>
                        Delete
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
}
