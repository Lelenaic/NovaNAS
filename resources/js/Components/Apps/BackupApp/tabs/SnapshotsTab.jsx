import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    Badge,
    Loader,
    Alert,
    ActionIcon,
    Select,
    Stack,
    Table,
    useMantineTheme,
    Tooltip,
} from '@mantine/core';
import {
    IconRefresh,
    IconTrash,
    IconCamera,
} from '@tabler/icons-react';
import { useConfirmModal } from '../../../ConfirmModal';

export function SnapshotsTab() {
    const theme = useMantineTheme();
    const [repositories, setRepositories] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);
    const [error, setError] = useState(null);
    const [confirmDelete, deleteConfirmModal] = useConfirmModal();

    useEffect(() => {
        fetchRepositories();
    }, []);

    useEffect(() => {
        if (selectedRepo) {
            fetchSnapshots();
        }
    }, [selectedRepo]);

    const fetchRepositories = async () => {
        try {
            const response = await fetch('/api/backup/repositories');
            const data = await response.json();
            const repos = (data.repositories || []).filter(r => r.is_initialized);
            setRepositories(repos);
            if (repos.length > 0) {
                setSelectedRepo(repos[0].id);
            }
        } catch (err) {
            setError('Failed to fetch repositories');
        } finally {
            setLoading(false);
        }
    };

    const fetchSnapshots = async () => {
        if (!selectedRepo) return;

        setLoadingSnapshots(true);
        try {
            const response = await fetch(`/api/backup/repositories/${selectedRepo}/snapshots`);
            const data = await response.json();

            if (data.success) {
                setSnapshots(data.snapshots || []);
            } else {
                setError(data.message || 'Failed to fetch backups');
                setSnapshots([]);
            }
        } catch (err) {
            setError('Failed to fetch backups');
            setSnapshots([]);
        } finally {
            setLoadingSnapshots(false);
        }
    };

    const handleDelete = async (snapshotId) => {
        const confirmed = await confirmDelete({
            title: 'Delete Backup',
            message: 'Are you sure you want to delete this backup?',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;

        try {
            const response = await fetch(
                `/api/backup/repositories/${selectedRepo}/snapshots/${snapshotId}`,
                { method: 'DELETE' }
            );
            const data = await response.json();

            if (data.success) {
                fetchSnapshots();
            } else {
                setError(data.message || 'Failed to delete backup');
            }
        } catch (err) {
            setError('Failed to delete backup');
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return 'N/A';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString();
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <Loader size="md" />
            </Box>
        );
    }

    return (
        <Box>
            <Group justify="space-between" mb="lg">
                <Title order={3}>Backup History</Title>
                <Group>
                    <Select
                        placeholder="Select destination"
                        data={repositories.map(r => ({ value: r.id, label: r.name }))}
                        value={selectedRepo}
                        onChange={setSelectedRepo}
                        style={{ width: '250px' }}
                    />
                    <Button
                        variant="light"
                        color="green"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchSnapshots}
                        loading={loadingSnapshots}
                    >
                        Refresh
                    </Button>
                </Group>
            </Group>

            {error && (
                <Alert color="red" mb="md" onClose={() => setError(null)} withCloseButton>
                    {error}
                </Alert>
            )}

            {repositories.length === 0 ? (
                <Box style={{ textAlign: 'center', padding: '40px 0' }}>
                    <IconCamera size={48} style={{ color: theme.colors.gray[5], marginBottom: '16px' }} />
                    <Text c="dimmed">No initialized destinations found.</Text>
                    <Text size="sm" c="dimmed" mt={4}>
                        Create and initialize a destination to view backups.
                    </Text>
                </Box>
            ) : loadingSnapshots ? (
                <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                    <Loader size="md" />
                </Box>
            ) : snapshots.length === 0 ? (
                <Box style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Text c="dimmed">No backups found in this destination.</Text>
                    <Text size="sm" c="dimmed" mt={4}>
                        Run a backup job to create your first backup.
                    </Text>
                </Box>
            ) : (
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '8px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                        overflow: 'hidden',
                    }}
                >
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>ID</Table.Th>
                                <Table.Th>Time</Table.Th>
                                <Table.Th>Hostname</Table.Th>
                                <Table.Th>Paths</Table.Th>
                                <Table.Th>Tags</Table.Th>
                                <Table.Th>Size</Table.Th>
                                <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {snapshots.map((snapshot) => (
                                <Table.Tr key={snapshot.id}>
                                    <Table.Td>
                                        <Text fw={500} style={{ fontFamily: 'monospace' }}>
                                            {snapshot.short_id || snapshot.id?.substring(0, 8)}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>{formatDate(snapshot.time)}</Table.Td>
                                    <Table.Td>{snapshot.hostname || 'N/A'}</Table.Td>
                                    <Table.Td>
                                        <Text size="sm" style={{ maxWidth: '200px' }} truncate="end">
                                            {(snapshot.paths || []).join(', ')}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap={4}>
                                            {(snapshot.tags || []).map((tag) => (
                                                <Badge key={tag} size="sm" color="green">{tag}</Badge>
                                            ))}
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>{formatBytes(snapshot.size)}</Table.Td>
                                    <Table.Td>
                                        <Tooltip label="Delete Backup">
                                            <ActionIcon
                                                color="red"
                                                variant="subtle"
                                                size="sm"
                                                onClick={() => handleDelete(snapshot.id)}
                                            >
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Box>
            )}

            {deleteConfirmModal}
        </Box>
    );
}
