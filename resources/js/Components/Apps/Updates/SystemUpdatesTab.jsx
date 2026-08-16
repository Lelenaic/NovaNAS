import { useState, useEffect, useRef } from 'react';
import { useBadges } from '../../Desktop/BadgeContext';
import { useConfirmModal } from '../../ConfirmModal';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    Alert,
    Loader,
    Badge,
    ScrollArea,
    Divider,
    useMantineTheme,
} from '@mantine/core';
import {
    IconRefresh,
    IconArrowUp,
    IconClock,
    IconCheck,
    IconX,
    IconTerminal,
    IconPackage,
} from '@tabler/icons-react';

export function SystemUpdatesTab() {
    const theme = useMantineTheme();
    const { clearBadge: clearContextBadge } = useBadges();
    const [status, setStatus] = useState(null);
    const [availableUpdates, setAvailableUpdates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [error, setError] = useState(null);
    const [terminalOutput, setTerminalOutput] = useState('');
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const [rebootRequired, setRebootRequired] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [upgradeJobId, setUpgradeJobId] = useState(null);
    const [upgradePolling, setUpgradePolling] = useState(false);
    const [checkJobId, setCheckJobId] = useState(null);
    const [checkPolling, setCheckPolling] = useState(false);
    const terminalRef = useRef(null);
    const [confirmRestart, restartConfirmModal] = useConfirmModal();
    const [confirmUpgrade, upgradeConfirmModal] = useConfirmModal();

    useEffect(() => {
        fetchStatus();
        fetchAvailableUpdates();
        fetchRebootStatus();
        // Don't clear badge when opening the app - only clear when updates are installed
    }, []);

    const clearBadge = async () => {
        try {
            await fetch('/api/updates/clear-badge', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });
            // Also clear from local context
            clearContextBadge('updates');
        } catch (err) {
            console.error('Failed to clear badge:', err);
        }
    };

    // Auto-scroll terminal to bottom when new output arrives
    useEffect(() => {
        if (terminalRef.current) {
            const scrollElement = terminalRef.current.querySelector('[data-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [terminalOutput]);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/updates/status');
            const data = await response.json();

            setStatus(data);
            setLastUpdateTime(data.last_update);
            setError(null);

            // Also fetch available updates if there are any
            if (data.updates_available) {
                await fetchAvailableUpdates();
            }
        } catch (err) {
            setError('Failed to fetch update status');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableUpdates = async () => {
        try {
            const response = await fetch('/api/updates/available');
            const data = await response.json();
            setAvailableUpdates(data.packages || []);
        } catch (err) {
            console.error('Failed to fetch available updates:', err);
        }
    };

    const fetchRebootStatus = async () => {
        try {
            const response = await fetch('/api/updates/reboot-status');
            const data = await response.json();
            setRebootRequired(data.required || false);
        } catch (err) {
            console.error('Failed to fetch reboot status:', err);
        }
    };

    const handleCheckUpdates = async () => {
        setChecking(true);
        setError(null);
        setTerminalOutput('Starting update check...\n');

        try {
            const response = await fetch('/api/updates/check', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (response.ok) {
                setCheckJobId(data.job_id);
                setCheckPolling(true);
                pollCheckStatus(data.job_id);
            } else {
                setError(data.message || 'Failed to start update check');
                setTerminalOutput(prev => prev + `Error: ${data.message || 'Unknown error occurred'}\n`);
                setChecking(false);
            }
        } catch (err) {
            setError('Failed to start update check');
            setTerminalOutput(prev => prev + `Error: ${err.message}\n`);
            setChecking(false);
            console.error(err);
        }
    };

    const handleRestart = async () => {
        const confirmed = await confirmRestart({
            title: 'Restart System',
            message: 'Are you sure you want to restart the system now? This will disconnect all users and stop all services.',
            confirmLabel: 'Restart',
            color: 'orange',
        });
        if (!confirmed) {
            return;
        }

        setRestarting(true);
        setError(null);

        try {
            const response = await fetch('/api/updates/restart', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (response.ok) {
                setTerminalOutput(prev => prev + 'System restart initiated...\n');
                // Show a message that the system will restart
                alert('System restart has been initiated. The system will restart shortly.');
            } else {
                setError(data.message || 'Failed to restart system');
            }
        } catch (err) {
            setError('Failed to restart system');
            console.error(err);
        } finally {
            setRestarting(false);
        }
    };

    const pollUpgradeStatus = async (jobId) => {
        try {
            const response = await fetch(`/api/updates/upgrade/${jobId}`);
            const data = await response.json();

            setTerminalOutput(data.output);

            if (data.completed) {
                setUpgradeJobId(null);
                setUpgradePolling(false);
                setUpgrading(false);

                if (data.success) {
                    await fetchStatus();
                    await fetchAvailableUpdates();
                    await fetchRebootStatus();
                    // Clear badge since upgrade completed successfully
                    clearContextBadge('updates');
                } else {
                    setError('System upgrade failed');
                }
            } else {
                // Continue polling
                setTimeout(() => pollUpgradeStatus(jobId), 2000); // Poll every 2 seconds
            }
        } catch (err) {
            console.error('Failed to poll upgrade status:', err);
            setUpgradePolling(false);
            setUpgrading(false);
            setError('Failed to monitor upgrade progress');
        }
    };

    const pollCheckStatus = async (jobId) => {
        try {
            const response = await fetch(`/api/updates/check/${jobId}`);
            const data = await response.json();

            setTerminalOutput(data.output);

            if (data.completed) {
                setCheckJobId(null);
                setCheckPolling(false);
                setChecking(false);

                if (data.success) {
                    await fetchStatus();
                    await fetchAvailableUpdates();
                    // Refresh badges in case the count changed
                    if (window.refreshBadges) {
                        window.refreshBadges();
                    }
                } else {
                    setError('Update check failed');
                }
            } else {
                // Continue polling
                setTimeout(() => pollCheckStatus(jobId), 1000); // Poll every 1 second for check (faster)
            }
        } catch (err) {
            console.error('Failed to poll check status:', err);
            setCheckPolling(false);
            setChecking(false);
            setError('Failed to monitor update check progress');
        }
    };

    const handleUpgrade = async () => {
        const confirmed = await confirmUpgrade({
            title: 'Upgrade System',
            message: 'Are you sure you want to upgrade the system? This may take several minutes and could require a restart.',
            confirmLabel: 'Upgrade',
            color: 'green',
        });
        if (!confirmed) {
            return;
        }

        setUpgrading(true);
        setError(null);
        setTerminalOutput('Starting system upgrade...\n');

        try {
            const response = await fetch('/api/updates/upgrade', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (response.ok) {
                setUpgradeJobId(data.job_id);
                setUpgradePolling(true);
                pollUpgradeStatus(data.job_id);
            } else {
                setError(data.message || 'Failed to start system upgrade');
                setTerminalOutput(prev => prev + `Error: ${data.message || 'Unknown error occurred'}\n`);
                setUpgrading(false);
            }
        } catch (err) {
            setError('Failed to start system upgrade');
            setTerminalOutput(prev => prev + `Error: ${err.message}\n`);
            setUpgrading(false);
            console.error(err);
        }
    };

    const formatLastUpdate = (timestamp) => {
        if (!timestamp) return 'Never';

        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={3} c="white">System Updates</Title>
                    <Text size="sm" c="dimmed">Manage system package updates</Text>
                </div>
                <Group gap="sm">
                    <Button
                        variant="light"
                        color="blue"
                        leftSection={<IconRefresh size={18} />}
                        onClick={handleCheckUpdates}
                        loading={checking || checkPolling}
                        disabled={checking || checkPolling || upgrading || upgradePolling}
                    >
                        {checkPolling ? 'Checking...' : 'Check for Updates'}
                    </Button>
                    <Button
                        variant="filled"
                        color="green"
                        leftSection={<IconArrowUp size={18} />}
                        onClick={handleUpgrade}
                        loading={upgrading || upgradePolling}
                        disabled={(!status?.updates_available && availableUpdates.length === 0) || checking || checkPolling || upgrading || upgradePolling}
                    >
                        {upgradePolling ? 'Upgrading...' : 'Upgrade System'}
                    </Button>
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

            {/* Status Cards */}
            <Group mb="lg" grow>
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group justify="space-between" align="flex-start">
                        <div>
                            <Group gap="xs" mb="xs">
                                <IconClock size={20} color={theme.colors.blue[4]} />
                                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
                                    Last Update Check
                                </Text>
                            </Group>
                            <Text size="lg" c="white" fw={600}>
                                {formatLastUpdate(lastUpdateTime)}
                            </Text>
                        </div>
                    </Group>
                </Box>

                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group justify="space-between" align="flex-start">
                        <div>
                            <Group gap="xs" mb="xs">
                                <IconPackage size={20} color={theme.colors.yellow[4]} />
                                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
                                    Available Updates
                                </Text>
                            </Group>
                            <Text size="lg" c="white" fw={600}>
                                {status?.available_count || availableUpdates.length || 0}
                            </Text>
                        </div>
                        {status?.updates_available && (
                            <Badge color="yellow" variant="light">
                                Updates Available
                            </Badge>
                        )}
                    </Group>
                </Box>
            </Group>

            {/* Terminal Output */}
            <Box mb="lg">
                <Title order={4} c="white" mb="md">
                    <Group gap="xs">
                        <IconTerminal size={20} />
                        Terminal Output
                    </Group>
                </Title>
                <ScrollArea
                    ref={terminalRef}
                    style={{
                        backgroundColor: theme.colors.dark[8],
                        borderRadius: '8px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                        padding: '12px',
                        height: '300px',
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'monospace',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            whiteSpace: 'pre-wrap',
                            color: theme.colors.gray[2],
                        }}
                    >
                        {terminalOutput || 'Ready to check for updates or perform system upgrade...'}
                    </Text>
                </ScrollArea>
            </Box>

            {/* Available Updates List */}
            {availableUpdates.length > 0 && (
                <Box mb="lg">
                    <Title order={4} c="white" mb="md">Available Updates</Title>
                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                            maxHeight: '300px',
                            overflow: 'auto',
                        }}
                    >
                        {availableUpdates.map((update, index) => (
                            <Box key={index} p="md">
                                <Group justify="space-between" align="center">
                                    <div>
                                        <Text c="white" fw={500}>{update.name}</Text>
                                        <Text size="sm" c="dimmed">
                                            {update.current_version} → {update.new_version}
                                        </Text>
                                    </div>
                                </Group>
                                {index < availableUpdates.length - 1 && <Divider mt="md" />}
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Reboot Required Alert */}
            {rebootRequired && (
                <Alert
                    color="orange"
                    variant="light"
                    mb="lg"
                    icon={<IconRefresh size={20} />}
                >
                    <Group justify="space-between" align="center">
                        <div>
                            <Text fw={600}>System Restart Required</Text>
                            <Text size="sm">
                                Recent updates require a system restart to take effect.
                            </Text>
                        </div>
                        <Button
                            color="orange"
                            variant="filled"
                            leftSection={<IconRefresh size={16} />}
                            onClick={handleRestart}
                            loading={restarting}
                        >
                            Restart Now
                        </Button>
                    </Group>
                </Alert>
            )}

            {restartConfirmModal}
            {upgradeConfirmModal}
        </Box>
    );
}