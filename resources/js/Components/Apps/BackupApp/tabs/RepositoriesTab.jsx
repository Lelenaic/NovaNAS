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
    Select,
    Stack,
    Modal,
    PasswordInput,
    NumberInput,
    Switch,
    useMantineTheme,
    Tooltip,
    Collapse,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    IconPlus,
    IconTrash,
    IconEdit,
    IconRefresh,
    IconCheck,
    IconDatabase,
    IconChevronDown,
    IconChevronUp,
    IconPlug,
    IconFolder,
    IconAlertCircle,
} from '@tabler/icons-react';
import { FileSelector } from '../../../FileSelector';
import { useConfirmModal } from '../../../ConfirmModal';

export function RepositoriesTab() {
    const theme = useMantineTheme();
    const [repositories, setRepositories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [confirmDelete, deleteConfirmModal] = useConfirmModal();
    const [opened, { open: openModal, close: closeModal }] = useDisclosure(false);
    const [editingRepo, setEditingRepo] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [providerFields, setProviderFields] = useState([]);
    const [expandedRepo, setExpandedRepo] = useState(null);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [checking, setChecking] = useState(null);
    const [success, setSuccess] = useState(null);
    const [fileSelectorOpened, setFileSelectorOpened] = useState(false);
    const [modalError, setModalError] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        storage_type: 'local',
        repo_path: '',
        credentials: {},
    });

    useEffect(() => {
        fetchRepositories();
        fetchProviderFields();
    }, []);

    const fetchRepositories = async () => {
        try {
            const response = await fetch('/api/backup/repositories');
            const data = await response.json();
            setRepositories(data.repositories || []);
        } catch (err) {
            setError('Failed to fetch repositories');
        } finally {
            setLoading(false);
        }
    };

    const fetchProviderFields = async () => {
        try {
            const response = await fetch('/api/backup/provider-fields');
            const data = await response.json();
            setProviderFields(data.providers || []);
        } catch (err) {
            console.error('Failed to fetch provider fields:', err);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setModalError(null);
        try {
            const url = editingRepo
                ? `/api/backup/repositories/${editingRepo.id}`
                : '/api/backup/repositories';
            const method = editingRepo ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                closeModal();
                resetForm();
                fetchRepositories();
            } else {
                const data = await response.json();
                setModalError(data.message || 'Failed to save destination');
            }
        } catch (err) {
            setModalError('Failed to save destination');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (repo) => {
        setEditingRepo(repo);
        setFormData({
            name: repo.name,
            storage_type: repo.storage_type,
            repo_path: repo.repo_path,
            credentials: {},
        });
        setModalError(null);
        openModal();
    };

    const handleDelete = async (repoId) => {
        const confirmed = await confirmDelete({
            title: 'Delete Destination',
            message: 'Are you sure you want to delete this destination? This will not delete the actual backup data.',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;

        try {
            await fetch(`/api/backup/repositories/${repoId}`, { method: 'DELETE' });
            fetchRepositories();
        } catch (err) {
            setError('Failed to delete destination');
        }
    };

    const handleCheck = async (repoId) => {
        setChecking(repoId);
        setSuccess(null);
        setError(null);
        try {
            const response = await fetch(`/api/backup/repositories/${repoId}/check`, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                setSuccess(data.message);
                fetchRepositories();
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Failed to check destination');
        } finally {
            setChecking(null);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const response = await fetch('/api/backup/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storage_type: formData.storage_type,
                    repo_path: formData.repo_path,
                    credentials: formData.credentials,
                }),
            });

            const data = await response.json();
            setTestResult(data);
        } catch (err) {
            setTestResult({ success: false, message: 'Failed to test connection' });
        } finally {
            setTesting(false);
        }
    };

    const resetForm = () => {
        setEditingRepo(null);
        setFormData({
            name: '',
            storage_type: 'local',
            repo_path: '',
            credentials: {},
        });
        setTestResult(null);
        setModalError(null);
    };

    const getCurrentProviderFields = () => {
        const provider = providerFields.find(p => p.type === formData.storage_type);
        return provider?.fields || [];
    };

    const updateCredential = (key, value) => {
        setFormData({
            ...formData,
            credentials: { ...formData.credentials, [key]: value },
        });
        setTestResult(null);
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
                <Title order={3}>Backup Destinations</Title>
                <Group>
                    <Button
                        variant="light"
                        color="green"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchRepositories}
                    >
                        Refresh
                    </Button>
                    <Button
                        color="green"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => { resetForm(); openModal(); }}
                    >
                        New Destination
                    </Button>
                </Group>
            </Group>

            {error && (
                <Alert color="red" mb="md" onClose={() => setError(null)} withCloseButton>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert color="green" mb="md" onClose={() => setSuccess(null)} withCloseButton>
                    {success}
                </Alert>
            )}

            {repositories.length === 0 ? (
                <Box style={{ textAlign: 'center', padding: '40px 0' }}>
                    <IconDatabase size={48} style={{ color: theme.colors.gray[5], marginBottom: '16px' }} />
                    <Text c="dimmed">No backup destinations configured yet.</Text>
                    <Text size="sm" c="dimmed" mt={4}>
                        Create a destination to store your backups.
                    </Text>
                </Box>
            ) : (
                <Stack gap="md">
                    {repositories.map((repo) => (
                        <Box
                            key={repo.id}
                            style={{
                                backgroundColor: theme.colors.dark[6],
                                borderRadius: '8px',
                                border: `1px solid ${theme.colors.dark[4]}`,
                                overflow: 'hidden',
                            }}
                        >
                            <Group
                                justify="space-between"
                                p="md"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setExpandedRepo(expandedRepo === repo.id ? null : repo.id)}
                            >
                                <Group>
                                    <Box>
                                        <Group gap="xs">
                                            <Text fw={600}>{repo.name}</Text>
                                            <Badge color="green" size="sm">{repo.storage_type_label}</Badge>
                                        </Group>
                                        <Text size="sm" c="dimmed" mt={4}>
                                            {repo.repo_path} · {repo.jobs_count || 0} job(s)
                                        </Text>
                                    </Box>
                                </Group>
                                <Group gap="xs">
                                    <Tooltip label="Check Integrity">
                                        <ActionIcon
                                            variant="light"
                                            color="blue"
                                            size="sm"
                                            loading={checking === repo.id}
                                            onClick={(e) => { e.stopPropagation(); handleCheck(repo.id); }}
                                        >
                                            <IconRefresh size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Edit">
                                        <ActionIcon
                                            variant="light"
                                            color="blue"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleEdit(repo); }}
                                        >
                                            <IconEdit size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Delete">
                                        <ActionIcon
                                            variant="light"
                                            color="red"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(repo.id); }}
                                        >
                                            <IconTrash size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                    {expandedRepo === repo.id ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                </Group>
                            </Group>

                            <Collapse expanded={expandedRepo === repo.id}>
                                <Box p="md" pt={0} style={{ borderTop: `1px solid ${theme.colors.dark[4]}` }}>
                                    <Group mt="md">
                                        <Box>
                                            <Text size="xs" c="dimmed">Storage Type</Text>
                                            <Text size="sm">{repo.storage_type_label}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Last Check</Text>
                                            <Text size="sm">
                                                {repo.last_check_at
                                                    ? new Date(repo.last_check_at).toLocaleString()
                                                    : 'Never'}
                                            </Text>
                                        </Box>
                                    </Group>
                                </Box>
                            </Collapse>
                        </Box>
                    ))}
                </Stack>
            )}

            <Modal
                opened={opened}
                onClose={closeModal}
                title={editingRepo ? 'Edit Destination' : 'New Destination'}
                size="lg"
            >
                <Stack gap="md">
                    <TextInput
                        label="Destination Name"
                        placeholder="e.g., Local Backup"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />

                    <Select
                        label="Storage Type"
                        data={[
                            { value: 'local', label: 'Local Directory' },
                            { value: 'sftp', label: 'SFTP (SSH)' },
                            { value: 's3', label: 'S3-Compatible Storage' },
                            { value: 'novanas_backup', label: 'NovaNAS Backup Server' },
                        ]}
                        value={formData.storage_type}
                        onChange={(value) => setFormData({ ...formData, storage_type: value, credentials: value === 'novanas_backup' ? { protocol: 'https' } : {} })}
                        disabled={!!editingRepo}
                    />

                    {formData.storage_type === 'local' && (
                        <Group gap="xs">
                            <TextInput
                                label="Backup Path"
                                placeholder="/mnt/backup/restic-repo"
                                value={formData.repo_path}
                                onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                                required
                                style={{ flex: 1 }}
                                disabled={!!editingRepo}
                            />
                            {!editingRepo && (
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
                            )}
                        </Group>
                    )}

                    {formData.storage_type === 'sftp' && (
                        <>
                            <TextInput
                                label="Host"
                                placeholder="192.168.1.100"
                                value={formData.credentials.host || ''}
                                onChange={(e) => updateCredential('host', e.target.value)}
                                required
                            />
                            <NumberInput
                                label="Port"
                                placeholder="22"
                                value={formData.credentials.port || 22}
                                onChange={(value) => updateCredential('port', value)}
                            />
                            <TextInput
                                label="Username"
                                placeholder="backup"
                                value={formData.credentials.user || ''}
                                onChange={(e) => updateCredential('user', e.target.value)}
                                required
                            />
                            <Select
                                label="Authentication Method"
                                data={[
                                    { value: 'password', label: 'Password' },
                                    { value: 'private_key', label: 'Private Key' },
                                ]}
                                value={formData.credentials.auth_method || 'password'}
                                onChange={(value) => {
                                    updateCredential('auth_method', value);
                                    updateCredential('password', '');
                                    updateCredential('private_key', '');
                                }}
                                required
                            />
                            {(formData.credentials.auth_method || 'password') === 'password' ? (
                                <PasswordInput
                                    label="SSH Password"
                                    placeholder="Enter SSH password"
                                    value={formData.credentials.password || ''}
                                    onChange={(e) => updateCredential('password', e.target.value)}
                                />
                            ) : (
                                <TextInput
                                    label="Private Key Path"
                                    placeholder="/root/.ssh/id_rsa"
                                    value={formData.credentials.private_key || ''}
                                    onChange={(e) => updateCredential('private_key', e.target.value)}
                                />
                            )}
                            <TextInput
                                label="Backup Path"
                                placeholder="/srv/backups/restic-repo"
                                value={formData.repo_path}
                                onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                                required
                            />
                        </>
                    )}

                    {formData.storage_type === 's3' && (
                        <>
                            <TextInput
                                label="Endpoint URL"
                                placeholder="https://s3.amazonaws.com"
                                value={formData.credentials.endpoint || ''}
                                onChange={(e) => updateCredential('endpoint', e.target.value)}
                                required
                            />
                            <TextInput
                                label="Bucket Name"
                                placeholder="my-backup-bucket"
                                value={formData.credentials.bucket || ''}
                                onChange={(e) => updateCredential('bucket', e.target.value)}
                                required
                            />
                            <TextInput
                                label="Region"
                                placeholder="us-east-1"
                                value={formData.credentials.region || ''}
                                onChange={(e) => updateCredential('region', e.target.value)}
                            />
                            <TextInput
                                label="Access Key ID"
                                placeholder="AKIAIOSFODNN7EXAMPLE"
                                value={formData.credentials.access_key_id || ''}
                                onChange={(e) => updateCredential('access_key_id', e.target.value)}
                                required
                            />
                            <PasswordInput
                                label="Secret Access Key"
                                placeholder="Enter secret access key"
                                value={formData.credentials.secret_access_key || ''}
                                onChange={(e) => updateCredential('secret_access_key', e.target.value)}
                                required
                            />
                            <TextInput
                                label="Backup Path"
                                placeholder="/restic-repo"
                                value={formData.repo_path}
                                onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                                required
                            />
                        </>
                    )}

                    {formData.storage_type === 'novanas_backup' && (
                        <>
                            <Group grow>
                                <Select
                                    label="Protocol"
                                    data={[
                                        { value: 'https', label: 'https' },
                                        { value: 'http', label: 'http' },
                                    ]}
                                    value={formData.credentials.protocol || 'https'}
                                    onChange={(val) => updateCredential('protocol', val || 'https')}
                                />
                                <TextInput
                                    label="Hostname / IP"
                                    placeholder="nas.example.com"
                                    value={formData.credentials.hostname || ''}
                                    onChange={(e) => updateCredential('hostname', e.target.value)}
                                    required
                                />
                            </Group>
                            <TextInput
                                label="API Key"
                                placeholder="Paste the API key"
                                value={formData.credentials.api_key || ''}
                                onChange={(e) => updateCredential('api_key', e.target.value)}
                                required
                            />
                            <TextInput
                                label="Repository Path"
                                placeholder="my-backups"
                                description="A sub-path on the backup server for this repository"
                                value={formData.repo_path}
                                onChange={(e) => setFormData({ ...formData, repo_path: e.target.value })}
                                required
                            />
                            <Switch
                                label="Allow unsigned/self-signed certificates"
                                checked={formData.credentials.allow_unsigned_cert || false}
                                onChange={(e) => updateCredential('allow_unsigned_cert', e.currentTarget.checked)}
                            />
                        </>
                    )}

                    {formData.storage_type !== 'local' && (
                        <Group>
                            <Button
                                variant="outline"
                                color="blue"
                                leftSection={<IconPlug size={16} />}
                                onClick={handleTestConnection}
                                loading={testing}
                                disabled={!formData.repo_path}
                            >
                                Test Connection
                            </Button>
                            {testResult && (
                                <Alert
                                    color={testResult.success ? 'green' : 'red'}
                                    style={{ flex: 1 }}
                                    withCloseButton
                                    onClose={() => setTestResult(null)}
                                >
                                    {testResult.message}
                                </Alert>
                            )}
                        </Group>
                    )}

                    <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                        <Text size="sm">
                            The backup password is automatically set to the application key for security.
                        </Text>
                    </Alert>

                    {modalError && (
                        <Alert color="red" icon={<IconAlertCircle size={16} />}>
                            <Text size="sm">{modalError}</Text>
                        </Alert>
                    )}

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={closeModal}>Cancel</Button>
                        <Button
                            color="green"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={!formData.name || !formData.repo_path}
                        >
                            {editingRepo ? 'Update' : 'Create'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <FileSelector
                opened={fileSelectorOpened}
                onClose={() => setFileSelectorOpened(false)}
                onSelect={(path) => setFormData({ ...formData, repo_path: path })}
                title="Select Backup Directory"
                allowFiles={false}
                showFiles={false}
                useSudo={true}
            />

            {deleteConfirmModal}
        </Box>
    );
}

function IconInfoCircle({ size }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    );
}
