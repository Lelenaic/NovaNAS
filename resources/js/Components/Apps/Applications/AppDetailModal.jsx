import { useEffect, useState } from 'react';
import {
    Modal,
    Box,
    Text,
    Group,
    Stack,
    Badge,
    Button,
    Image,
    Loader,
    ActionIcon,
    Tooltip,
    Divider,
    Anchor,
    SimpleGrid,
    Paper,
} from '@mantine/core';
import {
    IconDownload,
    IconTrash,
    IconRefresh,
    IconPlayerStop,
    IconPlayerPlay,
    IconExternalLink,
    IconInfoCircle,
} from '@tabler/icons-react';

export function AppDetailModal({ opened, onClose, app, storeProvider, onInstallComplete }) {
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState(null);
    const [installing, setInstalling] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

    useEffect(() => {
        if (opened && app) {
            fetchDetails();
        }
    }, [opened, app, storeProvider]);

    const fetchDetails = async () => {
        if (!app) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/applications/${storeProvider}/apps/${app.id}`);
            if (!response.ok) throw new Error('Failed to fetch app details');

            const data = await response.json();
            setDetails(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        if (!details) return;

        try {
            setInstalling(true);
            setError(null);

            const response = await fetch(`/api/applications/${storeProvider}/apps/${details.id}/install`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Installation failed');
            }

            setDetails((prev) => ({ ...prev, installed: true, status: 'running' }));
            onInstallComplete?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setInstalling(false);
        }
    };

    const handleRemove = async () => {
        if (!details) return;

        try {
            setRemoving(true);
            setError(null);

            const response = await fetch(`/api/applications/${storeProvider}/apps/${details.id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Removal failed');
            }

            setDetails((prev) => ({ ...prev, installed: false, status: null }));
            onInstallComplete?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setRemoving(false);
        }
    };

    const handleToggle = async (action) => {
        if (!details) return;

        try {
            setActionLoading(true);
            setError(null);

            const response = await fetch(`/api/applications/${storeProvider}/apps/${details.id}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Failed to ${action} application`);
            }

            setDetails((prev) => ({
                ...prev,
                status: action === 'start' ? 'running' : 'stopped',
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={details?.title || app?.title || 'Application Details'}
            size="lg"
            styles={{
                title: { fontWeight: 700 },
            }}
        >
            {loading ? (
                <Box style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Loader size="lg" />
                </Box>
            ) : error && !details ? (
                <Text c="red" ta="center" p="md">
                    {error}
                </Text>
            ) : details ? (
                <Stack gap="md">
                    {error && (
                        <Text c="red" size="sm">
                            {error}
                        </Text>
                    )}

                    <Group gap="lg" align="flex-start">
                        {details.icon && (
                            <Image
                                src={details.icon}
                                w={80}
                                h={80}
                                radius="lg"
                                fit="contain"
                                fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Cpath d='m9 12 2 2 4-4'/%3E%3C/svg%3E"
                            />
                        )}
                        <Box style={{ flex: 1 }}>
                            <Text fw={700} size="lg">
                                {details.title}
                            </Text>
                            {details.tagline && (
                                <Text c="dimmed" size="sm" mt={2}>
                                    {details.tagline}
                                </Text>
                            )}
                            <Group gap="xs" mt="xs">
                                <Badge size="sm" variant="light" color="blue">
                                    {details.category}
                                </Badge>
                                <Badge size="sm" variant="outline" color="gray">
                                    v{details.version}
                                </Badge>
                                {details.installed && (
                                    <Badge
                                        size="sm"
                                        color={details.status === 'running' ? 'green' : 'yellow'}
                                        variant="light"
                                    >
                                        {details.status === 'running' ? 'Running' : details.status || 'Installed'}
                                    </Badge>
                                )}
                            </Group>
                        </Box>
                    </Group>

                    {details.description && (
                        <Paper p="md" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                            <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {details.description}
                            </Text>
                        </Paper>
                    )}

                    {(details.author || details.developer) && (
                        <Group gap="lg">
                            {details.author && (
                                <Box>
                                    <Text size="xs" c="dimmed">
                                        Author
                                    </Text>
                                    <Text size="sm">{details.author}</Text>
                                </Box>
                            )}
                            {details.developer && (
                                <Box>
                                    <Text size="xs" c="dimmed">
                                        Developer
                                    </Text>
                                    <Text size="sm">{details.developer}</Text>
                                </Box>
                            )}
                        </Group>
                    )}

                    {details.screenshot_link?.length > 0 && (
                        <Box>
                            <Text size="xs" c="dimmed" mb="xs">
                                Screenshots
                            </Text>
                            <SimpleGrid cols={3} spacing="xs">
                                {details.screenshot_link.map((url, idx) => (
                                    <Image
                                        key={idx}
                                        src={url}
                                        radius="sm"
                                        fit="cover"
                                        h={100}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => window.open(url, '_blank')}
                                    />
                                ))}
                            </SimpleGrid>
                        </Box>
                    )}

                    <Divider />

                    <Group gap="md">
                        {details.website && (
                            <Anchor href={details.website} target="_blank" size="sm">
                                <Group gap={4}>
                                    Website <IconExternalLink size={12} />
                                </Group>
                            </Anchor>
                        )}
                        {details.repo && (
                            <Anchor href={details.repo} target="_blank" size="sm">
                                <Group gap={4}>
                                    Repository <IconExternalLink size={12} />
                                </Group>
                            </Anchor>
                        )}
                        {details.docs && (
                            <Anchor href={details.docs} target="_blank" size="sm">
                                <Group gap={4}>
                                    Documentation <IconExternalLink size={12} />
                                </Group>
                            </Anchor>
                        )}
                        {details.support && (
                            <Anchor href={details.support} target="_blank" size="sm">
                                <Group gap={4}>
                                    Support <IconExternalLink size={12} />
                                </Group>
                            </Anchor>
                        )}
                    </Group>

                    <Divider />

                    <Group justify="flex-end" gap="sm">
                        {details.installed ? (
                            <>
                                {details.status === 'running' ? (
                                    <Button
                                        variant="light"
                                        color="yellow"
                                        leftSection={<IconPlayerStop size={16} />}
                                        onClick={() => handleToggle('stop')}
                                        loading={actionLoading}
                                        size="sm"
                                    >
                                        Stop
                                    </Button>
                                ) : (
                                    <Button
                                        variant="light"
                                        color="green"
                                        leftSection={<IconPlayerPlay size={16} />}
                                        onClick={() => handleToggle('start')}
                                        loading={actionLoading}
                                        size="sm"
                                    >
                                        Start
                                    </Button>
                                )}
                                <Button
                                    variant="light"
                                    color="blue"
                                    leftSection={<IconRefresh size={16} />}
                                    onClick={async () => {
                                        setActionLoading(true);
                                        try {
                                            await fetch(`/api/applications/${storeProvider}/apps/${details.id}/update`, {
                                                method: 'POST',
                                                headers: {
                                                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                                                },
                                            });
                                            fetchDetails();
                                        } finally {
                                            setActionLoading(false);
                                        }
                                    }}
                                    loading={actionLoading}
                                    size="sm"
                                >
                                    Update
                                </Button>
                                <Button
                                    variant="light"
                                    color="red"
                                    leftSection={<IconTrash size={16} />}
                                    onClick={() => setShowRemoveConfirm(true)}
                                    loading={removing}
                                    size="sm"
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <Button
                                leftSection={<IconDownload size={16} />}
                                onClick={handleInstall}
                                loading={installing}
                            >
                                Install
                            </Button>
                        )}
                    </Group>
                </Stack>
            ) : null}

            <Modal
                opened={showRemoveConfirm}
                onClose={() => setShowRemoveConfirm(false)}
                title={<Text fw={600}>Remove Application</Text>}
                size="sm"
                centered
            >
                <Text c="dimmed" mb="lg">
                    Are you sure you want to remove {details?.title}? This will uninstall the application and all its data.
                </Text>
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={() => setShowRemoveConfirm(false)}>
                        Cancel
                    </Button>
                    <Button
                        color="red"
                        loading={removing}
                        onClick={() => {
                            handleRemove();
                            setShowRemoveConfirm(false);
                        }}
                    >
                        Remove
                    </Button>
                </Group>
            </Modal>
        </Modal>
    );
}
