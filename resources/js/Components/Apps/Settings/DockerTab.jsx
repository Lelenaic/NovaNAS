import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    TextInput,
    Stack,
    Alert,
    Loader,
    useMantineTheme,
    Badge,
    Select,
    Modal,
    Progress,
} from '@mantine/core';
import {
    IconBrandDocker,
    IconCheck,
    IconAlertTriangle,
    IconFolder,
    IconRefresh,
} from '@tabler/icons-react';

export function DockerTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [dockerStatus, setDockerStatus] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [moving, setMoving] = useState(false);

    const [settings, setSettings] = useState({
        dataDirectory: '',
        newDataDirectory: '',
    });

    useEffect(() => {
        fetchDockerSettings();
    }, []);

    const fetchDockerSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/settings/docker');
            const data = await response.json();

            setDockerStatus({
                isInstalled: data.is_installed,
                isRunning: data.is_running,
                defaultDataDir: data.default_data_dir,
            });

            setSettings({
                dataDirectory: data.data_directory,
                newDataDirectory: data.data_directory,
            });
        } catch (err) {
            setError('Failed to load Docker settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleMoveDirectory = async () => {
        if (settings.newDataDirectory === settings.dataDirectory) {
            setError('New directory is the same as current directory');
            return;
        }

        setShowConfirmModal(true);
    };

    const confirmMoveDirectory = async () => {
        setShowConfirmModal(false);
        setError(null);
        setSuccess(null);
        setMoving(true);

        try {
            const response = await fetch('/api/settings/docker/move-data-directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    new_data_directory: settings.newDataDirectory,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to move data directory');
            }

            setSuccess(data.message);
            setSettings({
                ...settings,
                dataDirectory: settings.newDataDirectory,
            });

            // Refresh to get updated status
            await fetchDockerSettings();
        } catch (err) {
            setError(err.message);
        } finally {
            setMoving(false);
        }
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    // Docker not installed
    if (!dockerStatus?.isInstalled) {
        return (
            <Box>
                <Group justify="space-between" mb="lg">
                    <div>
                        <Title order={3} c="white">Docker Settings</Title>
                        <Text size="sm" c="dimmed">Configure Docker settings</Text>
                    </div>
                </Group>

                <Alert
                    color="yellow"
                    variant="light"
                    icon={<IconAlertTriangle size={16} />}
                    title="Docker Not Installed"
                >
                    Docker is not installed on this system. Please install Docker to manage container settings.
                </Alert>
            </Box>
        );
    }

    return (
        <Box>
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={3} c="white">Docker Settings</Title>
                    <Text size="sm" c="dimmed">Configure Docker data directory</Text>
                </div>
                <Group gap="xs">
                    <Badge
                        color={dockerStatus?.isRunning ? 'green' : 'red'}
                        variant="light"
                        size="lg"
                    >
                        {dockerStatus?.isRunning ? 'Running' : 'Stopped'}
                    </Badge>
                </Group>
            </Group>

            {error && (
                <Alert
                    color="red"
                    variant="light"
                    mb="md"
                    onClose={() => setError(null)}
                    withCloseButton
                >
                    {error}
                </Alert>
            )}

            {success && (
                <Alert
                    color="green"
                    variant="light"
                    mb="md"
                    onClose={() => setSuccess(null)}
                    withCloseButton
                    icon={<IconCheck size={16} />}
                >
                    {success}
                </Alert>
            )}

            <Stack gap="lg">
                {/* Current Status */}
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group gap="xs" mb="md">
                        <IconBrandDocker size={20} color={theme.colors.blue[5]} />
                        <Title order={5} c="white">Docker Status</Title>
                    </Group>

                    <Group justify="space-between" mb="xs">
                        <Text size="sm" c="dimmed">Current Data Directory:</Text>
                        <Text size="sm" c="white" fw={500}>{settings.dataDirectory}</Text>
                    </Group>

                    <Group justify="space-between">
                        <Text size="sm" c="dimmed">Default Data Directory:</Text>
                        <Text size="sm" c="dimmed">{dockerStatus?.defaultDataDir}</Text>
                    </Group>
                </Box>

                {/* Move Data Directory */}
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group gap="xs" mb="md">
                        <IconFolder size={20} color={theme.colors.blue[5]} />
                        <Title order={5} c="white">Move Data Directory</Title>
                    </Group>

                    <Text size="sm" c="dimmed" mb="md">
                        Change where Docker stores its data (images, containers, volumes, etc.).
                        This will stop Docker, move the data, update the configuration, and restart Docker.
                    </Text>

                    <TextInput
                        label="Current Data Directory"
                        description="The current Docker data directory"
                        value={settings.dataDirectory}
                        disabled
                        mb="md"
                    />

                    <TextInput
                        label="New Data Directory"
                        description="Enter the absolute path for the new data directory"
                        placeholder="/mnt/storage/docker"
                        value={settings.newDataDirectory}
                        onChange={(e) => setSettings({ ...settings, newDataDirectory: e.target.value })}
                        error={settings.newDataDirectory === settings.dataDirectory ? 'Same as current directory' : null}
                        mb="md"
                    />

                    {dockerStatus?.available_mount_points?.length > 0 && (
                        <Select
                            label="Quick Select Mount Point"
                            description="Select from available mount points"
                            placeholder="Select a mount point"
                            data={dockerStatus.available_mount_points.map((mp) => ({
                                value: mp.path + '/docker',
                                label: mp.name + ' (' + mp.path + ')',
                            }))}
                            onChange={(value) => {
                                if (value) {
                                    setSettings({ ...settings, newDataDirectory: value });
                                }
                            }}
                            mb="md"
                            clearable
                        />
                    )}

                    <Group justify="flex-end">
                        <Button
                            onClick={handleMoveDirectory}
                            loading={moving}
                            disabled={!settings.newDataDirectory || settings.newDataDirectory === settings.dataDirectory}
                            leftSection={<IconRefresh size={16} />}
                            color="orange"
                        >
                            Move Data Directory
                        </Button>
                    </Group>
                </Box>
            </Stack>

            {/* Confirmation Modal */}
            <Modal
                opened={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                title="Confirm Data Directory Move"
                centered
            >
                <Stack gap="md">
                    <Alert
                        color="yellow"
                        variant="light"
                        icon={<IconAlertTriangle size={16} />}
                    >
                        This operation will:
                    </Alert>
                    <Text size="sm" c="dimmed">
                        1. Stop the Docker service
                    </Text>
                    <Text size="sm" c="dimmed">
                        2. Move data from <code>{settings.dataDirectory}</code> to <code>{settings.newDataDirectory}</code>
                    </Text>
                    <Text size="sm" c="dimmed">
                        3. Update Docker daemon.json configuration
                    </Text>
                    <Text size="sm" c="dimmed">
                        4. Restart Docker service
                    </Text>
                    <Text size="sm" c="dimmed" fw={500}>
                        This may take several minutes depending on the size of your Docker data.
                    </Text>
                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={() => setShowConfirmModal(false)}>
                            Cancel
                        </Button>
                        <Button color="orange" onClick={confirmMoveDirectory}>
                            Move Directory
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
}
