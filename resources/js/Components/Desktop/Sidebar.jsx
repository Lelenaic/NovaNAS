import { useState, useEffect } from 'react';
import { Box, Text, Stack, Skeleton, useMantineTheme, Progress, Group, Collapse, UnstyledButton } from '@mantine/core';
import { IconClock, IconCpu, IconDeviceDesktop, IconChartBar, IconChevronDown, IconChevronRight, IconDeviceTv, IconDisc, IconCopy, IconCheck } from '@tabler/icons-react';

// Custom hook to fetch system info - shared by both widgets
function useSystemInfo() {
    const [systemInfo, setSystemInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let timeoutId;

        const fetchSystemInfo = async () => {
            try {
                const response = await fetch('/api/system/info');
                const data = await response.json();
                setSystemInfo(data);
            } catch (error) {
                console.error('Failed to fetch system info:', error);
            } finally {
                setLoading(false);
            }
            // Schedule next fetch after 5 seconds
            timeoutId = setTimeout(fetchSystemInfo, 5000);
        };

        fetchSystemInfo();

        return () => clearTimeout(timeoutId);
    }, []);

    return { systemInfo, loading };
}

export function DateTimeWidget({ systemInfo, loading }) {
    const theme = useMantineTheme();

    const formatTime = (datetime) => {
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const formatDate = (datetime) => {
        const date = new Date(datetime);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <Box
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '18px',
                border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
        >
            <Stack gap="xs">
                <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconClock size={16} color={theme.colors.blue[5]} />
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        System Time
                    </Text>
                </Box>

                {loading ? (
                    <>
                        <Skeleton height={32} width="80%" />
                        <Skeleton height={16} width="60%" />
                    </>
                ) : systemInfo ? (
                    <>
                        <Text size="xl" fw={700} c="white">
                            {formatTime(systemInfo.datetime)}
                        </Text>
                        <Text size="sm" c="dimmed">
                            {formatDate(systemInfo.datetime)}
                        </Text>
                        <Text size="xs" c="dimmed" mt={4}>
                            {systemInfo.timezone}
                        </Text>
                    </>
                ) : (
                    <Text c="dimmed">Unable to load time</Text>
                )}
            </Stack>
        </Box>
    );
}

// Helper function to format bytes to human readable format
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function GaugeWidget({ icon: Icon, label, value, maxValue = 100, color = 'blue', supplementaryText }) {
    const theme = useMantineTheme();
    const percentage = Math.min((value / maxValue) * 100, 100);

    return (
        <Box>
            <Group gap="xs" mb={4}>
                <Icon size={14} color={theme.colors[color][5]} />
                <Text size="xs" c="dimmed">{label}</Text>
            </Group>
            <Progress
                value={percentage}
                color={color}
                size="sm"
                radius="xl"
                style={{ marginBottom: '2px' }}
            />
            {supplementaryText ? (
                <Group justify="space-between" align="center">
                    <Text size="xs" c="dimmed">{supplementaryText}</Text>
                    <Text size="xs" c="white">{percentage.toFixed(1)}%</Text>
                </Group>
            ) : (
                <Text size="xs" c="white" ta="right">{percentage.toFixed(1)}%</Text>
            )}
        </Box>
    );
}

export function SystemResourcesWidget({ systemInfo, loading }) {
    const theme = useMantineTheme();

    const getCpuColor = (percentage) => {
        if (percentage > 80) return 'red';
        if (percentage > 60) return 'orange';
        return 'blue';
    };

    const getMemoryColor = (percentage) => {
        if (percentage > 80) return 'red';
        if (percentage > 60) return 'orange';
        return 'teal';
    };

    const getTemperatureColor = (temp) => {
        if (temp > 80) return 'red';
        if (temp > 60) return 'orange';
        return 'green';
    };

    return (
        <Box
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '18px',
                border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
        >
            <Stack gap="sm">
                <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconChartBar size={16} color={theme.colors.blue[5]} />
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        System Resources
                    </Text>
                </Box>

                {loading ? (
                    <>
                        <Skeleton height={50} />
                        <Skeleton height={50} />
                        <Skeleton height={30} />
                    </>
                ) : systemInfo ? (
                    <>
                        {systemInfo.cpu_usage && (
                            <>
                                <GaugeWidget
                                    icon={IconCpu}
                                    label="CPU"
                                    value={systemInfo.cpu_usage.percentage}
                                    color={getCpuColor(systemInfo.cpu_usage.percentage)}
                                />
                                {systemInfo.cpu_usage.temperature !== null && (
                                    <Group justify="space-between" mt={4}>
                                        <Text size="xs" c="dimmed">Temperature</Text>
                                        <Text size="xs" c={getTemperatureColor(systemInfo.cpu_usage.temperature)} fw={500}>
                                            {systemInfo.cpu_usage.temperature}°C
                                        </Text>
                                    </Group>
                                )}
                            </>
                        )}
                        {systemInfo.memory_usage && (
                            <GaugeWidget
                                icon={IconDeviceDesktop}
                                label="Memory"
                                value={systemInfo.memory_usage.percentage}
                                color={getMemoryColor(systemInfo.memory_usage.percentage)}
                                supplementaryText={`${formatBytes(systemInfo.memory_usage.used)} / ${formatBytes(systemInfo.memory_usage.total)}`}
                            />
                        )}
                        {systemInfo.load_average && (
                            <Box mt={4}>
                                <Text size="xs" c="dimmed" mb={4}>Load Average</Text>
                                <Group gap="md">
                                    <Text size="xs" c="white">1m: {systemInfo.load_average['1min']?.toFixed(2)}</Text>
                                    <Text size="xs" c="dimmed">5m: {systemInfo.load_average['5min']?.toFixed(2)}</Text>
                                    <Text size="xs" c="dimmed">15m: {systemInfo.load_average['15min']?.toFixed(2)}</Text>
                                </Group>
                            </Box>
                        )}
                    </>
                ) : (
                    <Text c="dimmed" size="sm">Unable to load resources</Text>
                )}
            </Stack>
        </Box>
    );
}

function StoragePoolsWidget({ systemInfo, loading }) {
    const theme = useMantineTheme();
    const [expanded, setExpanded] = useState(true);
    const [copiedIndex, setCopiedIndex] = useState(null);

    const getPoolColor = (percentage) => {
        if (percentage > 90) return 'red';
        if (percentage > 70) return 'orange';
        return 'blue';
    };

    const handleCopy = async (text, index) => {
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers or non-secure contexts
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const pools = systemInfo?.storage_pools || [];
    const hasMultiplePools = pools.length > 1;

    return (
        <Box
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '18px',
                border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
        >
            <Stack gap="sm">
                <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconDisc size={16} color={theme.colors.blue[5]} />
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        Storage
                    </Text>
                </Box>

                {loading ? (
                    <Skeleton height={60} />
                ) : pools.length > 0 ? (
                    <>
                        {hasMultiplePools && (
                            <UnstyledButton
                                onClick={() => setExpanded(!expanded)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}
                            >
                                {expanded ? (
                                    <IconChevronDown size={14} color={theme.colors.gray[5]} />
                                ) : (
                                    <IconChevronRight size={14} color={theme.colors.gray[5]} />
                                )}
                                <Text size="xs" c="dimmed">
                                    {pools.length} Volume{pools.length > 1 ? 's' : ''}
                                </Text>
                            </UnstyledButton>
                        )}
                        <Collapse in={expanded || !hasMultiplePools}>
                            <Stack gap="md">
                                {pools.map((pool, index) => (
                                    <Box key={index}>
                                        <Group gap="xs" mb={4}>
                                            <Text size="xs" c="white" fw={500}>
                                                {pool.name}
                                            </Text>
                                            {pool.type && (
                                                <Text
                                                    size="xs"
                                                    c={pool.type === 'zfs' ? 'blue' : 'orange'}
                                                    fw={600}
                                                    style={{
                                                        backgroundColor: pool.type === 'zfs'
                                                            ? 'rgba(34, 139, 230, 0.15)'
                                                            : 'rgba(253, 126, 20, 0.15)',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                    }}
                                                >
                                                    {pool.type.toUpperCase()}
                                                </Text>
                                            )}
                                            {pool.isSystem && (
                                                <Text
                                                    size="xs"
                                                    c="teal"
                                                    fw={600}
                                                    style={{
                                                        backgroundColor: 'rgba(32, 201, 151, 0.15)',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                    }}
                                                >
                                                    SYSTEM
                                                </Text>
                                            )}
                                        </Group>
                                        {pool.mountpoint && (
                                            <Group gap="xs" mb={4}>
                                                <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                                                    {pool.mountpoint}
                                                </Text>
                                                <UnstyledButton
                                                    onClick={() => handleCopy(pool.mountpoint, index)}
                                                    style={{ display: 'flex', alignItems: 'center' }}
                                                >
                                                    {copiedIndex === index ? (
                                                        <IconCheck size={14} color={theme.colors.green[5]} />
                                                    ) : (
                                                        <IconCopy size={14} color={theme.colors.gray[5]} />
                                                    )}
                                                </UnstyledButton>
                                            </Group>
                                        )}
                                        <GaugeWidget
                                            icon={IconDisc}
                                            label="Usage"
                                            value={pool.percentage}
                                            color={getPoolColor(pool.percentage)}
                                            supplementaryText={`${formatBytes(pool.size - pool.free)} / ${formatBytes(pool.size)}`}
                                        />
                                    </Box>
                                ))}
                            </Stack>
                        </Collapse>
                    </>
                ) : (
                    <Text c="dimmed" size="sm">No storage volumes detected</Text>
                )}
            </Stack>
        </Box>
    );
}

function GPUsWidget({ systemInfo, loading }) {
    const theme = useMantineTheme();
    const [expanded, setExpanded] = useState(true);

    const getGpuColor = (percentage) => {
        if (percentage > 80) return 'red';
        if (percentage > 60) return 'orange';
        return 'grape';
    };

    const getUtilizationColor = (percentage) => {
        if (percentage > 80) return 'red';
        if (percentage > 60) return 'orange';
        return 'cyan';
    };

    const getTemperatureColor = (temp) => {
        if (temp > 80) return 'red';
        if (temp > 60) return 'orange';
        return 'green';
    };

    const gpus = systemInfo?.gpus || [];
    const hasMultipleGpus = gpus.length > 1;

    return (
        <Box
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '18px',
                border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
        >
            <Stack gap="sm">
                <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconDeviceTv size={16} color={theme.colors.grape[5]} />
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        GPUs
                    </Text>
                </Box>

                {loading ? (
                    <Skeleton height={60} />
                ) : gpus.length > 0 ? (
                    <>
                        {hasMultipleGpus && (
                            <UnstyledButton
                                onClick={() => setExpanded(!expanded)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}
                            >
                                {expanded ? (
                                    <IconChevronDown size={14} color={theme.colors.gray[5]} />
                                ) : (
                                    <IconChevronRight size={14} color={theme.colors.gray[5]} />
                                )}
                                <Text size="xs" c="dimmed">
                                    {gpus.length} GPU{gpus.length > 1 ? 's' : ''}
                                </Text>
                            </UnstyledButton>
                        )}
                        <Collapse in={expanded || !hasMultipleGpus}>
                            <Stack gap="md">
                                {gpus.map((gpu, index) => (
                                    <Box key={index}>
                                        <Text size="xs" c="white" fw={500} mb={4}>
                                            {gpu.name}
                                        </Text>
                                        <Box mt={8}>
                                            <GaugeWidget
                                                icon={IconCpu}
                                                label="GPU"
                                                value={gpu.utilization_gpu}
                                                color={getUtilizationColor(gpu.utilization_gpu)}
                                            />
                                        </Box>
                                        <GaugeWidget
                                            icon={IconDeviceDesktop}
                                            label="VRAM"
                                            value={gpu.memory_percentage}
                                            color={getGpuColor(gpu.memory_percentage)}
                                            supplementaryText={`${formatBytes(gpu.memory_used)} / ${formatBytes(gpu.memory_total)}`}
                                        />
                                        {gpu.temperature !== null && (
                                            <Group justify="space-between" mt={4}>
                                                <Text size="xs" c="dimmed">Temperature</Text>
                                                <Text size="xs" c={getTemperatureColor(gpu.temperature)} fw={500}>
                                                    {gpu.temperature}°C
                                                </Text>
                                            </Group>
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Collapse>
                    </>
                ) : (
                    <Text c="dimmed" size="sm">No GPUs detected</Text>
                )}
            </Stack>
        </Box>
    );
}

export function Sidebar() {
    const theme = useMantineTheme();
    const { systemInfo, loading } = useSystemInfo();

    return (
        <Box
            style={{
                width: '280px',
                height: '100%',
                backgroundColor: 'rgba(22, 22, 28, 0.65)',
                backdropFilter: 'blur(20px) saturate(150%)',
                WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                borderRadius: '16px',
                padding: '16px',
                overflowY: 'auto',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
            }}
        >
            <Stack gap="md">
                {/* DateTime Widget */}
                <DateTimeWidget systemInfo={systemInfo} loading={loading} />

                {/* System Resources Widget */}
                <SystemResourcesWidget systemInfo={systemInfo} loading={loading} />

                {/* Storage Pools Widget */}
                <StoragePoolsWidget systemInfo={systemInfo} loading={loading} />

                {/* GPUs Widget */}
                <GPUsWidget systemInfo={systemInfo} loading={loading} />
            </Stack>
        </Box>
    );
}
