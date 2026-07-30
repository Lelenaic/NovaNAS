import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    NumberInput,
    TextInput,
    Stack,
    Alert,
    Loader,
    useMantineTheme,
    Tabs,
} from '@mantine/core';
import {
    IconUser,
    IconSettings,
    IconCheck,
} from '@tabler/icons-react';

export function GeneralTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeTab, setActiveTab] = useState('users');

    const [settings, setSettings] = useState({
        invitation_lifetime_hours: 48,
        hostname: '',
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/settings/general');
            const data = await response.json();

            setSettings({
                invitation_lifetime_hours: data.invitation_lifetime_hours || 48,
                hostname: data.hostname || '',
            });
        } catch (err) {
            setError('Failed to load settings');
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
            const response = await fetch('/api/settings/general', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    invitation_lifetime_hours: settings.invitation_lifetime_hours,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save settings');
            }

            setSuccess('Settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleHostnameSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        try {
            setSaving(true);
            const response = await fetch('/api/settings/general', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hostname: settings.hostname,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save hostname');
            }

            setSettings({ ...settings, hostname: data.hostname || settings.hostname });
            setSuccess('Hostname saved successfully!');
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
                    <Title order={3} c="white">General Settings</Title>
                    <Text size="sm" c="dimmed">Configure system settings</Text>
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

            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="users" leftSection={<IconUser size={16} />}>
                        Users
                    </Tabs.Tab>
                    <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
                        General
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="users" pt="md">
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
                                <Title order={5} c="white" mb="md">User Invitations</Title>
                                <Text size="sm" c="dimmed" mb="md">
                                    Configure how long user invitation links remain valid
                                </Text>

                                <NumberInput
                                    label="Invitation Lifetime (hours)"
                                    description="How many hours a user invitation link remains valid before expiring"
                                    placeholder="48"
                                    value={settings.invitation_lifetime_hours}
                                    onChange={(value) => setSettings({ ...settings, invitation_lifetime_hours: value || 48 })}
                                    min={1}
                                    max={720}
                                    required
                                />
                                <Text size="xs" c="dimmed" mt="xs">
                                    Maximum: 720 hours (30 days)
                                </Text>
                            </Box>

                            <Group justify="flex-end">
                                <Button
                                    type="submit"
                                    loading={saving}
                                    leftSection={<IconSettings size={16} />}
                                >
                                    Save Settings
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Tabs.Panel>

                <Tabs.Panel value="general" pt="md">
                    <form onSubmit={handleHostnameSubmit}>
                        <Stack gap="lg">
                            <Box
                                style={{
                                    backgroundColor: theme.colors.dark[6],
                                    borderRadius: '12px',
                                    padding: '20px',
                                    border: `1px solid ${theme.colors.dark[4]}`,
                                }}
                            >
                                <Title order={5} c="white" mb="md">Hostname</Title>
                                <Text size="sm" c="dimmed" mb="md">
                                    Set the system hostname for this NAS. This is used for SSL certificates and network identification.
                                </Text>

                                <TextInput
                                    label="Hostname"
                                    description="The system hostname (e.g. mynas or myhost.mynovanas.com)"
                                    placeholder="localhost"
                                    value={settings.hostname}
                                    onChange={(e) => setSettings({ ...settings, hostname: e.target.value })}
                                    required
                                />
                            </Box>

                            <Group justify="flex-end">
                                <Button
                                    type="submit"
                                    loading={saving}
                                    leftSection={<IconSettings size={16} />}
                                >
                                    Save Hostname
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Tabs.Panel>
            </Tabs>
        </Box>
    );
}
