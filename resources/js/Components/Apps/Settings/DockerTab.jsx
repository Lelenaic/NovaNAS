import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    NumberInput,
    Stack,
    Alert,
    Loader,
    useMantineTheme,
    Badge,
    Select,
    Switch,
} from '@mantine/core';
import {
    IconBrandDocker,
    IconCheck,
    IconAlertTriangle,
    IconFolder,
} from '@tabler/icons-react';

export function DockerTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [dockerStatus, setDockerStatus] = useState(null);
    const [settings, setSettings] = useState({
        dataDirectory: '',
        autoUpdateEnabled: false,
        autoUpdateIntervalValue: 30,
        autoUpdateIntervalUnit: 'minutes',
    });

    useEffect(() => {
        fetchDockerSettings();
        fetchAutoUpdateSettings();
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

            setSettings((prev) => ({
                ...prev,
                dataDirectory: data.data_directory,
            }));
        } catch (err) {
            setError('Failed to load Docker settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAutoUpdateSettings = async () => {
        try {
            const response = await fetch('/api/settings/docker/auto-update');
            const data = await response.json();

            setSettings((prev) => ({
                ...prev,
                autoUpdateEnabled: data.auto_update_enabled,
                autoUpdateIntervalValue: data.auto_update_interval_value ?? 30,
                autoUpdateIntervalUnit: data.auto_update_interval_unit ?? 'minutes',
            }));
        } catch (err) {
            console.error('Failed to load auto-update settings:', err);
            // Don't show error for auto-update settings, just use defaults
        }
    };

    const handleSaveAutoUpdate = async () => {
        setError(null);
        setSuccess(null);

        // Client-side validation
        if (!settings.autoUpdateIntervalValue || settings.autoUpdateIntervalValue < 1) {
            setError('Update interval must be at least 1');
            return;
        }

        try {
            setSaving(true);
            const response = await fetch('/api/settings/docker/auto-update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auto_update_enabled: settings.autoUpdateEnabled,
                    auto_update_interval_value: settings.autoUpdateIntervalValue,
                    auto_update_interval_unit: settings.autoUpdateIntervalUnit,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save auto-update settings');
            }

            setSuccess('Auto-update settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
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

                {/* Auto-Update Settings */}
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
                        <Title order={5} c="white">Auto-Update</Title>
                    </Group>

                    <Text size="sm" c="dimmed" mb="md">
                        Automatically update Docker containers using Watchtower. This will keep your containers up-to-date with the latest images. It updates only the containers that are tagged for auto-update.
                    </Text>

                    <Stack gap="md">
                        <Switch
                            label="Enable auto-update"
                            description="When enabled, Watchtower will periodically check for and apply container updates"
                            checked={settings.autoUpdateEnabled}
                            onChange={(event) => setSettings({
                                ...settings,
                                autoUpdateEnabled: event.currentTarget.checked
                            })}
                        />

                        {settings.autoUpdateEnabled && (
                            <Group grow>
                                <NumberInput
                                    label="Update interval"
                                    placeholder="30"
                                    value={settings.autoUpdateIntervalValue}
                                    onChange={(value) => setSettings({
                                        ...settings,
                                        autoUpdateIntervalValue: value
                                    })}
                                    min={1}
                                    max={settings.autoUpdateIntervalUnit === 'hours' ? 24 : settings.autoUpdateIntervalUnit === 'minutes' ? 1440 : 86400}
                                    required
                                />
                                <Select
                                    label="Unit"
                                    data={[
                                        { value: 'seconds', label: 'Seconds' },
                                        { value: 'minutes', label: 'Minutes' },
                                        { value: 'hours', label: 'Hours' },
                                    ]}
                                    value={settings.autoUpdateIntervalUnit}
                                    onChange={(value) => setSettings({
                                        ...settings,
                                        autoUpdateIntervalUnit: value
                                    })}
                                    required
                                />
                            </Group>
                        )}

                        {settings.autoUpdateEnabled && (
                            <Text size="xs" c="dimmed">
                                Watchtower will check every {settings.autoUpdateIntervalValue} {settings.autoUpdateIntervalUnit}
                            </Text>
                        )}

                        <Group justify="flex-end">
                            <Button
                                onClick={handleSaveAutoUpdate}
                                loading={saving}
                                leftSection={<IconCheck size={16} />}
                            >
                                Save Auto-Update Settings
                            </Button>
                        </Group>
                    </Stack>
                </Box>

                {/* Note about data directory */}
                <Alert
                    color="blue"
                    variant="light"
                    icon={<IconFolder size={16} />}
                >
                    <Text size="sm">
                        To change the Docker data directory, use the Storage app in the Apps tab.
                    </Text>
                </Alert>
            </Stack>
        </Box>
    );
}
