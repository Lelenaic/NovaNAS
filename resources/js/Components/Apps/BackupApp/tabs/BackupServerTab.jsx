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
    TextInput,
    Stack,
    Modal,
    Switch,
    Table,
    Tooltip,
    useMantineTheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    IconPlus,
    IconTrash,
    IconRefresh,
    IconServer,
    IconCheck,
    IconX,
    IconCopy,
    IconAlertCircle,
    IconFolder,
} from '@tabler/icons-react';
import { useConfirmModal } from '../../../ConfirmModal';
import { FileSelector } from '../../../FileSelector';

export function BackupServerTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [keys, setKeys] = useState([]);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [confirmDelete, deleteConfirmModal] = useConfirmModal();
    const [opened, { open: openModal, close: closeModal }] = useDisclosure(false);
    const [keyName, setKeyName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createdKey, setCreatedKey] = useState(null);
    const [backupPath, setBackupPath] = useState('');
    const [savingPath, setSavingPath] = useState(false);
    const [fileSelectorOpened, setFileSelectorOpened] = useState(false);
    const [copied, setCopied] = useState(false);
    const [deletingKey, setDeletingKey] = useState(null);
    const [modalError, setModalError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statusRes, keysRes] = await Promise.all([
                fetch('/api/backup/server/status'),
                fetch('/api/backup/server/keys'),
            ]);
            const statusData = await statusRes.json();
            const keysData = await keysRes.json();

            setStatus(statusData);
            setKeys(keysData.keys || []);
            setBackupPath(statusData.backup_path || '');
        } catch (err) {
            setError('Failed to load backup server data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async () => {
        setCreating(true);
        setModalError(null);
        try {
            const response = await fetch('/api/backup/server/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: keyName }),
            });

            const data = await response.json();

            if (response.ok) {
                setCreatedKey({ name: data.name, key: data.key });
                setKeyName('');
                setModalError(null);
                fetchData();
            } else {
                setModalError(data.message || 'Failed to create API key');
            }
        } catch (err) {
            setModalError('Failed to create API key');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteKey = async (name) => {
        const confirmed = await confirmDelete({
            title: 'Delete API Key',
            message: `Are you sure you want to delete the API key "${name}"? The backup server will be disabled if this is the last key.`,
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;

        setDeletingKey(name);
        try {
            const response = await fetch(`/api/backup/server/keys/${encodeURIComponent(name)}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchData();
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to delete API key');
            }
        } catch (err) {
            setError('Failed to delete API key');
        } finally {
            setDeletingKey(null);
        }
    };

    const handleSavePath = async () => {
        setSavingPath(true);
        setError(null);
        try {
            const response = await fetch('/api/backup/server/path', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backup_path: backupPath }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('Backup path updated successfully.');
                setTimeout(() => setSuccess(null), 3000);
                fetchData();
            } else {
                setError(data.message || 'Failed to update backup path');
            }
        } catch (err) {
            setError('Failed to update backup path');
        } finally {
            setSavingPath(false);
        }
    };

    const copyToClipboard = async (text) => {
        if (window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
                <Title order={3}>Backup Server</Title>
                <Button
                    variant="light"
                    color="green"
                    leftSection={<IconRefresh size={16} />}
                    onClick={fetchData}
                >
                    Refresh
                </Button>
            </Group>

            {error && (
                <Alert color="red" mb="md" onClose={() => setError(null)} withCloseButton icon={<IconAlertCircle size={16} />}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert color="green" mb="md" onClose={() => setSuccess(null)} withCloseButton icon={<IconCheck size={16} />}>
                    {success}
                </Alert>
            )}

            {/* Service Status */}
            <Box
                mb="md"
                p="md"
                style={{
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                }}
            >
                <Group justify="space-between">
                    <Box>
                        <Group gap="sm" mb="xs">
                            <IconServer size={20} />
                            <Title order={5}>Rest Server Service</Title>
                            <Badge
                                color={status?.enabled ? 'green' : 'gray'}
                                variant="light"
                                leftSection={status?.enabled ? <IconCheck size={12} /> : <IconX size={12} />}
                            >
                                {status?.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            <Badge
                                color={status?.active ? 'blue' : 'orange'}
                                variant="light"
                                leftSection={status?.active ? <IconCheck size={12} /> : <IconX size={12} />}
                            >
                                {status?.active ? 'Running' : 'Stopped'}
                            </Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                            The restic REST server is managed automatically based on API keys.
                            {status?.api_key_count === 0 && ' Create an API key to start the service.'}
                        </Text>
                    </Box>
                </Group>
            </Box>

            {/* Backup Path */}
            <Box
                mb="md"
                p="md"
                style={{
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                }}
            >
                <Title order={5} mb="sm">Backup Path</Title>
                <Text size="sm" c="dimmed" mb="sm">
                    The directory where backups are stored. Changing this will restart the backup server.
                </Text>
                <Group gap="xs">
                    <TextInput
                        value={backupPath}
                        onChange={(e) => setBackupPath(e.target.value)}
                        style={{ flex: 1 }}
                        placeholder="storage/backups"
                    />
                    <Tooltip label="Browse">
                        <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => setFileSelectorOpened(true)}
                            mt="auto"
                            mb="2px"
                        >
                            <IconFolder size={16} />
                        </ActionIcon>
                    </Tooltip>
                    <Button
                        color="green"
                        onClick={handleSavePath}
                        loading={savingPath}
                        disabled={!backupPath}
                    >
                        Save
                    </Button>
                </Group>
            </Box>

            {/* API Keys */}
            <Box
                p="md"
                style={{
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                }}
            >
                <Group justify="space-between" mb="sm">
                    <Title order={5}>API Keys</Title>
                    <Button
                        color="green"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => { setKeyName(''); setCreatedKey(null); setModalError(null); openModal(); }}
                    >
                        Generate Key
                    </Button>
                </Group>
                <Text size="sm" c="dimmed" mb="sm">
                    API keys are used by remote NovaNAS instances to authenticate with this backup server.
                </Text>

                {keys.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                        No API keys created yet. Generate a key to get started.
                    </Text>
                ) : (
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Name</Table.Th>
                                <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {keys.map((key) => (
                                <Table.Tr key={key.name}>
                                    <Table.Td>
                                        <Text fw={500} style={{ fontFamily: 'monospace' }}>{key.name}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Tooltip label="Delete">
                                            <ActionIcon
                                                color="red"
                                                variant="subtle"
                                                size="sm"
                                                loading={deletingKey === key.name}
                                                onClick={() => handleDeleteKey(key.name)}
                                            >
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Box>

            {/* Create Key Modal */}
            <Modal opened={opened} onClose={closeModal} title="Generate API Key" size="md">
                {createdKey ? (
                    <Stack gap="md">
                        <Alert color="green" icon={<IconCheck size={16} />}>
                            API key created successfully. Copy it now — it won't be shown again.
                        </Alert>
                        <Box
                            p="sm"
                            style={{
                                backgroundColor: theme.colors.dark[6],
                                borderRadius: '8px',
                                border: `1px solid ${theme.colors.dark[4]}`,
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                wordBreak: 'break-all',
                                userSelect: 'all',
                            }}
                        >
                            {createdKey.key}
                        </Box>
                        <Group>
                            <Button
                                variant="light"
                                leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                color={copied ? 'green' : 'blue'}
                                onClick={() => copyToClipboard(createdKey.key)}
                            >
                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                            </Button>
                        </Group>
                        <Text size="sm" c="dimmed">
                            Paste it directly into the backup client's API key field.
                        </Text>
                        <Group justify="flex-end">
                            <Button onClick={closeModal}>Done</Button>
                        </Group>
                    </Stack>
                ) : (
                    <Stack gap="md">
                        <TextInput
                            label="Key Name"
                            placeholder="e.g., my-other-nas"
                            description="A unique name to identify this key. Letters, numbers, dots, dashes, and underscores only."
                            value={keyName}
                            onChange={(e) => setKeyName(e.target.value)}
                            required
                        />
                        <Alert color="blue" icon={<IconAlertCircle size={16} />}>
                            <Text size="sm">
                                The generated key will be a base64-encoded string containing the username and password.
                                You'll only see it once.
                            </Text>
                        </Alert>
                        {modalError && (
                            <Alert color="red" icon={<IconAlertCircle size={16} />}>
                                <Text size="sm">{modalError}</Text>
                            </Alert>
                        )}
                        <Group justify="flex-end">
                            <Button variant="default" onClick={closeModal}>Cancel</Button>
                            <Button
                                color="green"
                                onClick={handleCreateKey}
                                loading={creating}
                                disabled={!keyName}
                            >
                                Generate
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Modal>

            <FileSelector
                opened={fileSelectorOpened}
                onClose={() => setFileSelectorOpened(false)}
                onSelect={(path) => setBackupPath(path)}
                title="Select Backup Directory"
                allowFiles={false}
                showFiles={false}
                useSudo={true}
            />

            {deleteConfirmModal}
        </Box>
    );
}
