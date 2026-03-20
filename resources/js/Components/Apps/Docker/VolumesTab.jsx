import { useEffect, useState } from 'react';
import { Box, Title, Text, Card, Badge, Group, ActionIcon, Stack, Loader, Button, Modal, TextInput, Select, Alert, Tooltip } from '@mantine/core';
import { IconTrash, IconHierarchy2, IconPlus, IconRefresh, IconAlertCircle } from '@tabler/icons-react';

export function VolumesTab() {
    const [loading, setLoading] = useState(true);
    const [volumes, setVolumes] = useState([]);
    const [createModal, setCreateModal] = useState({ open: false });
    const [deleteModal, setDeleteModal] = useState({ open: false, volume: null });
    const [createLoading, setCreateLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchVolumes();
    }, []);

    const fetchVolumes = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/docker/volumes');
            if (response.ok) {
                const data = await response.json();
                setVolumes(data.Volumes || []);
            }
        } catch (err) {
            console.error('Failed to fetch volumes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        const name = createModal.name?.trim();
        if (!name) return;

        setCreateLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/docker/volumes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, driver: createModal.driver || 'local' }),
            });
            const data = await response.json();
            if (response.ok) {
                fetchVolumes();
                setCreateModal({ open: false });
            } else {
                setError(data.details || data.error || 'Failed to create volume');
            }
        } catch (err) {
            setError('Failed to create volume');
            console.error('Failed to create volume:', err);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async () => {
        const { volume } = deleteModal;
        if (!volume) return;

        setActionLoading((prev) => ({ ...prev, [volume.Name]: 'deleting' }));
        setError(null);
        try {
            const response = await fetch(`/api/docker/volumes/${volume.Name}?force=true`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (response.ok) {
                fetchVolumes();
                setDeleteModal({ open: false, volume: null });
            } else {
                setError(data.details || data.error || 'Failed to delete volume');
            }
        } catch (err) {
            setError('Failed to delete volume');
            console.error('Failed to delete volume:', err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [volume.Name]: null }));
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
                    <Title order={3}>Volumes</Title>
                    <Text c="dimmed" size="sm">
                        Manage your Docker volumes
                    </Text>
                </Box>
                <Group>
                    <Button
                        variant="light"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => setCreateModal({ open: true })}
                    >
                        Create Volume
                    </Button>
                    <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchVolumes}
                    >
                        Refresh
                    </Button>
                </Group>
            </Group>

            {volumes.length === 0 ? (
                <Card padding="lg" radius="md" withBorder>
                    <Box style={{ textAlign: 'center', padding: '40px' }}>
                        <IconHierarchy2 size={48} style={{ opacity: 0.3 }} />
                        <Text mt="md" c="dimmed">No volumes found</Text>
                    </Box>
                </Card>
            ) : (
                volumes.map((volume) => (
                    <Card key={volume.Name} padding="md" radius="md" withBorder>
                        <Group justify="space-between">
                            <Box>
                                <Group gap="sm">
                                    <Text fw={600}>{volume.Name}</Text>
                                    <Badge variant="light" color="blue">
                                        {volume.Driver || 'local'}
                                    </Badge>
                                </Group>
                                <Text size="xs" c="dimmed" mt={4}>
                                    Scope: {volume.Scope || 'local'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    Mountpoint: {volume.Mountpoint || 'N/A'}
                                </Text>
                            </Box>
                            <Tooltip label="Delete volume">
                                <ActionIcon
                                    variant="light"
                                    color="red"
                                    onClick={() => setDeleteModal({ open: true, volume })}
                                >
                                    <IconTrash size={16} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    </Card>
                ))
            )}

            <Modal
                opened={createModal.open}
                onClose={() => { setCreateModal({ open: false }); setError(null); }}
                title="Create Volume"
            >
                <Stack>
                    {error && (
                        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                            {error}
                        </Alert>
                    )}
                    <TextInput
                        label="Volume name"
                        placeholder="my-volume"
                        value={createModal.name || ''}
                        onChange={(e) => setCreateModal({ ...createModal, name: e.target.value })}
                    />
                    <Select
                        label="Driver"
                        data={[
                            { value: 'local', label: 'local' },
                        ]}
                        value={createModal.driver || 'local'}
                        onChange={(value) => setCreateModal({ ...createModal, driver: value })}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setCreateModal({ open: false })}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} loading={createLoading}>
                            Create
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <Modal
                opened={deleteModal.open}
                onClose={() => { setDeleteModal({ open: false, volume: null }); setError(null); }}
                title="Delete Volume"
            >
                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                        {error}
                    </Alert>
                )}
                <Text>
                    Are you sure you want to delete volume{' '}
                    <strong>{deleteModal.volume?.Name}</strong>?
                    All data in this volume will be lost.
                </Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setDeleteModal({ open: false, volume: null })}>
                        Cancel
                    </Button>
                    <Button color="red" onClick={handleDelete} loading={actionLoading[deleteModal.volume?.Name || ''] === 'deleting'}>
                        Delete
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
}
