import { useEffect, useState } from 'react';
import { Box, Title, Text, Card, Badge, Group, ActionIcon, Stack, Loader, Button, Modal, TextInput, PasswordInput, Alert, Table, ScrollArea, Tooltip } from '@mantine/core';
import { IconRefresh, IconTrash, IconPlus, IconLogin, IconLogout, IconKey, IconAlertCircle, IconCloud } from '@tabler/icons-react';
import { useConfirmModal } from '../../ConfirmModal';

export function RegistriesTab() {
    const [loading, setLoading] = useState(true);
    const [registries, setRegistries] = useState([]);
    const [debugInfo, setDebugInfo] = useState(null);
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [confirmRemove, removeConfirmModal] = useConfirmModal();

    // Add registry modal
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newRegistry, setNewRegistry] = useState({ address: '', username: '', password: '' });
    const [addLoading, setAddLoading] = useState(false);

    useEffect(() => {
        fetchRegistries();
    }, []);

    const fetchRegistries = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/docker/registries');
            if (response.ok) {
                const data = await response.json();
                // Handle both old format (array) and new format (object with registries)
                if (Array.isArray(data)) {
                    setRegistries(data);
                    setDebugInfo(null);
                } else if (data.registries) {
                    setRegistries(data.registries);
                    setDebugInfo(data.debug);
                }
            }
        } catch (err) {
            console.error('Failed to fetch registries:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRegistry = async () => {
        if (!newRegistry.address || !newRegistry.username || !newRegistry.password) {
            setError('Please fill in all fields');
            return;
        }

        setAddLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/docker/registries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRegistry),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('Registry added and logged in successfully');
                setAddModalOpen(false);
                setNewRegistry({ address: '', username: '', password: '' });
                fetchRegistries();
            } else {
                setError(data.details || data.error || 'Failed to add registry');
            }
        } catch (err) {
            setError('Failed to add registry');
            console.error('Failed to add registry:', err);
        } finally {
            setAddLoading(false);
        }
    };

    const handleLogin = async (registryAddress) => {
        setActionLoading((prev) => ({ ...prev, [registryAddress]: 'login' }));
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/docker/registries/${encodeURIComponent(registryAddress)}/login`, {
                method: 'POST',
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Successfully logged in to ${registryAddress}`);
                fetchRegistries();
            } else {
                setError(data.details || data.error || 'Failed to login');
            }
        } catch (err) {
            setError('Failed to login');
            console.error('Failed to login:', err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [registryAddress]: null }));
        }
    };

    const handleLogout = async (registryAddress) => {
        setActionLoading((prev) => ({ ...prev, [registryAddress]: 'logout' }));
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/docker/registries/${encodeURIComponent(registryAddress)}/logout`, {
                method: 'POST',
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Successfully logged out from ${registryAddress}`);
                fetchRegistries();
            } else {
                setError(data.details || data.error || 'Failed to logout');
            }
        } catch (err) {
            setError('Failed to logout');
            console.error('Failed to logout:', err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [registryAddress]: null }));
        }
    };

    const handleRemove = async (registryAddress) => {
        const confirmed = await confirmRemove({
            title: 'Remove Registry',
            message: `Are you sure you want to remove ${registryAddress}?`,
            confirmLabel: 'Remove',
        });
        if (!confirmed) {
            return;
        }

        setActionLoading((prev) => ({ ...prev, [registryAddress]: 'remove' }));
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/docker/registries/${encodeURIComponent(registryAddress)}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Registry ${registryAddress} removed`);
                fetchRegistries();
            } else {
                setError(data.details || data.error || 'Failed to remove registry');
            }
        } catch (err) {
            setError('Failed to remove registry');
            console.error('Failed to remove registry:', err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [registryAddress]: null }));
        }
    };

    const getStatusBadge = (isLoggedIn) => {
        if (isLoggedIn) {
            return <Badge color="green" variant="light">Logged In</Badge>;
        }
        return <Badge color="gray" variant="light">Not Logged In</Badge>;
    };

    const getRegistryUrl = (address) => {
        if (address.includes('://')) {
            return address;
        }
        return `https://${address}`;
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
                    <Title order={3}>Registries</Title>
                    <Text c="dimmed" size="sm">
                        Manage Docker registry credentials for pulling private images
                    </Text>
                </Box>
                <Group>
                    <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchRegistries}
                    >
                        Refresh
                    </Button>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() => setAddModalOpen(true)}
                    >
                        Add Registry
                    </Button>
                </Group>
            </Group>

            {debugInfo && (
                <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="blue"
                    variant="light"
                    title="Debug Info"
                >
                    <Text size="xs">
                        <strong>HOME:</strong> {debugInfo.home_env || '(empty)'}<br />
                        <strong>Config Path:</strong> {debugInfo.config_path}<br />
                        <strong>File Exists:</strong> {debugInfo.file_exists ? 'Yes' : 'No'}
                    </Text>
                    {debugInfo.file_contents && (
                        <Text size="xs" mt="xs">
                            <strong>File Contents:</strong><br />
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {debugInfo.file_contents}
                            </pre>
                        </Text>
                    )}
                </Alert>
            )}

            {(error || success) && (
                <Alert
                    icon={error ? <IconAlertCircle size={16} /> : <IconKey size={16} />}
                    color={error ? 'red' : 'green'}
                    variant="light"
                    onClose={() => { setError(null); setSuccess(null); }}
                    withCloseButton
                >
                    {error || success}
                </Alert>
            )}

            <Card padding="lg" radius="md" withBorder>
                <Text c="dimmed" size="sm" mb="md">
                    Configure Docker registries to pull private images. The default Docker Hub registry is pre-configured.
                </Text>

                {registries.length === 0 ? (
                    <Box style={{ textAlign: 'center', padding: '40px' }}>
                        <IconCloud size={48} style={{ opacity: 0.3 }} />
                        <Text mt="md" c="dimmed">No registries configured</Text>
                        <Text size="xs" c="dimmed" mt="xs">
                            Add a registry to pull private images
                        </Text>
                    </Box>
                ) : (
                    <ScrollArea>
                        <Table striped highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Registry Address</Table.Th>
                                    <Table.Th>Username</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {registries.map((registry) => (
                                    <Table.Tr key={registry.address}>
                                        <Table.Td>
                                            <Text fw={500}>{registry.address}</Text>
                                            <Text size="xs" c="dimmed">{getRegistryUrl(registry.address)}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text>{registry.username}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            {getStatusBadge(registry.isLoggedIn)}
                                        </Table.Td>
                                        <Table.Td>
                                            <Tooltip label="Logout and remove credentials">
                                                <ActionIcon
                                                    variant="light"
                                                    color="red"
                                                    onClick={() => handleLogout(registry.address)}
                                                    loading={actionLoading[registry.address] === 'logout'}
                                                >
                                                    <IconLogout size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                )}
            </Card>

            {/* Add Registry Modal */}
            <Modal
                opened={addModalOpen}
                onClose={() => { setAddModalOpen(false); setError(null); setNewRegistry({ address: '', username: '', password: '' }); }}
                title="Add Registry"
            >
                <Stack>
                    {error && (
                        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                            {error}
                        </Alert>
                    )}

                    <TextInput
                        label="Registry Address"
                        placeholder="registry.example.com or docker.io"
                        description="Enter the registry hostname. For Docker Hub, use 'docker.io' or leave empty"
                        value={newRegistry.address}
                        onChange={(e) => setNewRegistry(prev => ({ ...prev, address: e.target.value }))}
                    />
                    <TextInput
                        label="Username"
                        placeholder="your-username"
                        value={newRegistry.username}
                        onChange={(e) => setNewRegistry(prev => ({ ...prev, username: e.target.value }))}
                    />
                    <PasswordInput
                        label="Password / Access Token"
                        placeholder="your-password-or-token"
                        description="Use an access token for Docker Hub for better security"
                        value={newRegistry.password}
                        onChange={(e) => setNewRegistry(prev => ({ ...prev, password: e.target.value }))}
                    />

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={() => setAddModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddRegistry} loading={addLoading}>
                            Add & Login
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {removeConfirmModal}
        </Stack>
    );
}
