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
    CopyButton,
    Tooltip,
    PinInput,
} from '@mantine/core';
import { QRCodeSVG } from 'qrcode.react';
import { router } from '@inertiajs/react';
import {
    IconUser,
    IconLock,
    IconAlertCircle,
    IconCheck,
    IconKey,
    IconTrash,
    IconShield,
    IconCopy,
    IconCheck as IconCheckFilled,
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

    // 2FA state
    const [twoFaEnabled, setTwoFaEnabled] = useState(false);
    const [twoFaLoading, setTwoFaLoading] = useState(false);
    const [twoFaSetupStep, setTwoFaSetupStep] = useState(null); // null | 'qr' | 'verify'
    const [twoFaSecret, setTwoFaSecret] = useState('');
    const [twoFaProvisioningUri, setTwoFaProvisioningUri] = useState('');
    const [twoFaCode, setTwoFaCode] = useState('');
    const [twoFaError, setTwoFaError] = useState(null);
    const [twoFaSuccess, setTwoFaSuccess] = useState(null);
    const [disablePassword, setDisablePassword] = useState('');
    const [showDisableForm, setShowDisableForm] = useState(false);

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

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

    const fetchTwoFaStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/2fa');
            const data = await response.json();
            setTwoFaEnabled(data.enabled);
        } catch (err) {
            // Silently fail — status will show as disabled
        }
    }, []);

    useEffect(() => {
        if (opened) {
            fetchProfile();
            fetchPasskeys();
            fetchTwoFaStatus();
            // Reset 2FA setup state when opening
            setTwoFaSetupStep(null);
            setTwoFaCode('');
            setTwoFaError(null);
            setTwoFaSuccess(null);
            setShowDisableForm(false);
            setDisablePassword('');
        }
    }, [opened, fetchPasskeys, fetchTwoFaStatus]);

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
                    'X-CSRF-TOKEN': csrfToken,
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
                    'X-CSRF-TOKEN': csrfToken,
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
                    'X-CSRF-TOKEN': csrfToken,
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
                    'X-CSRF-TOKEN': csrfToken,
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
                    'X-CSRF-TOKEN': csrfToken,
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

    // 2FA handlers
    const handleStartTwoFaSetup = async () => {
        setTwoFaLoading(true);
        setTwoFaError(null);
        setTwoFaSuccess(null);

        try {
            const response = await fetch('/api/2fa', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate 2FA secret');
            }

            setTwoFaSecret(data.secret);
            setTwoFaProvisioningUri(data.provisioning_uri);
            setTwoFaSetupStep('qr');
        } catch (err) {
            setTwoFaError(err.message);
        } finally {
            setTwoFaLoading(false);
        }
    };

    const handleConfirmTwoFa = async () => {
        if (twoFaCode.length !== 6) {
            setTwoFaError('Please enter a 6-digit code.');
            return;
        }

        setTwoFaLoading(true);
        setTwoFaError(null);

        try {
            const response = await fetch('/api/2fa/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({ code: twoFaCode }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to verify code');
            }

            setTwoFaEnabled(true);
            setTwoFaSetupStep(null);
            setTwoFaCode('');
            setTwoFaSuccess('Two-factor authentication has been enabled.');
        } catch (err) {
            setTwoFaError(err.message);
        } finally {
            setTwoFaLoading(false);
        }
    };

    const handleDisableTwoFa = async () => {
        if (!disablePassword) {
            setTwoFaError('Please enter your password.');
            return;
        }

        setTwoFaLoading(true);
        setTwoFaError(null);

        try {
            const response = await fetch('/api/2fa', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({ password: disablePassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to disable 2FA');
            }

            setTwoFaEnabled(false);
            setShowDisableForm(false);
            setDisablePassword('');
            setTwoFaSuccess('Two-factor authentication has been disabled.');
        } catch (err) {
            setTwoFaError(err.message);
        } finally {
            setTwoFaLoading(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setSuccess(null);
        setPasskeyError(null);
        setActiveTab('profile');
        setTwoFaSetupStep(null);
        setTwoFaCode('');
        setTwoFaError(null);
        setTwoFaSuccess(null);
        setShowDisableForm(false);
        setDisablePassword('');
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
                    <Tabs.Tab
                        value="2fa"
                        leftSection={<IconShield size={16} />}
                        rightSection={
                            twoFaEnabled ? (
                                <Badge size="xs" variant="light" color="green">
                                    On
                                </Badge>
                            ) : null
                        }
                    >
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

                {/* 2FA Tab */}
                <Tabs.Panel value="2fa" pt="md">
                    <Stack gap="md">
                        {twoFaError && (
                            <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setTwoFaError(null)} withCloseButton>
                                {twoFaError}
                            </Alert>
                        )}

                        {twoFaSuccess && (
                            <Alert icon={<IconCheck size={16} />} color="green" onClose={() => setTwoFaSuccess(null)} withCloseButton>
                                {twoFaSuccess}
                            </Alert>
                        )}

                        {twoFaEnabled ? (
                            /* 2FA is enabled — show status and disable option */
                            <>
                                <Group
                                    p="md"
                                    style={{
                                        border: '1px solid var(--mantine-color-green-light)',
                                        borderRadius: 'var(--mantine-radius-sm)',
                                        backgroundColor: 'var(--mantine-color-green-light)',
                                    }}
                                >
                                    <ThemeIcon variant="light" color="green" size="lg">
                                        <IconShield size={20} />
                                    </ThemeIcon>
                                    <div>
                                        <Text fw={500} size="sm">
                                            Two-factor authentication is enabled
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            Your account is protected with an authenticator app.
                                        </Text>
                                    </div>
                                </Group>

                                {showDisableForm ? (
                                    <Stack gap="md">
                                        <Divider />
                                        <Text size="sm" fw={500}>
                                            Disable Two-Factor Authentication
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            Enter your password to confirm.
                                        </Text>
                                        <PasswordInput
                                            placeholder="Current password"
                                            value={disablePassword}
                                            onChange={(e) => setDisablePassword(e.target.value)}
                                            leftSection={<IconLock size={16} />}
                                        />
                                        <Group justify="flex-end" gap="xs">
                                            <Button
                                                variant="subtle"
                                                color="gray"
                                                onClick={() => {
                                                    setShowDisableForm(false);
                                                    setDisablePassword('');
                                                    setTwoFaError(null);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                color="red"
                                                onClick={handleDisableTwoFa}
                                                loading={twoFaLoading}
                                            >
                                                Disable 2FA
                                            </Button>
                                        </Group>
                                    </Stack>
                                ) : (
                                    <Button
                                        variant="outline"
                                        color="red"
                                        onClick={() => setShowDisableForm(true)}
                                        fullWidth
                                    >
                                        Disable Two-Factor Authentication
                                    </Button>
                                )}
                            </>
                        ) : twoFaSetupStep === 'qr' ? (
                            /* Setup step 1: Show QR code */
                            <>
                                <Text size="sm" fw={500}>
                                    Step 1: Scan QR Code
                                </Text>
                                <Text size="xs" c="dimmed">
                                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
                                </Text>

                                <Group justify="center" py="md">
                                    <Box
                                        p="md"
                                        style={{
                                            backgroundColor: 'white',
                                            borderRadius: 'var(--mantine-radius-sm)',
                                        }}
                                    >
                                        <QRCodeSVG value={twoFaProvisioningUri} size={180} />
                                    </Box>
                                </Group>

                                <Text size="xs" c="dimmed" ta="center">
                                    Or enter this code manually:
                                </Text>

                                <CopyButton value={twoFaSecret}>
                                    {({ copied, copy }) => (
                                        <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="bottom">
                                            <Button
                                                variant="subtle"
                                                size="compact-sm"
                                                onClick={copy}
                                                fullWidth
                                                styles={{
                                                    root: {
                                                        fontFamily: 'monospace',
                                                        fontSize: 'var(--mantine-font-size-sm)',
                                                        letterSpacing: '0.1em',
                                                    },
                                                }}
                                                rightSection={copied ? <IconCheckFilled size={14} /> : <IconCopy size={14} />}
                                            >
                                                {twoFaSecret}
                                            </Button>
                                        </Tooltip>
                                    )}
                                </CopyButton>

                                <Button
                                    fullWidth
                                    onClick={() => setTwoFaSetupStep('verify')}
                                >
                                    Continue
                                </Button>
                            </>
                        ) : twoFaSetupStep === 'verify' ? (
                            /* Setup step 2: Verify code */
                            <>
                                <Text size="sm" fw={500}>
                                    Step 2: Verify Code
                                </Text>
                                <Text size="xs" c="dimmed">
                                    Enter the 6-digit code from your authenticator app to complete setup.
                                </Text>

                                <Group justify="center" py="md">
                                    <PinInput
                                        length={6}
                                        size="lg"
                                        gap="sm"
                                        autoFocus
                                        value={twoFaCode}
                                        onChange={setTwoFaCode}
                                        styles={{
                                            input: {
                                                textAlign: 'center',
                                            },
                                        }}
                                    />
                                </Group>

                                <Group justify="flex-end" gap="xs">
                                    <Button
                                        variant="subtle"
                                        color="gray"
                                        onClick={() => {
                                            setTwoFaSetupStep('qr');
                                            setTwoFaCode('');
                                            setTwoFaError(null);
                                        }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleConfirmTwoFa}
                                        loading={twoFaLoading}
                                        disabled={twoFaCode.length !== 6}
                                    >
                                        Enable 2FA
                                    </Button>
                                </Group>
                            </>
                        ) : (
                            /* Initial state: Show enable button */
                            <Stack gap="md" align="center" py="xl">
                                <ThemeIcon variant="light" size={64} radius="xl">
                                    <IconShield size={32} />
                                </ThemeIcon>
                                <Text fw={500}>Two-Factor Authentication</Text>
                                <Text size="sm" c="dimmed" ta="center" maw={400}>
                                    Add an extra layer of security to your account by enabling
                                    two-factor authentication. You'll need an authenticator app
                                    like Google Authenticator or Authy.
                                </Text>
                                <Button
                                    onClick={handleStartTwoFaSetup}
                                    loading={twoFaLoading}
                                    leftSection={<IconShield size={16} />}
                                >
                                    Enable Two-Factor Authentication
                                </Button>
                            </Stack>
                        )}
                    </Stack>
                </Tabs.Panel>
            </Tabs>
        </Modal>
    );
}
