import { useEffect, useState } from 'react';
import { Box, Title, Text, Card, Badge, Group, ActionIcon, Stack, Loader, Button, Modal, TextInput, Select, Alert, Tooltip } from '@mantine/core';
import { IconTrash, IconNetwork, IconPlus, IconRefresh, IconAlertCircle } from '@tabler/icons-react';

export function NetworksTab() {
    const [loading, setLoading] = useState(true);
    const [networks, setNetworks] = useState([]);
    const [createModal, setCreateModal] = useState({ open: false });
    const [deleteModal, setDeleteModal] = useState({ open: false, network: null });
    const [createLoading, setCreateLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchNetworks();
    }, []);

    const fetchNetworks = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/docker/networks');
            if (response.ok) {
                const data = await response.json();
                setNetworks(data);
            }
        } catch (err) {
            console.error('Failed to fetch networks:', err);
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
            const response = await fetch('/api/docker/networks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    driver: createModal.driver || 'bridge',
                    subnet: createModal.subnet || null,
                    gateway: createModal.gateway || null,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                fetchNetworks();
                setCreateModal({ open: false });
            } else {
                setError(data.details || data.error || 'Failed to create network');
            }
        } catch (err) {
            setError('Failed to create network');
            console.error('Failed to create network:', err);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async () => {
        const { network } = deleteModal;
        if (!network) return;

        setActionLoading((prev) => ({ ...prev, [network.ID]: 'deleting' }));
        setError(null);
        try {
            const response = await fetch(`/api/docker/networks/${network.ID}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (response.ok) {
                fetchNetworks();
                setDeleteModal({ open: false, network: null });
            } else {
                setError(data.details || data.error || 'Failed to delete network');
            }
        } catch (err) {
            setError('Failed to delete network');
            console.error('Failed to delete network:', err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [network.ID]: null }));
        }
    };

    const getDriverColor = (driver) => {
        switch (driver) {
            case 'bridge':
                return 'blue';
            case 'host':
                return 'orange';
            case 'overlay':
                return 'violet';
            case 'macvlan':
                return 'green';
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
                    <Title order={3}>Networks</Title>
                    <Text c="dimmed" size="sm">
                        Manage your Docker networks
                    </Text>
                </Box>
                <Group>
                    <Button
                        variant="light"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => setCreateModal({ open: true })}
                    >
                        Create Network
                    </Button>
                    <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchNetworks}
                    >
                        Refresh
                    </Button>
                </Group>
            </Group>

            {networks.length === 0 ? (
                <Card padding="lg" radius="md" withBorder>
                    <Box style={{ textAlign: 'center', padding: '40px' }}>
                        <IconNetwork size={48} style={{ opacity: 0.3 }} />
                        <Text mt="md" c="dimmed">No networks found</Text>
                    </Box>
                </Card>
            ) : (
                networks.map((network) => {
                    const isSystemNetwork = ['bridge', 'host', 'none'].includes(network.Name);

                    return (
                        <Card key={network.ID} padding="md" radius="md" withBorder>
                            <Group justify="space-between">
                                <Box>
                                    <Group gap="sm">
                                        <Text fw={600}>{network.Name}</Text>
                                        <Badge variant="light" color={getDriverColor(network.Driver)}>
                                            {network.Driver}
                                        </Badge>
                                        {network.Internal && (
                                            <Badge variant="light" color="red">Internal</Badge>
                                        )}
                                        {network.Attachable && (
                                            <Badge variant="light" color="green">Attachable</Badge>
                                        )}
                                    </Group>
                                    <Text size="xs" c="dimmed" mt={4}>
                                        ID: {network.ID.substring(0, 12)}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        Scope: {network.Scope}
                                    </Text>
                                    {network.IPAM?.Config?.[0] && (
                                        <Text size="xs" c="dimmed">
                                            Subnet: {network.IPAM.Config[0].Subnet || 'N/A'} | Gateway: {network.IPAM.Config[0].Gateway || 'N/A'}
                                        </Text>
                                    )}
                                </Box>
                                <Tooltip label="Delete network">
                                    <ActionIcon
                                        variant="light"
                                        color="red"
                                        onClick={() => setDeleteModal({ open: true, network })}
                                        disabled={isSystemNetwork}
                                    >
                                        <IconTrash size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        </Card>
                    );
                })
            )}

            <Modal
                opened={createModal.open}
                onClose={() => { setCreateModal({ open: false }); setError(null); }}
                title="Create Network"
            >
                <Stack>
                    {error && (
                        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                            {error}
                        </Alert>
                    )}
                    <TextInput
                        label="Network name"
                        placeholder="my-network"
                        value={createModal.name || ''}
                        onChange={(e) => setCreateModal({ ...createModal, name: e.target.value })}
                    />
                    <Select
                        label="Driver"
                        data={[
                            { value: 'bridge', label: 'bridge' },
                            { value: 'host', label: 'host' },
                            { value: 'overlay', label: 'overlay' },
                            { value: 'macvlan', label: 'macvlan' },
                        ]}
                        value={createModal.driver || 'bridge'}
                        onChange={(value) => setCreateModal({ ...createModal, driver: value })}
                    />
                    <TextInput
                        label="Subnet (optional)"
                        placeholder="172.20.0.0/16"
                        value={createModal.subnet || ''}
                        onChange={(e) => setCreateModal({ ...createModal, subnet: e.target.value })}
                    />
                    <TextInput
                        label="Gateway (optional)"
                        placeholder="172.20.0.1"
                        value={createModal.gateway || ''}
                        onChange={(e) => setCreateModal({ ...createModal, gateway: e.target.value })}
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
                onClose={() => { setDeleteModal({ open: false, network: null }); setError(null); }}
                title="Delete Network"
            >
                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                        {error}
                    </Alert>
                )}
                <Text>
                    Are you sure you want to delete network{' '}
                    <strong>{deleteModal.network?.Name}</strong>?
                    Containers connected to this network will be disconnected.
                </Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setDeleteModal({ open: false, network: null })}>
                        Cancel
                    </Button>
                    <Button color="red" onClick={handleDelete} loading={actionLoading[deleteModal.network?.ID || ''] === 'deleting'}>
                        Delete
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
}
