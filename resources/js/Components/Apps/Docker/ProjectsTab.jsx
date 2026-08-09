import { useEffect, useState, useCallback } from 'react';
import {
    Box, Title, Text, Card, Badge, Group, ActionIcon, Stack, Loader, Button,
    Modal, Alert, TextInput, ScrollArea, Tooltip, Collapse, SimpleGrid, Checkbox,
} from '@mantine/core';
import {
    IconStack2, IconPlus, IconRefresh, IconPlayerPlay, IconPlayerStop,
    IconRotate, IconTrash, IconEdit, IconAlertCircle, IconChevronDown,
    IconChevronRight, IconFileCode, IconTerminal2, IconCopy, IconCheck,
} from '@tabler/icons-react';
import { CodeEditor } from './CodeEditor';

const STARTER_COMPOSE = `services:
`;

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export function ProjectsTab() {
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState({});

    const [createModal, setCreateModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCompose, setNewCompose] = useState(STARTER_COMPOSE);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState(null);

    const [editModal, setEditModal] = useState({ open: false, project: null });
    const [editCompose, setEditCompose] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);

    const [deleteModal, setDeleteModal] = useState({ open: false, project: null });
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteVolumes, setDeleteVolumes] = useState(true);

    const [logsModal, setLogsModal] = useState({ open: false, project: null });
    const [logs, setLogs] = useState('');
    const [logsLoading, setLogsLoading] = useState(false);

    const [expandedProjects, setExpandedProjects] = useState({});
    const [copiedPath, setCopiedPath] = useState(null);

    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/docker/projects');
            if (response.ok) {
                const data = await response.json();
                setProjects(data);
            } else {
                setError('Failed to fetch projects');
            }
        } catch {
            setError('Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleAction = async (projectName, action) => {
        setActionLoading((prev) => ({ ...prev, [projectName]: action }));
        setError(null);
        try {
            const response = await fetch(`/api/docker/projects/${encodeURIComponent(projectName)}/${action}`, {
                method: 'POST',
            });
            if (response.ok) {
                fetchProjects();
            } else {
                const data = await response.json();
                setError(data.details || data.error || `Failed to ${action} project`);
            }
        } catch {
            setError(`Failed to ${action} project`);
        } finally {
            setActionLoading((prev) => ({ ...prev, [projectName]: null }));
        }
    };

    const handleCreate = async () => {
        const slug = slugify(newName);
        if (!slug) {
            setCreateError('Project name is required');
            return;
        }

        if (slug.length < 2) {
            setCreateError('Project name must be at least 2 characters');
            return;
        }

        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]$/.test(slug)) {
            setCreateError('Name must contain only lowercase letters, digits, and hyphens');
            return;
        }

        setCreateLoading(true);
        setCreateError(null);

        try {
            const response = await fetch('/api/docker/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: slug, compose_content: newCompose }),
            });

            const data = await response.json();

            if (response.ok) {
                setCreateModal(false);
                setNewName('');
                setNewCompose(STARTER_COMPOSE);
                fetchProjects();
            } else {
                setCreateError(data.details || data.error || 'Failed to create project');
            }
        } catch {
            setCreateError('Failed to create project');
        } finally {
            setCreateLoading(false);
        }
    };

    const openEditModal = async (project) => {
        setEditError(null);
        try {
            const response = await fetch(`/api/docker/projects/${encodeURIComponent(project.name)}`);
            if (response.ok) {
                const data = await response.json();
                setEditCompose(data.compose_content || '');
                setEditModal({ open: true, project: data });
            } else {
                setError('Failed to load project details');
            }
        } catch {
            setError('Failed to load project details');
        }
    };

    const handleUpdate = async () => {
        if (!editModal.project) return;

        setEditLoading(true);
        setEditError(null);

        try {
            const response = await fetch(`/api/docker/projects/${encodeURIComponent(editModal.project.name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ compose_content: editCompose }),
            });

            const data = await response.json();

            if (response.ok) {
                setEditModal({ open: false, project: null });
                fetchProjects();
            } else {
                setEditError(data.details || data.error || 'Failed to update project');
            }
        } catch {
            setEditError('Failed to update project');
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.project) return;

        setDeleteLoading(true);
        try {
            const params = deleteVolumes ? '?v=true' : '';
            const response = await fetch(`/api/docker/projects/${encodeURIComponent(deleteModal.project.name)}${params}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setDeleteModal({ open: false, project: null });
                fetchProjects();
            } else {
                const data = await response.json();
                setError(data.details || data.error || 'Failed to delete project');
            }
        } catch {
            setError('Failed to delete project');
        } finally {
            setDeleteLoading(false);
        }
    };

    const openLogs = async (project) => {
        setLogsModal({ open: true, project });
        setLogsLoading(true);
        setLogs('');

        try {
            const response = await fetch(`/api/docker/projects/${encodeURIComponent(project.name)}/logs?tail=200&timestamps=true`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs || 'No logs available');
            } else {
                setLogs('Failed to fetch logs');
            }
        } catch {
            setLogs('Failed to fetch logs');
        } finally {
            setLogsLoading(false);
        }
    };

    const toggleExpand = (projectName) => {
        setExpandedProjects((prev) => ({
            ...prev,
            [projectName]: !prev[projectName],
        }));
    };

    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
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
            setCopiedPath(text);
            setTimeout(() => setCopiedPath(null), 2000);
        } catch {
            // silent
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'green';
            case 'partial': return 'yellow';
            case 'stopped': return 'red';
            default: return 'gray';
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
                    <Title order={3}>Compose Projects</Title>
                    <Text c="dimmed" size="sm">
                        Manage Docker Compose projects
                    </Text>
                </Box>
                <Group>
                    <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchProjects}
                    >
                        Refresh
                    </Button>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() => {
                            setNewName('');
                            setNewCompose(STARTER_COMPOSE);
                            setCreateError(null);
                            setCreateModal(true);
                        }}
                    >
                        New Project
                    </Button>
                </Group>
            </Group>

            {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" onClose={() => setError(null)} withCloseButton>
                    {error}
                </Alert>
            )}

            {projects.length === 0 ? (
                <Card padding="lg" radius="md" withBorder>
                    <Box style={{ textAlign: 'center', padding: '40px' }}>
                        <IconStack2 size={48} style={{ opacity: 0.3 }} />
                        <Text mt="md" c="dimmed">No compose projects found</Text>
                        <Text size="sm" c="dimmed" mt="xs">Create a new project or run docker compose up to see existing projects</Text>
                    </Box>
                </Card>
            ) : (
                projects.map((project) => (
                    <Card key={project.name} padding="md" radius="md" withBorder>
                        <Group justify="space-between" mb={expandedProjects[project.name] ? 'md' : 0}>
                            <Box style={{ flex: 1 }}>
                                <Group gap="sm" wrap="nowrap">
                                    <ActionIcon
                                        variant="subtle"
                                        size="sm"
                                        onClick={() => toggleExpand(project.name)}
                                    >
                                        {expandedProjects[project.name]
                                            ? <IconChevronDown size={16} />
                                            : <IconChevronRight size={16} />
                                        }
                                    </ActionIcon>
                                    <Text fw={600}>{project.name}</Text>
                                    <Badge color={getStatusColor(project.status)} variant="light">
                                        {project.status}
                                    </Badge>
                                    <Badge variant="outline" size="sm">
                                        {project.running}/{project.total} containers
                                    </Badge>
                                    {project.services.length > 0 && (
                                        <Badge variant="outline" size="sm" color="gray">
                                            {project.services.length} service{project.services.length !== 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </Group>
                                {project.compose_file && (
                                    <Group gap={4} mt={4} ml={42} wrap="nowrap">
                                        <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project.compose_file}>
                                            <IconFileCode size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                            <span style={{ display: 'inline' }}>{project.compose_file}</span>
                                        </Text>
                                        <Tooltip label={copiedPath === project.compose_file ? 'Copied!' : 'Copy path'}>
                                            <ActionIcon variant="subtle" size="xs" color="gray" onClick={() => copyToClipboard(project.compose_file)}>
                                                {copiedPath === project.compose_file ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                )}
                            </Box>
                            <Group gap="xs">
                                {project.status === 'running' ? (
                                    <>
                                        <Tooltip label="Stop">
                                            <ActionIcon
                                                variant="light"
                                                color="yellow"
                                                onClick={() => handleAction(project.name, 'stop')}
                                                loading={actionLoading[project.name] === 'stop'}
                                            >
                                                <IconPlayerStop size={16} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label="Restart">
                                            <ActionIcon
                                                variant="light"
                                                color="blue"
                                                onClick={() => handleAction(project.name, 'restart')}
                                                loading={actionLoading[project.name] === 'restart'}
                                            >
                                                <IconRotate size={16} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </>
                                ) : (
                                    <Tooltip label="Start">
                                        <ActionIcon
                                            variant="light"
                                            color="green"
                                            onClick={() => handleAction(project.name, 'start')}
                                            loading={actionLoading[project.name] === 'start'}
                                        >
                                            <IconPlayerPlay size={16} />
                                        </ActionIcon>
                                    </Tooltip>
                                )}
                                <Tooltip label="Edit Compose File">
                                    <ActionIcon
                                        variant="light"
                                        color="blue"
                                        onClick={() => openEditModal(project)}
                                    >
                                        <IconEdit size={16} />
                                    </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Logs">
                                    <ActionIcon
                                        variant="light"
                                        color="gray"
                                        onClick={() => openLogs(project)}
                                    >
                                        <IconTerminal2 size={16} />
                                    </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Delete">
                                    <ActionIcon
                                        variant="light"
                                        color="red"
                                        onClick={() => setDeleteModal({ open: true, project })}
                                    >
                                        <IconTrash size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        </Group>

                        <Collapse expanded={expandedProjects[project.name]}>
                            <Box pt="md">
                                <Text size="sm" fw={500} mb="xs">Services</Text>
                                {project.containers && project.containers.length > 0 ? (
                                    <SimpleGrid cols={2} spacing="xs">
                                        {project.containers.map((container) => (
                                            <Card key={container.id} padding="xs" radius="sm" withBorder>
                                                <Group gap="xs">
                                                    <Badge
                                                        color={container.state === 'running' ? 'green' : 'red'}
                                                        variant="dot"
                                                        size="xs"
                                                    />
                                                    <Text size="xs" fw={500}>
                                                        {container.service || container.name}
                                                    </Text>
                                                    <Text size="xs" c="dimmed">
                                                        ({container.image})
                                                    </Text>
                                                </Group>
                                            </Card>
                                        ))}
                                    </SimpleGrid>
                                ) : (
                                    <Text size="xs" c="dimmed">No containers</Text>
                                )}
                            </Box>
                        </Collapse>
                    </Card>
                ))
            )}

            {/* Create Modal */}
            <Modal
                opened={createModal}
                onClose={() => setCreateModal(false)}
                title="Create Compose Project"
                size="xl"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {createError && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                        {createError}
                    </Alert>
                )}
                <Stack gap="md">
                    <TextInput
                        label="Project Name"
                        placeholder="my-project"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        description={newName ? `Folder: novanas_projects/${slugify(newName)}/compose.yaml` : 'Lowercase letters, digits, and hyphens only'}
                        error={newName && slugify(newName).length < 2 ? 'Name must be at least 2 characters' : null}
                    />
                    <Box>
                        <Text size="sm" fw={500} mb="xs">Compose File</Text>
                        <CodeEditor
                            value={newCompose}
                            onChange={(val) => setNewCompose(val)}
                            height="350px"
                        />
                    </Box>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setCreateModal(false)}>Cancel</Button>
                        <Button
                            onClick={handleCreate}
                            loading={createLoading}
                            disabled={!newName || slugify(newName).length < 2}
                        >
                            Create & Start
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Edit Modal */}
            <Modal
                opened={editModal.open}
                onClose={() => setEditModal({ open: false, project: null })}
                title={`Edit: ${editModal.project?.name || ''}`}
                size="xl"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {editError && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                        {editError}
                    </Alert>
                )}
                <Stack gap="md">
                    {editModal.project?.compose_file && (
                        <Group gap={4} wrap="nowrap">
                            <Text size="xs" c="dimmed">
                                <IconFileCode size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                <span style={{ display: 'inline' }}>{editModal.project.compose_file}</span>
                            </Text>
                            <Tooltip label={copiedPath === editModal.project.compose_file ? 'Copied!' : 'Copy path'}>
                                <ActionIcon variant="subtle" size="xs" color="gray" onClick={() => copyToClipboard(editModal.project.compose_file)}>
                                    {copiedPath === editModal.project.compose_file ? <IconCheck size={12} /> : <IconCopy size={12} />}
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    )}
                    <Box>
                        <Text size="sm" fw={500} mb="xs">Compose File</Text>
                        <CodeEditor
                            value={editCompose}
                            onChange={(val) => setEditCompose(val)}
                            height="450px"
                        />
                    </Box>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setEditModal({ open: false, project: null })}>Cancel</Button>
                        <Button onClick={handleUpdate} loading={editLoading}>
                            Save & Deploy
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Delete Modal */}
            <Modal
                opened={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, project: null })}
                title="Delete Project"
            >
                <Text>
                    Are you sure you want to delete project{' '}
                    <strong>{deleteModal.project?.name}</strong>?
                    This will stop all containers and remove the compose file.
                </Text>
                <Checkbox
                    label="Remove volumes"
                    description="Delete all named volumes used by this project"
                    checked={deleteVolumes}
                    onChange={(e) => setDeleteVolumes(e.currentTarget.checked)}
                    mt="md"
                />
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setDeleteModal({ open: false, project: null })}>Cancel</Button>
                    <Button color="red" onClick={handleDelete} loading={deleteLoading}>
                        Delete
                    </Button>
                </Group>
            </Modal>

            {/* Logs Modal */}
            <Modal
                opened={logsModal.open}
                onClose={() => setLogsModal({ open: false, project: null })}
                title={`Logs: ${logsModal.project?.name || ''}`}
                size="xl"
            >
                {logsLoading ? (
                    <Box style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <Loader />
                    </Box>
                ) : (
                    <Box
                        style={{
                            backgroundColor: '#1a1b1e',
                            borderRadius: '8px',
                            padding: '16px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            maxHeight: '500px',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            color: '#c1c2c5',
                        }}
                    >
                        {logs || 'No logs available'}
                    </Box>
                )}
                <Group justify="flex-end" mt="md">
                    <Button
                        variant="default"
                        onClick={() => openLogs(logsModal.project)}
                        leftSection={<IconRefresh size={14} />}
                    >
                        Refresh
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
}
