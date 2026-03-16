import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    TextInput,
    Stack,
    PasswordInput,
    Select,
    Alert,
    Loader,
    useMantineTheme,
} from '@mantine/core';
import {
    IconMail,
    IconCheck,
    IconX,
    IconSend,
} from '@tabler/icons-react';

export function EmailTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [formData, setFormData] = useState({
        smtp_host: '',
        smtp_port: '587',
        smtp_username: '',
        smtp_password: '',
        smtp_encryption: 'tls',
        smtp_from_address: '',
        smtp_from_name: 'NovaNAS',
    });

    const [testEmail, setTestEmail] = useState('');
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/email/settings');
            const data = await response.json();

            setFormData({
                smtp_host: data.smtp_host || '',
                smtp_port: data.smtp_port || '587',
                smtp_username: data.smtp_username || '',
                smtp_password: '',
                smtp_encryption: data.smtp_encryption || 'tls',
                smtp_from_address: data.smtp_from_address || '',
                smtp_from_name: data.smtp_from_name || 'NovaNAS',
            });
        } catch (err) {
            setError('Failed to load email settings');
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
            const response = await fetch('/api/email/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save settings');
            }

            setSuccess('Email settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!testEmail) {
            setTestResult({ success: false, message: 'Please enter a test email address' });
            return;
        }

        setTestResult(null);
        setTesting(true);

        try {
            const response = await fetch('/api/email/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ test_email: testEmail }),
            });

            const data = await response.json();
            setTestResult(data);
        } catch (err) {
            setTestResult({ success: false, message: 'Failed to send test email' });
        } finally {
            setTesting(false);
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
                    <Title order={3} c="white">Email</Title>
                    <Text size="sm" c="dimmed">Configure SMTP settings for outgoing emails</Text>
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
                    {/* SMTP Server Settings */}
                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Title order={5} c="white" mb="md">SMTP Server</Title>

                        <Group grow mb="md">
                            <TextInput
                                label="SMTP Host"
                                placeholder="smtp.example.com"
                                value={formData.smtp_host}
                                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                                required
                            />
                            <TextInput
                                label="Port"
                                placeholder="587"
                                value={formData.smtp_port}
                                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                                required
                            />
                        </Group>

                        <Group grow mb="md">
                            <Select
                                label="Encryption"
                                data={[
                                    { value: 'tls', label: 'TLS' },
                                    { value: 'ssl', label: 'SSL' },
                                    { value: 'none', label: 'None' },
                                ]}
                                value={formData.smtp_encryption}
                                onChange={(value) => setFormData({ ...formData, smtp_encryption: value })}
                            />
                            <div />
                        </Group>

                        <Group grow>
                            <TextInput
                                label="Username"
                                placeholder="user@example.com"
                                value={formData.smtp_username}
                                onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
                            />
                            <PasswordInput
                                label="Password"
                                placeholder="Enter password"
                                value={formData.smtp_password}
                                onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                            />
                        </Group>
                    </Box>

                    {/* From Address Settings */}
                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Title order={5} c="white" mb="md">From Address</Title>

                        <Group grow>
                            <TextInput
                                label="Email Address"
                                placeholder="noreply@example.com"
                                value={formData.smtp_from_address}
                                onChange={(e) => setFormData({ ...formData, smtp_from_address: e.target.value })}
                                required
                            />
                            <TextInput
                                label="Sender Name"
                                placeholder="NovaNAS"
                                value={formData.smtp_from_name}
                                onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
                                required
                            />
                        </Group>
                    </Box>

                    {/* Test Email Section */}
                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Title order={5} c="white" mb="md">Test Email</Title>

                        <Group gap="md" align="flex-end">
                            <TextInput
                                label="Send test to"
                                placeholder="your@email.com"
                                style={{ flex: 1 }}
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                            />
                            <Button
                                leftSection={testing ? <Loader size={16} color="white" /> : <IconSend size={16} />}
                                onClick={handleTest}
                                loading={testing}
                                variant="light"
                            >
                                Send Test
                            </Button>
                        </Group>

                        {testResult && (
                            <Alert
                                color={testResult.success ? 'green' : 'red'}
                                variant="light"
                                mt="md"
                                icon={testResult.success ? <IconCheck size={16} /> : <IconX size={16} />}
                            >
                                {testResult.message}
                            </Alert>
                        )}
                    </Box>

                    {/* Save Button */}
                    <Group justify="flex-end">
                        <Button
                            type="submit"
                            loading={saving}
                            leftSection={<IconMail size={16} />}
                        >
                            Save Settings
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Box>
    );
}
