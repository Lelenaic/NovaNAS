import { useEffect, useState } from 'react';
import { Box, Title, Text, Card, Badge, Group, ActionIcon, Stack, Loader, Button, Modal, Switch, Alert, TextInput, Select, ScrollArea } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconRefresh, IconTrash, IconBox, IconAlertCircle, IconPlus, IconEdit, IconFolder, IconX } from '@tabler/icons-react';
import { FileSelector } from '../../FileSelector';

export function ContainersTab() {
    const [loading, setLoading] = useState(true);
    const [containers, setContainers] = useState([]);
    const [showAll, setShowAll] = useState(true);
    const [actionLoading, setActionLoading] = useState({});
    const [deleteModal, setDeleteModal] = useState({ open: false, container: null });
    const [error, setError] = useState(null);

    // Create/Edit container modal
    const [createModal, setCreateModal] = useState({ open: false, container: null });
    const [formData, setFormData] = useState({
        name: '',
        image: '',
        tag: 'latest',
        restart_policy: 'no',
        ports: [{ host: '', container: '' }],
        volumes: [{ type: 'bind', host_path: '', volume_name: '', container_path: '' }],
        environment: [{ key: '', value: '' }],
        env_file: '',
    });
    const [formLoading, setFormLoading] = useState(false);
    // (removed formStep - single modal)
    const [existingVolumes, setExistingVolumes] = useState([]);
    const [volumesLoading, setVolumesLoading] = useState(false);
    const [volumeCreating, setVolumeCreating] = useState(false);

    // File selector for volumes/env file
    const [fileSelectorOpen, setFileSelectorOpen] = useState({ open: false, field: null, index: null });

    // Registries for image pull
    const [registries, setRegistries] = useState([]);
    const [registriesLoading, setRegistriesLoading] = useState(false);

    const fetchRegistries = async () => {
        setRegistriesLoading(true);
        try {
            const response = await fetch('/api/docker/registries');
            if (response.ok) {
                const data = await response.json();
                // Filter to only show logged-in registries
                const loggedIn = data.filter(r => r.isLoggedIn);
                setRegistries(loggedIn);
            }
        } catch (err) {
            console.error('Failed to fetch registries:', err);
        } finally {
            setRegistriesLoading(false);
        }
    };

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

    const openCreateModal = () => {
        setFormData({
            name: '',
            image: '',
            tag: 'latest',
            registry: '',
            restart_policy: 'no',
            ports: [{ host: '', container: '' }],
            volumes: [{ type: 'bind', host_path: '', volume_name: '', container_path: '' }],
            environment: [{ key: '', value: '' }],
            env_file: '',
        });
        setCreateModal({ open: true, container: null });
        setError(null);
        fetchVolumes();
        fetchRegistries();
    };

    const fetchVolumes = async () => {
        setVolumesLoading(true);
        try {
            const response = await fetch('/api/docker/volumes');
            if (response.ok) {
                const data = await response.json();
                const volumes = data.Volumes || [];
                setExistingVolumes(volumes.map(v => ({ value: v.Name, label: v.Name })));
            }
        } catch (err) {
            console.error('Failed to fetch volumes:', err);
        } finally {
            setVolumesLoading(false);
        }
    };

    const createVolume = async (volumeName, index) => {
        if (!volumeName.trim()) return;

        setVolumeCreating(true);
        try {
            const response = await fetch('/api/docker/volumes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: volumeName.trim() }),
            });

            if (response.ok) {
                // Add to the list
                const newVolume = { value: volumeName.trim(), label: volumeName.trim() };
                setExistingVolumes(prev => [...prev, newVolume]);
                // Select the new volume
                updateVolume(index, 'volume_name', volumeName.trim());
            } else {
                const data = await response.json();
                setError(data.details || data.error || 'Failed to create volume');
            }
        } catch (err) {
            console.error('Failed to create volume:', err);
            setError('Failed to create volume');
        } finally {
            setVolumeCreating(false);
        }
    };

    const openEditModal = async (container) => {
        setError(null);
        await fetchVolumes();
        try {
            const response = await fetch(`/api/docker/containers/${container.ID}/config`);
            if (response.ok) {
                const config = await response.json();

                // Parse image to get name and tag
                const imageParts = config.image.split(':');
                const imageName = imageParts[0];
                const imageTag = imageParts[1] || 'latest';

                setFormData({
                    name: config.name || '',
                    image: imageName,
                    tag: imageTag,
                    registry: '',
                    restart_policy: config.restart_policy || 'no',
                    ports: config.ports && config.ports.length > 0
                        ? config.ports
                        : [{ host: '', container: '' }],
                    volumes: config.volumes && config.volumes.length > 0
                        ? config.volumes
                        : [{ type: 'bind', host_path: '', volume_name: '', container_path: '' }],
                    environment: config.environment && config.environment.length > 0
                        ? config.environment
                        : [{ key: '', value: '' }],
                    env_file: '',
                });
                setCreateModal({ open: true, container: config });
            } else {
                setError('Failed to load container config');
            }
        } catch (err) {
            setError('Failed to load container config');
            console.error('Failed to load container config:', err);
        }
    };

    const handleSubmit = async () => {
        setFormLoading(true);
        setError(null);

        try {
            const payload = {
                name: formData.name,
                image: formData.image,
                tag: formData.tag,
                registry: formData.registry || null,
                restart_policy: formData.restart_policy,
                ports: formData.ports.filter(p => p.host && p.container),
                volumes: formData.volumes.filter(v => v.container_path),
                environment: formData.environment.filter(e => e.key),
                env_file: formData.env_file || null,
            };

            let response;
            if (createModal.container) {
                // Recreate container
                response = await fetch(`/api/docker/containers/${createModal.container.id}/recreate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                // Create container
                response = await fetch('/api/docker/containers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            const data = await response.json();

            if (response.ok) {
                setCreateModal({ open: false, container: null });
                fetchContainers();
            } else {
                setError(data.details || data.error || 'Failed to save container');
            }
        } catch (err) {
            setError('Failed to save container');
            console.error('Failed to save container:', err);
        } finally {
            setFormLoading(false);
        }
    };

    // Form field handlers
    const updateFormField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const addPort = () => {
        setFormData(prev => ({
            ...prev,
            ports: [...prev.ports, { host: '', container: '' }]
        }));
    };

    const removePort = (index) => {
        setFormData(prev => ({
            ...prev,
            ports: prev.ports.filter((_, i) => i !== index)
        }));
    };

    const updatePort = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            ports: prev.ports.map((p, i) => i === index ? { ...p, [field]: value } : p)
        }));
    };

    const addVolume = () => {
        setFormData(prev => ({
            ...prev,
            volumes: [...prev.volumes, { type: 'bind', host_path: '', volume_name: '', container_path: '' }]
        }));
    };

    const removeVolume = (index) => {
        setFormData(prev => ({
            ...prev,
            volumes: prev.volumes.filter((_, i) => i !== index)
        }));
    };

    const updateVolume = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            volumes: prev.volumes.map((v, i) => i === index ? { ...v, [field]: value } : v)
        }));
    };

    const addEnv = () => {
        setFormData(prev => ({
            ...prev,
            environment: [...prev.environment, { key: '', value: '' }]
        }));
    };

    const removeEnv = (index) => {
        setFormData(prev => ({
            ...prev,
            environment: prev.environment.filter((_, i) => i !== index)
        }));
    };

    const updateEnv = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            environment: prev.environment.map((e, i) => i === index ? { ...e, [field]: value } : e)
        }));
    };

    const openFileSelector = (field, index = null) => {
        setFileSelectorOpen({ open: true, field, index });
    };

    const handleFileSelect = (path) => {
        const { field, index } = fileSelectorOpen;

        if (field === 'env_file') {
            setFormData(prev => ({ ...prev, env_file: path }));
        } else if (field === 'volume' && index !== null) {
            updateVolume(index, 'host_path', path);
        }

        setFileSelectorOpen({ open: false, field: null, index: null });
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
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={openCreateModal}
                    >
                        Create
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
                                <ActionIcon
                                    variant="light"
                                    color="blue"
                                    onClick={() => openEditModal(container)}
                                    title="Edit/Recreate"
                                >
                                    <IconEdit size={16} />
                                </ActionIcon>
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

            {/* Delete Modal */}
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

            {/* Create/Edit Modal */}
            <Modal
                opened={createModal.open}
                onClose={() => setCreateModal({ open: false, container: null })}
                title={createModal.container ? 'Recreate Container' : 'Create Container'}
                size="xl"
            >
                <ScrollArea h={500}>
                    <Stack>
                        {error && (
                            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                                {error}
                            </Alert>
                        )}

                        {/* Basic Settings */}
                        <Text fw={600} size="sm">Basic</Text>
                        <TextInput
                            label="Container Name"
                            placeholder="my-container"
                            value={formData.name}
                            onChange={(e) => updateFormField('name', e.target.value)}
                            required
                        />
                        <Group grow>
                            <Select
                                label="Registry"
                                placeholder="Select registry (optional)"
                                description="Use a private registry"
                                data={registries.map(r => ({ value: r.address, label: r.address }))}
                                value={formData.registry}
                                onChange={(value) => updateFormField('registry', value || '')}
                                searchable
                                clearable
                                disabled={registriesLoading}
                                rightSection={registriesLoading ? <Loader size={14} /> : null}
                            />
                        </Group>
                        <Group grow>
                            <TextInput
                                label="Image"
                                placeholder="nginx"
                                value={formData.image}
                                onChange={(e) => updateFormField('image', e.target.value)}
                                required
                            />
                            <TextInput
                                label="Tag"
                                placeholder="latest"
                                value={formData.tag}
                                onChange={(e) => updateFormField('tag', e.target.value)}
                            />
                        </Group>
                        <Select
                            label="Restart Policy"
                            data={[
                                { value: 'no', label: 'No' },
                                { value: 'always', label: 'Always' },
                                { value: 'on-failure', label: 'On Failure' },
                                { value: 'unless-stopped', label: 'Unless Stopped' },
                            ]}
                            value={formData.restart_policy}
                            onChange={(value) => updateFormField('restart_policy', value)}
                        />

                        {/* Ports */}
                        <Text fw={600} size="sm" mt="md">Ports</Text>
                        {formData.ports.map((port, index) => (
                            <Group key={index} gap="sm">
                                <TextInput
                                    placeholder="8080"
                                    label="Host Port"
                                    value={port.host}
                                    onChange={(e) => updatePort(index, 'host', e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <Text size="sm" c="dimmed" mt={24}>:</Text>
                                <TextInput
                                    placeholder="80"
                                    label="Container Port"
                                    value={port.container}
                                    onChange={(e) => updatePort(index, 'container', e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <ActionIcon
                                    variant="light"
                                    color="red"
                                    mt={24}
                                    onClick={() => removePort(index)}
                                    disabled={formData.ports.length === 1}
                                >
                                    <IconX size={16} />
                                </ActionIcon>
                            </Group>
                        ))}
                        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addPort} size="xs">
                            Add Port
                        </Button>

                        {/* Volumes */}
                        <Text fw={600} size="sm" mt="md">Volumes</Text>
                        {formData.volumes.map((volume, index) => (
                            <Card key={index} padding="sm" withBorder>
                                <Stack gap="xs">
                                    <Select
                                        label="Type"
                                        data={[
                                            { value: 'bind', label: 'Bind Mount' },
                                            { value: 'volume', label: 'Docker Volume' },
                                        ]}
                                        value={volume.type}
                                        onChange={(value) => updateVolume(index, 'type', value)}
                                    />
                                    {volume.type === 'bind' ? (
                                        <Group gap="sm" align="flex-end">
                                            <TextInput
                                                label="Host Path"
                                                placeholder="/path/to/host"
                                                value={volume.host_path}
                                                onChange={(e) => updateVolume(index, 'host_path', e.target.value)}
                                                style={{ flex: 1 }}
                                            />
                                            <Button variant="light" onClick={() => openFileSelector('volume', index)} size="sm">
                                                Browse
                                            </Button>
                                        </Group>
                                    ) : (
                                        <Group gap="xs" align="flex-end">
                                            <Select
                                                label="Volume"
                                                placeholder="Select existing volume"
                                                data={existingVolumes}
                                                value={volume.volume_name}
                                                onChange={(value) => updateVolume(index, 'volume_name', value || '')}
                                                searchable
                                                rightSection={
                                                    volumesLoading ? <Loader size={14} /> : (
                                                        <ActionIcon
                                                            variant="transparent"
                                                            size="sm"
                                                            onClick={fetchVolumes}
                                                        >
                                                            <IconRefresh size={14} />
                                                        </ActionIcon>
                                                    )
                                                }
                                                style={{ flex: 1 }}
                                            />
                                            <Button
                                                variant="light"
                                                onClick={() => {
                                                    const name = prompt('Enter new volume name:');
                                                    if (name) {
                                                        createVolume(name, index);
                                                    }
                                                }}
                                                loading={volumeCreating}
                                                size="sm"
                                            >
                                                New
                                            </Button>
                                        </Group>
                                    )}
                                    <TextInput
                                        label="Container Path"
                                        placeholder="/app/data"
                                        value={volume.container_path}
                                        onChange={(e) => updateVolume(index, 'container_path', e.target.value)}
                                    />
                                    <Button variant="light" color="red" size="xs" onClick={() => removeVolume(index)} disabled={formData.volumes.length === 1}>
                                        Remove
                                    </Button>
                                </Stack>
                            </Card>
                        ))}
                        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addVolume} size="xs">
                            Add Volume
                        </Button>

                        {/* Environment */}
                        <Text fw={600} size="sm" mt="md">Environment</Text>
                        <TextInput
                            label="Env File (optional)"
                            placeholder="/path/to/.env"
                            value={formData.env_file}
                            onChange={(e) => updateFormField('env_file', e.target.value)}
                            rightSection={
                                <ActionIcon variant="light" onClick={() => openFileSelector('env_file')}>
                                    <IconFolder size={16} />
                                </ActionIcon>
                            }
                        />

                        <Text size="sm" fw={500}>Or define variables:</Text>
                        {formData.environment.map((env, index) => (
                            <Group key={index} gap="sm">
                                <TextInput
                                    placeholder="KEY"
                                    label="Key"
                                    value={env.key}
                                    onChange={(e) => updateEnv(index, 'key', e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <TextInput
                                    placeholder="value"
                                    label="Value"
                                    value={env.value}
                                    onChange={(e) => updateEnv(index, 'value', e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <ActionIcon
                                    variant="light"
                                    color="red"
                                    mt={24}
                                    onClick={() => removeEnv(index)}
                                    disabled={formData.environment.length === 1}
                                >
                                    <IconX size={16} />
                                </ActionIcon>
                            </Group>
                        ))}
                        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addEnv} size="xs">
                            Add Variable
                        </Button>

                        <Group justify="flex-end" mt="md">
                            <Button variant="default" onClick={() => setCreateModal({ open: false, container: null })}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} loading={formLoading}>
                                {createModal.container ? 'Recreate' : 'Create'}
                            </Button>
                        </Group>
                    </Stack>
                </ScrollArea>
            </Modal>

            {/* File Selector Modal */}
            <FileSelector
                opened={fileSelectorOpen.open}
                onClose={() => setFileSelectorOpen({ open: false, field: null, index: null })}
                onSelect={handleFileSelect}
                title={fileSelectorOpen.field === 'env_file' ? 'Select Env File' : 'Select Path'}
                selectLabel="Select"
                allowFiles={true}
                showFiles={true}
                filters={fileSelectorOpen.field === 'env_file' ? ['.env'] : []}
            />
        </Stack>
    );
}
