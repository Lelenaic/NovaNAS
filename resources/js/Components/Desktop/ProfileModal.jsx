import { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    TextInput,
    PasswordInput,
    Button,
    Group,
    Stack,
    Text,
    Alert,
    Divider,
    ActionIcon,
    ThemeIcon,
    Skeleton,
    Tabs,
    Badge,
    Box,
} from '@mantine/core';
import { router } from '@inertiajs/react';
import {
    IconUser,
    IconLock,
    IconAlertCircle,
    IconCheck,
    IconKey,
    IconTrash,
    IconShield,
} from '@tabler/icons-react';
import { startRegistration } from '@simplewebauthn/browser';

export function ProfileModal({ opened, onClose }) {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        username: '',
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const [passkeys, setPasskeys] = useState([]);
    const [passkeysLoading, setPasskeysLoading] = useState(false);
    const [passkeyError, setPasskeyError] = useState(null);
    const [registeringPasskey, setRegisteringPasskey] = useState(false);
    const [passkeyName, setPasskeyName] = useState('');

    const fetchProfile = async () => {
        try {
            const response = await fetch('/api/profile');
            const data = await response.json();
            if (data.user) {
                setFormData((prev) => ({
                    ...prev,
                    name: data.user.name || '',
                    email: data.user.email || '',
                    username: data.user.username || '',
                }));
            }
        } catch (err) {
            setError('Failed to load profile data');
        }
    };

    const fetchPasskeys = useCallback(async () => {
        setPasskeysLoading(true);
        try {
            const response = await fetch('/api/passkeys');
            const data = await response.json();
            setPasskeys(data.passkeys || []);
        } catch (err) {
            setPasskeyError('Failed to load passkeys');
        } finally {
            setPasskeysLoading(false);
        }
    }, []);

    useEffect(() => {
        if (opened) {
            fetchProfile();
            fetchPasskeys();
        }
    }, [opened, fetchPasskeys]);

    const handleChange = (field) => (event) => {
        setFormData((prev) => ({
            ...prev,
            [field]: event.target.value,
        }));
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    const firstError = Object.values(data.errors)[0];
                    throw new Error(firstError[0]);
                }
                throw new Error(data.message || 'Failed to update profile');
            }

            setSuccess('Profile updated successfully');
            router.reload();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                },
                body: JSON.stringify({
                    current_password: formData.current_password,
                    password: formData.password,
                    password_confirmation: formData.password_confirmation,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    const firstError = Object.values(data.errors)[0];
                    throw new Error(firstError[0]);
                }
                throw new Error(data.message || 'Failed to update password');
            }

            setSuccess('Password updated successfully');
            setFormData((prev) => ({
                ...prev,
                current_password: '',
                password: '',
                password_confirmation: '',
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPasskey = async () => {
        if (!passkeyName.trim()) {
            setPasskeyError('Please enter a name for the passkey.');
            return;
        }

        setRegisteringPasskey(true);
        setPasskeyError(null);

        try {
            const optionsResponse = await fetch('/api/passkeys/generate-options', {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                },
            });

            if (!optionsResponse.ok) {
                throw new Error('Failed to generate passkey options');
            }

            const options = await optionsResponse.json();
            const startRegistrationResponse = await startRegistration({ optionsJSON: options });

            const storeResponse = await fetch('/api/passkeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                },
                body: JSON.stringify({
                    options: JSON.stringify(options),
                    passkey: JSON.stringify(startRegistrationResponse),
                    name: passkeyName.trim(),
                }),
            });

            if (!storeResponse.ok) {
                const data = await storeResponse.json();
                throw new Error(data.errors?.passkey?.[0] || 'Failed to register passkey');
            }

            setPasskeyName('');
            await fetchPasskeys();
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setPasskeyError('Passkey registration was cancelled.');
            } else if (err.name === 'InvalidStateError') {
                setPasskeyError('A passkey for this device already exists.');
            } else {
                setPasskeyError(err.message || 'Failed to register passkey');
            }
        } finally {
            setRegisteringPasskey(false);
        }
    };

    const handleDeletePasskey = async (passkeyId) => {
        setPasskeyError(null);

        try {
            const response = await fetch(`/api/passkeys/${passkeyId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to delete passkey');
            }

            await fetchPasskeys();
        } catch (err) {
            setPasskeyError(err.message || 'Failed to delete passkey');
        }
    };

    const handleClose = () => {
        setError(null);
        setSuccess(null);
        setPasskeyError(null);
        setActiveTab('profile');
        setFormData((prev) => ({
            ...prev,
            current_password: '',
            password: '',
            password_confirmation: '',
        }));
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title={
                <Group gap="sm">
                    <Text fw={600}>Profile Settings</Text>
                </Group>
            }
            size="lg"
            centered
        >
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="profile" leftSection={<IconUser size={16} />}>
                        Profile
                    </Tabs.Tab>
                    <Tabs.Tab value="password" leftSection={<IconLock size={16} />}>
                        Password
                    </Tabs.Tab>
                    <Tabs.Tab
                        value="passkeys"
                        leftSection={<IconKey size={16} />}
                        rightSection={
                            passkeys.length > 0 ? (
                                <Badge size="xs" variant="light" color="gray">
                                    {passkeys.length}
                                </Badge>
                            ) : null
                        }
                    >
                        Passkeys
                    </Tabs.Tab>
                    <Tabs.Tab value="2fa" leftSection={<IconShield size={16} />}>
                        2FA
                    </Tabs.Tab>
                </Tabs.List>

                {/* Profile Tab */}
                <Tabs.Panel value="profile" pt="md">
                    <form onSubmit={handleProfileSubmit}>
                        <Stack gap="md">
                            {error && activeTab === 'profile' && (
                                <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
                                    {error}
                                </Alert>
                            )}

                            {success && activeTab === 'profile' && (
                                <Alert icon={<IconCheck size={16} />} color="green" onClose={() => setSuccess(null)} withCloseButton>
                                    {success}
                                </Alert>
                            )}

                            <TextInput
                                label="Username"
                                value={formData.username}
                                disabled
                                description="Username cannot be changed"
                                leftSection={<IconUser size={16} />}
                            />

                            <TextInput
                                label="Name"
                                value={formData.name}
                                onChange={handleChange('name')}
                                required
                                leftSection={<IconUser size={16} />}
                            />

                            <TextInput
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange('email')}
                                required
                                leftSection={<IconUser size={16} />}
                            />

                            <Group justify="flex-end" mt="sm">
                                <Button type="submit" loading={loading}>
                                    Save Changes
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Tabs.Panel>

                {/* Password Tab */}
                <Tabs.Panel value="password" pt="md">
                    <form onSubmit={handlePasswordSubmit}>
                        <Stack gap="md">
                            {error && activeTab === 'password' && (
                                <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
                                    {error}
                                </Alert>
                            )}

                            {success && activeTab === 'password' && (
                                <Alert icon={<IconCheck size={16} />} color="green" onClose={() => setSuccess(null)} withCloseButton>
                                    {success}
                                </Alert>
                            )}

                            <PasswordInput
                                label="Current Password"
                                value={formData.current_password}
                                onChange={handleChange('current_password')}
                                required
                                leftSection={<IconLock size={16} />}
                            />

                            <PasswordInput
                                label="New Password"
                                value={formData.password}
                                onChange={handleChange('password')}
                                required
                                leftSection={<IconLock size={16} />}
                            />

                            <PasswordInput
                                label="Confirm New Password"
                                value={formData.password_confirmation}
                                onChange={handleChange('password_confirmation')}
                                required
                                leftSection={<IconLock size={16} />}
                            />

                            <Group justify="flex-end" mt="sm">
                                <Button type="submit" loading={loading}>
                                    Update Password
                                </Button>
                            </Group>
                        </Stack>
                    </form>
                </Tabs.Panel>

                {/* Passkeys Tab */}
                <Tabs.Panel value="passkeys" pt="md">
                    <Stack gap="md">
                        {passkeyError && (
                            <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setPasskeyError(null)} withCloseButton>
                                {passkeyError}
                            </Alert>
                        )}

                        {passkeysLoading ? (
                            <Stack gap="xs">
                                <Skeleton height={36} />
                                <Skeleton height={36} />
                            </Stack>
                        ) : passkeys.length > 0 ? (
                            <Stack gap="xs">
                                {passkeys.map((passkey) => (
                                    <Group
                                        key={passkey.id}
                                        justify="space-between"
                                        p="xs"
                                        style={{
                                            border: '1px solid var(--mantine-color-default-border)',
                                            borderRadius: 'var(--mantine-radius-sm)',
                                        }}
                                    >
                                        <Group gap="xs">
                                            <ThemeIcon variant="light" size="sm">
                                                <IconKey size={14} />
                                            </ThemeIcon>
                                            <Stack gap={0}>
                                                <Text size="sm" fw={500}>
                                                    {passkey.name}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    Last used:{' '}
                                                    {passkey.last_used_at
                                                        ? new Date(passkey.last_used_at).toLocaleDateString()
                                                        : 'Never'}
                                                </Text>
                                            </Stack>
                                        </Group>
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            size="sm"
                                            onClick={() => handleDeletePasskey(passkey.id)}
                                        >
                                            <IconTrash size={14} />
                                        </ActionIcon>
                                    </Group>
                                ))}
                            </Stack>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="md">
                                No passkeys registered yet.
                            </Text>
                        )}

                        <Divider />

                        <TextInput
                            placeholder="e.g. My iPhone, Hardware Key..."
                            value={passkeyName}
                            onChange={(e) => setPasskeyName(e.target.value)}
                            label="Passkey Name"
                            leftSection={<IconKey size={16} />}
                        />

                        <Button
                            variant="light"
                            leftSection={<IconKey size={16} />}
                            onClick={handleAddPasskey}
                            loading={registeringPasskey}
                            fullWidth
                        >
                            Register New Passkey
                        </Button>
                    </Stack>
                </Tabs.Panel>

                {/* 2FA Tab (placeholder) */}
                <Tabs.Panel value="2fa" pt="md">
                    <Stack gap="md" align="center" py="xl">
                        <ThemeIcon variant="light" size={64} radius="xl">
                            <IconShield size={32} />
                        </ThemeIcon>
                        <Text fw={500}>Two-Factor Authentication</Text>
                        <Text size="sm" c="dimmed" ta="center" maw={400}>
                            Add an extra layer of security to your account by enabling two-factor
                            authentication.
                        </Text>
                        <Badge size="lg" variant="light" color="yellow">
                            Coming Soon
                        </Badge>
                    </Stack>
                </Tabs.Panel>
            </Tabs>
        </Modal>
    );
}
