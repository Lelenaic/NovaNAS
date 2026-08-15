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
    Paper,
    Switch,
    useMantineTheme,
} from '@mantine/core';
import {
    IconFileText,
    IconTrash,
    IconCheck,
    IconSettings,
} from '@tabler/icons-react';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function LogsTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [cleanResult, setCleanResult] = useState(null);
    const [dryRun, setDryRun] = useState(false);

    const [settings, setSettings] = useState({
        auto_delete_days: 30,
        total_size_bytes: 0,
        file_count: 0,
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/settings/logs');
            const data = await response.json();

            setSettings({
                auto_delete_days: data.auto_delete_days || 30,
                total_size_bytes: data.total_size_bytes || 0,
                file_count: data.file_count || 0,
            });
        } catch (err) {
            setError('Failed to load log settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setCleanResult(null);

        try {
            setSaving(true);
            const response = await fetch('/api/settings/logs', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    auto_delete_days: settings.auto_delete_days,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save settings');
            }

            setSettings({ ...settings, auto_delete_days: data.auto_delete_days });
            setSuccess('Log settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleClean = async () => {
        setError(null);
        setSuccess(null);
        setCleanResult(null);

        try {
            setCleaning(true);
            const response = await fetch('/api/settings/logs/prune', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dry_run: dryRun }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to clean logs');
            }

            setCleanResult(data.output);
            setSuccess(dryRun ? 'Dry run completed.' : 'Logs cleaned successfully!');
            setTimeout(() => setSuccess(null), 4000);
            fetchSettings();
        } catch (err) {
            setError(err.message);
        } finally {
            setCleaning(false);
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
        <Box>
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={3} c="white">Log Settings</Title>
                    <Text size="sm" c="dimmed">Configure automatic deletion of old log lines</Text>
                </div>
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
                <Paper
                    withBorder
                    p="md"
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderColor: theme.colors.dark[4],
                    }}
                >
                    <Group>
                        <Box>
                            <Text size="sm" c="dimmed">Log files</Text>
                            <Text c="white" fw={600}>{settings.file_count}</Text>
                        </Box>
                        <Box>
                            <Text size="sm" c="dimmed">Total size</Text>
                            <Text c="white" fw={600}>{formatBytes(settings.total_size_bytes)}</Text>
                        </Box>
                    </Group>
                </Paper>

                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Title order={5} c="white" mb="md">Auto-Deletion</Title>
                    <Text size="sm" c="dimmed" mb="md">
                        Log lines older than the retention period are automatically deleted every day at 4:00 AM.
                        Files are kept, only the expired log lines inside them are removed.
                    </Text>

                    <NumberInput
                        label="Retention period (days)"
                        description="Log lines older than this many days will be deleted automatically"
                        placeholder="30"
                        value={settings.auto_delete_days}
                        onChange={(value) => setSettings({ ...settings, auto_delete_days: value || 30 })}
                        min={1}
                        max={3650}
                        required
                    />
                    <Text size="xs" c="dimmed" mt="xs">
                        Default: 30 days. Maximum: 3650 days.
                    </Text>
                </Box>

                <Group justify="space-between">
                    <Button
                        type="submit"
                        loading={saving}
                        leftSection={<IconSettings size={16} />}
                        onClick={handleSubmit}
                    >
                        Save Settings
                    </Button>

                    <Group gap="sm">
                        <Switch
                            label="Dry run"
                            checked={dryRun}
                            onChange={(event) => setDryRun(event.currentTarget.checked)}
                        />
                        <Button
                            color="red"
                            variant="light"
                            loading={cleaning}
                            leftSection={<IconTrash size={16} />}
                            onClick={handleClean}
                        >
                            Clean Logs Now
                        </Button>
                    </Group>
                </Group>

                {cleanResult && (
                    <Paper
                        withBorder
                        p="md"
                        style={{
                            backgroundColor: theme.colors.dark[7],
                            borderColor: theme.colors.dark[4],
                        }}
                    >
                        <Title order={6} c="dimmed" mb="xs">Result</Title>
                        <Box
                            component="pre"
                            style={{
                                whiteSpace: 'pre-wrap',
                                margin: 0,
                                fontSize: '12px',
                                color: theme.colors.gray[5],
                            }}
                        >
                            {cleanResult}
                        </Box>
                    </Paper>
                )}
            </Stack>
        </Box>
    );
}
