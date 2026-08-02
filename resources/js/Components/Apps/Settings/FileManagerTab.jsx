import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    Select,
    NumberInput,
    Stack,
    Alert,
    Loader,
    useMantineTheme,
} from '@mantine/core';
import {
    IconFolder,
    IconCheck,
    IconTrash,
} from '@tabler/icons-react';

const SIZE_OPTIONS = [
    { value: '0', label: 'Unlimited' },
    { value: '1M', label: '1 MB' },
    { value: '2M', label: '2 MB' },
    { value: '4M', label: '4 MB' },
    { value: '8M', label: '8 MB' },
    { value: '16M', label: '16 MB' },
    { value: '32M', label: '32 MB' },
    { value: '64M', label: '64 MB' },
    { value: '128M', label: '128 MB' },
    { value: '256M', label: '256 MB' },
    { value: '512M', label: '512 MB' },
    { value: '1G', label: '1 GB' },
    { value: '2G', label: '2 GB' },
    { value: '4G', label: '4 GB' },
];

const RETENTION_OPTIONS = [
    { value: '7', label: '7 days' },
    { value: '14', label: '14 days' },
    { value: '30', label: '30 days' },
    { value: '60', label: '60 days' },
    { value: '90', label: '90 days' },
    { value: '180', label: '180 days' },
    { value: '365', label: '365 days' },
];

export function FileManagerTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [uploadMaxFilesize, setUploadMaxFilesize] = useState('2M');
    const [trashRetentionDays, setTrashRetentionDays] = useState(30);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/settings/filemanager');
            const data = await response.json();

            setUploadMaxFilesize(data.upload_max_filesize || '2M');
            setTrashRetentionDays(data.trash_retention_days || 30);
        } catch (err) {
            setError('Failed to load file manager settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        try {
            setSaving(true);
            const response = await fetch('/api/settings/filemanager', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    upload_max_filesize: uploadMaxFilesize,
                    trash_retention_days: trashRetentionDays,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save settings');
            }

            setUploadMaxFilesize(data.upload_max_filesize || uploadMaxFilesize);
            setTrashRetentionDays(data.trash_retention_days || trashRetentionDays);
            setSuccess('Settings saved successfully.');
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

    return (
        <Box>
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={3} c="white">File Manager</Title>
                    <Text size="sm" c="dimmed">Configure file upload, transfer, and trash settings</Text>
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

            <form onSubmit={handleSubmit}>
                <Stack gap="lg">
                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Title order={5} c="white" mb="md">Upload Limits</Title>
                        <Text size="sm" c="dimmed" mb="md">
                            Set the maximum file size allowed for uploads. This is configured directly in the
                            Apache PHP configuration (php.ini).
                        </Text>

                        <Select
                            label="Maximum Upload File Size"
                            description="Files larger than this limit will be rejected by the server"
                            data={SIZE_OPTIONS}
                            value={uploadMaxFilesize}
                            onChange={(value) => setUploadMaxFilesize(value || '2M')}
                            searchable
                            allowDeselect={false}
                        />

                        <Text size="xs" c="dimmed" mt="xs">
                            Current limit: {uploadMaxFilesize === '0' ? 'Unlimited' : uploadMaxFilesize}
                            {' '}&mdash; Stored in php.ini, not in the database.
                        </Text>
                    </Box>

                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Group gap="sm" mb="md">
                            <IconTrash size={20} color={theme.colors.gray[4]} />
                            <Title order={5} c="white">Trash</Title>
                        </Group>
                        <Text size="sm" c="dimmed" mb="md">
                            Configure how long deleted files are kept in trash before being permanently removed.
                            An automatic cleanup job runs daily at 3:00 AM.
                        </Text>

                        <Select
                            label="Auto-Delete After"
                            description="Files in trash will be permanently deleted after this period"
                            data={RETENTION_OPTIONS}
                            value={String(trashRetentionDays)}
                            onChange={(value) => setTrashRetentionDays(parseInt(value, 10) || 30)}
                            searchable
                            allowDeselect={false}
                        />
                    </Box>

                    <Group justify="flex-end">
                        <Button
                            type="submit"
                            loading={saving}
                            leftSection={<IconFolder size={16} />}
                        >
                            Save Settings
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Box>
    );
}
