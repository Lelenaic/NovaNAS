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
    Switch,
    NumberInput,
    Textarea,
    Stack,
    Modal,
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
    IconPlayerPlay,
    IconPlayerStop,
    IconChevronDown,
    IconChevronUp,
    IconInfoCircle,
    IconFolder,
} from '@tabler/icons-react';
import { FileSelector } from '../../../FileSelector';

export function JobsTab() {
    const theme = useMantineTheme();
    const [jobs, setJobs] = useState([]);
    const [repositories, setRepositories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [opened, { open: openModal, close: closeModal }] = useDisclosure(false);
    const [editingJob, setEditingJob] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [expandedJob, setExpandedJob] = useState(null);
    const [fileSelectorOpened, setFileSelectorOpened] = useState(false);
    const [fileSelectorIndex, setFileSelectorIndex] = useState(null);

    const [formData, setFormData] = useState({
        backup_repository_id: '',
        name: '',
        is_enabled: true,
        source_paths: [''],
        exclude_patterns: [],
        cron_expression: '0 2 * * *',
        retention_policy: {
            keep_last: 7,
            keep_daily: 7,
            keep_weekly: 4,
            keep_monthly: 12,
        },
        tags: [],
        compression: 'auto',
    });

    useEffect(() => {
        fetchJobs();
        fetchRepositories();
    }, []);

    const fetchJobs = async () => {
        try {
            const response = await fetch('/api/backup/jobs');
            const data = await response.json();
            setJobs(data.jobs || []);
        } catch (err) {
            setError('Failed to fetch backup jobs');
        } finally {
            setLoading(false);
        }
    };

    const fetchRepositories = async () => {
        try {
            const response = await fetch('/api/backup/repositories');
            const data = await response.json();
            setRepositories(data.repositories || []);
        } catch (err) {
            console.error('Failed to fetch repositories:', err);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const url = editingJob ? `/api/backup/jobs/${editingJob.id}` : '/api/backup/jobs';
            const method = editingJob ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                source_paths: formData.source_paths.filter(p => p.trim()),
                exclude_patterns: formData.exclude_patterns.filter(p => p.trim()),
                tags: formData.tags.filter(t => t.trim()),
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                closeModal();
                resetForm();
                fetchJobs();
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to save job');
            }
        } catch (err) {
            setError('Failed to save job');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (job) => {
        setEditingJob(job);
        setFormData({
            backup_repository_id: job.backup_repository_id,
            name: job.name,
            is_enabled: job.is_enabled,
            source_paths: job.source_paths || [''],
            exclude_patterns: job.exclude_patterns || [],
            cron_expression: job.cron_expression,
            retention_policy: job.retention_policy || {},
            tags: job.tags || [],
            compression: job.compression,
        });
        openModal();
    };

    const handleDelete = async (jobId) => {
        if (!confirm('Are you sure you want to delete this backup job?')) return;

        try {
            await fetch(`/api/backup/jobs/${jobId}`, { method: 'DELETE' });
            fetchJobs();
        } catch (err) {
            setError('Failed to delete job');
        }
    };

    const handleRun = async (jobId) => {
        try {
            await fetch(`/api/backup/jobs/${jobId}/run`, { method: 'POST' });
            fetchJobs();
        } catch (err) {
            setError('Failed to start job');
        }
    };

    const handleToggle = async (jobId, enable) => {
        try {
            const url = enable ? `/api/backup/jobs/${jobId}/enable` : `/api/backup/jobs/${jobId}/disable`;
            await fetch(url, { method: 'POST' });
            fetchJobs();
        } catch (err) {
            setError('Failed to toggle job');
        }
    };

    const resetForm = () => {
        setEditingJob(null);
        setFormData({
            backup_repository_id: '',
            name: '',
            is_enabled: true,
            source_paths: [''],
            exclude_patterns: [],
            cron_expression: '0 2 * * *',
            retention_policy: {
                keep_last: 7,
                keep_daily: 7,
                keep_weekly: 4,
                keep_monthly: 12,
            },
            tags: [],
            compression: 'auto',
        });
    };

    const addSourcePath = () => {
        setFormData({ ...formData, source_paths: [...formData.source_paths, ''] });
    };

    const updateSourcePath = (index, value) => {
        const paths = [...formData.source_paths];
        paths[index] = value;
        setFormData({ ...formData, source_paths: paths });
    };

    const removeSourcePath = (index) => {
        if (formData.source_paths.length <= 1) return;
        const paths = formData.source_paths.filter((_, i) => i !== index);
        setFormData({ ...formData, source_paths: paths });
    };

    const openFileSelector = (index) => {
        setFileSelectorIndex(index);
        setFileSelectorOpened(true);
    };

    const handleFileSelect = (path) => {
        if (fileSelectorIndex !== null) {
            updateSourcePath(fileSelectorIndex, path);
        }
        setFileSelectorOpened(false);
        setFileSelectorIndex(null);
    };

    const formatBytes = (bytes) => {
        if (!bytes) return 'N/A';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'blue';
            case 'success': return 'green';
            case 'failed': return 'red';
            default: return 'gray';
        }
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
                <Title order={3}>Backup Jobs</Title>
                <Group>
                    <Button
                        variant="light"
                        color="green"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchJobs}
                    >
                        Refresh
                    </Button>
                    <Button
                        color="green"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => { resetForm(); openModal(); }}
                        disabled={repositories.length === 0}
                    >
                        New Job
                    </Button>
                </Group>
            </Group>

            {error && (
                <Alert color="red" mb="md" onClose={() => setError(null)} withCloseButton>
                    {error}
                </Alert>
            )}

            {repositories.length === 0 && (
                <Alert color="yellow" mb="md" icon={<IconInfoCircle size={16} />}>
                    Please create a destination first before adding backup jobs.
                </Alert>
            )}

            {jobs.length === 0 ? (
                <Box style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Text c="dimmed">No backup jobs configured yet.</Text>
                </Box>
            ) : (
                <Stack gap="md">
                    {jobs.map((job) => (
                        <Box
                            key={job.id}
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
                                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                            >
                                <Group>
                                    <Box>
                                        <Group gap="xs">
                                            <Text fw={600}>{job.name}</Text>
                                            <Badge color={getStatusColor(job.status)} size="sm">
                                                {job.status}
                                            </Badge>
                                            {!job.is_enabled && (
                                                <Badge color="gray" size="sm">Disabled</Badge>
                                            )}
                                        </Group>
                                        <Text size="sm" c="dimmed" mt={4}>
                                            {job.repository_name} · {job.source_paths?.length || 0} path(s) · {job.schedule_description}
                                        </Text>
                                    </Box>
                                </Group>
                                <Group gap="xs">
                                    <Tooltip label="Run Now">
                                        <ActionIcon
                                            variant="light"
                                            color="green"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleRun(job.id); }}
                                            disabled={job.status === 'running'}
                                        >
                                            <IconPlayerPlay size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label={job.is_enabled ? 'Disable' : 'Enable'}>
                                        <ActionIcon
                                            variant="light"
                                            color={job.is_enabled ? 'yellow' : 'gray'}
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleToggle(job.id, !job.is_enabled); }}
                                        >
                                            <IconPlayerStop size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Edit">
                                        <ActionIcon
                                            variant="light"
                                            color="blue"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleEdit(job); }}
                                        >
                                            <IconEdit size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Delete">
                                        <ActionIcon
                                            variant="light"
                                            color="red"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(job.id); }}
                                        >
                                            <IconTrash size={14} />
                                        </ActionIcon>
                                    </Tooltip>
                                    {expandedJob === job.id ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                </Group>
                            </Group>

                            <Collapse in={expandedJob === job.id}>
                                <Box p="md" pt={0} style={{ borderTop: `1px solid ${theme.colors.dark[4]}` }}>
                                    <Group mt="md">
                                        <Box>
                                            <Text size="xs" c="dimmed">Last Backup</Text>
                                            <Text size="sm">
                                                {job.last_backup_at
                                                    ? new Date(job.last_backup_at).toLocaleString()
                                                    : 'Never'}
                                            </Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Last Size</Text>
                                            <Text size="sm">{formatBytes(job.last_backup_size)}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Next Run</Text>
                                            <Text size="sm">
                                                {job.next_run_at
                                                    ? new Date(job.next_run_at).toLocaleString()
                                                    : 'Not scheduled'}
                                            </Text>
                                        </Box>
                                    </Group>
                                    {job.last_error && (
                                        <Alert color="red" mt="md" size="sm">
                                            {job.last_error}
                                        </Alert>
                                    )}
                                </Box>
                            </Collapse>
                        </Box>
                    ))}
                </Stack>
            )}

            <Modal
                opened={opened}
                onClose={closeModal}
                title={editingJob ? 'Edit Backup Job' : 'New Backup Job'}
                size="lg"
            >
                <Stack gap="md">
                    <TextInput
                        label="Job Name"
                        placeholder="e.g., Daily Home Backup"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />

                    <Select
                        label="Destination"
                        placeholder="Select a destination"
                        data={repositories.map(r => ({ value: r.id, label: r.name }))}
                        value={formData.backup_repository_id}
                        onChange={(value) => setFormData({ ...formData, backup_repository_id: value })}
                        required
                        disabled={!!editingJob}
                    />

                    <Box>
                        <Text size="sm" fw={500} mb={4}>Source Paths <span style={{ color: 'red' }}>*</span></Text>
                        {formData.source_paths.map((path, index) => (
                            <Group key={index} gap="xs" mb={4}>
                                <TextInput
                                    placeholder="/path/to/backup"
                                    value={path}
                                    onChange={(e) => updateSourcePath(index, e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <Tooltip label="Browse">
                                    <ActionIcon
                                        variant="light"
                                        color="blue"
                                        onClick={() => openFileSelector(index)}
                                    >
                                        <IconFolder size={14} />
                                    </ActionIcon>
                                </Tooltip>
                                <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    onClick={() => removeSourcePath(index)}
                                    disabled={formData.source_paths.length <= 1}
                                >
                                    <IconTrash size={14} />
                                </ActionIcon>
                            </Group>
                        ))}
                        <Button variant="subtle" size="xs" onClick={addSourcePath}>
                            + Add Path
                        </Button>
                    </Box>

                    <TextInput
                        label="Exclude Patterns"
                        placeholder="*.log, .cache/"
                        value={formData.exclude_patterns.join(', ')}
                        onChange={(e) => setFormData({
                            ...formData,
                            exclude_patterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                    />

                    <TextInput
                        label="Schedule (Cron)"
                        placeholder="0 2 * * *"
                        value={formData.cron_expression}
                        onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                        description="e.g., '0 2 * * *' for daily at 2 AM, '*/5 * * * *' for every 5 minutes"
                        required
                    />

                    <Select
                        label="Compression"
                        data={[
                            { value: 'auto', label: 'Auto (Recommended)' },
                            { value: 'off', label: 'Off' },
                            { value: 'fastest', label: 'Fastest' },
                            { value: 'better', label: 'Better' },
                            { value: 'max', label: 'Maximum' },
                        ]}
                        value={formData.compression}
                        onChange={(value) => setFormData({ ...formData, compression: value })}
                    />

                    <TextInput
                        label="Tags"
                        placeholder="daily, home"
                        value={formData.tags.join(', ')}
                        onChange={(e) => setFormData({
                            ...formData,
                            tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                    />

                    <Switch
                        label="Enable job"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.currentTarget.checked })}
                    />

                    <Box>
                        <Text size="sm" fw={500} mb={4}>Retention Policy</Text>
                        <Group grow>
                            <NumberInput
                                label="Keep Last"
                                value={formData.retention_policy.keep_last}
                                onChange={(value) => setFormData({
                                    ...formData,
                                    retention_policy: { ...formData.retention_policy, keep_last: value || 0 }
                                })}
                                min={0}
                            />
                            <NumberInput
                                label="Keep Daily"
                                value={formData.retention_policy.keep_daily}
                                onChange={(value) => setFormData({
                                    ...formData,
                                    retention_policy: { ...formData.retention_policy, keep_daily: value || 0 }
                                })}
                                min={0}
                            />
                        </Group>
                        <Group grow mt="xs">
                            <NumberInput
                                label="Keep Weekly"
                                value={formData.retention_policy.keep_weekly}
                                onChange={(value) => setFormData({
                                    ...formData,
                                    retention_policy: { ...formData.retention_policy, keep_weekly: value || 0 }
                                })}
                                min={0}
                            />
                            <NumberInput
                                label="Keep Monthly"
                                value={formData.retention_policy.keep_monthly}
                                onChange={(value) => setFormData({
                                    ...formData,
                                    retention_policy: { ...formData.retention_policy, keep_monthly: value || 0 }
                                })}
                                min={0}
                            />
                        </Group>
                        <Group grow mt="xs">
                            <NumberInput
                                label="Keep Yearly"
                                value={formData.retention_policy.keep_yearly || 0}
                                onChange={(value) => setFormData({
                                    ...formData,
                                    retention_policy: { ...formData.retention_policy, keep_yearly: value || 0 }
                                })}
                                min={0}
                            />
                        </Group>
                    </Box>

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={closeModal}>Cancel</Button>
                        <Button
                            color="green"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={!formData.name || !formData.backup_repository_id || formData.source_paths.length === 0 || !formData.source_paths.some(p => p.trim())}
                        >
                            {editingJob ? 'Update' : 'Create'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <FileSelector
                opened={fileSelectorOpened}
                onClose={() => setFileSelectorOpened(false)}
                onSelect={handleFileSelect}
                title="Select Source Directory"
                allowFiles={false}
                showFiles={false}
                useSudo={true}
            />
        </Box>
    );
}
