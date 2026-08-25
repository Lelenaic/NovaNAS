import { useState, useEffect } from 'react';
import { Box, Text, Stack, Skeleton, useMantineTheme, Progress, Group, Collapse, UnstyledButton, Badge, Drawer, Tooltip } from '@mantine/core';
import { IconCpu, IconDeviceDesktop, IconChartBar, IconChevronDown, IconChevronRight, IconDeviceTv, IconDisc, IconCopy, IconCheck, IconPlug } from '@tabler/icons-react';

// Singleton hook to fetch system info - shared by all components
const POLL_INTERVAL = 5000;
let systemInfoState = { data: null, loading: true, subscribers: new Set(), timeoutId: null, fetching: false };

function scheduleFetch() {
    if (systemInfoState.fetching || systemInfoState.subscribers.size === 0) return;
    systemInfoState.fetching = true;
    fetch('/api/system/info')
        .then(res => res.json())
        .then(data => {
            systemInfoState.data = data;
            systemInfoState.loading = false;
            systemInfoState.subscribers.forEach(fn => fn());
        })
        .catch(() => {
            systemInfoState.loading = false;
            systemInfoState.subscribers.forEach(fn => fn());
        })
        .finally(() => {
            systemInfoState.fetching = false;
            if (systemInfoState.subscribers.size > 0) {
                systemInfoState.timeoutId = setTimeout(scheduleFetch, POLL_INTERVAL);
            }
        });
}

export function useSystemInfo() {
    const [, setUpdate] = useState(0);

    useEffect(() => {
        const callback = () => setUpdate(n => n + 1);
        systemInfoState.subscribers.add(callback);

        // Start polling on first subscriber
        if (systemInfoState.subscribers.size === 1 && !systemInfoState.fetching) {
            scheduleFetch();
        }

        return () => {
            systemInfoState.subscribers.delete(callback);
            // Stop polling when no subscribers
            if (systemInfoState.subscribers.size === 0 && systemInfoState.timeoutId) {
                clearTimeout(systemInfoState.timeoutId);
                systemInfoState.timeoutId = null;
            }
        };
    }, []);

    return { systemInfo: systemInfoState.data, loading: systemInfoState.loading };
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

function MemoryGaugeWidget({ usage }) {
    const theme = useMantineTheme();
    const { total, used, cached, free } = usage;

    const pct = (value) => (total > 0 ? Math.min((value / total) * 100, 100) : 0);

    const usedPct = pct(used);
    const cachedPct = pct(cached);
    const freePct = Math.max(100 - usedPct - cachedPct, 0);

    const totalUsedPct = Math.min(usedPct + cachedPct, 100);
    const usedColor = getMemoryColor(totalUsedPct);
    const occupied = Math.min(used + cached, total);

    const segments = [
        { name: 'Used', value: used, percentage: usedPct, color: theme.colors[usedColor][6] },
        { name: 'Cached', value: cached, percentage: cachedPct, color: theme.colors.blue[6] },
        { name: 'Free', value: free, percentage: freePct, color: theme.colors.dark[4] },
    ].filter((segment) => segment.percentage > 0);

    const tooltipLabel = (segment) => (
        <Stack gap={2}>
            <Text size="xs" fw={600}>{segment.name}</Text>
            <Text size="xs" c="dimmed">
                {segment.percentage.toFixed(1)}% · {formatBytes(segment.value)}
            </Text>
        </Stack>
    );

    return (
        <Box>
            <Group gap="xs" mb={4}>
                <IconDeviceDesktop size={14} color={theme.colors[usedColor][5]} />
                <Text size="xs" c="dimmed">Memory</Text>
            </Group>
            <Box
                display="flex"
                style={{
                    height: 8,
                    borderRadius: 999,
                    overflow: 'hidden',
                    background: theme.colors.dark[4],
                    marginBottom: 2,
                }}
            >
                {segments.map((segment) => (
                    <Tooltip
                        key={segment.name}
                        label={tooltipLabel(segment)}
                        withArrow
                        position="top"
                        openDelay={0}
                    >
                        <Box
                            style={{
                                width: `${segment.percentage}%`,
                                height: '100%',
                                backgroundColor: segment.color,
                            }}
                        />
                    </Tooltip>
                ))}
            </Box>
            <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                    {formatBytes(occupied)} / {formatBytes(total)}
                </Text>
                <Text size="xs" c="white">{totalUsedPct.toFixed(1)}%</Text>
            </Group>
        </Box>
    );
}

function getCpuColor(percentage) {
    if (percentage > 80) return 'red';
    if (percentage > 60) return 'orange';
    return 'blue';
}

function getMemoryColor(percentage) {
    if (percentage > 80) return 'red';
    if (percentage > 60) return 'orange';
    return 'teal';
}

function getTemperatureColor(temp) {
    if (temp > 80) return 'red';
    if (temp > 60) return 'orange';
    return 'green';
}

export function SystemResourcesWidget({ systemInfo, loading }) {
    const theme = useMantineTheme();

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
                            <MemoryGaugeWidget usage={systemInfo.memory_usage} />
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
                        <Collapse expanded={expanded || !hasMultiplePools}>
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
                        <Collapse expanded={expanded || !hasMultipleGpus}>
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

function UpsWidget({ systemInfo, loading }) {
    const theme = useMantineTheme();

    const upsInfo = systemInfo?.ups;
    const isEnabled = upsInfo?.enabled;
    const status = upsInfo?.status;
    const isOnline = status?.['ups.status']?.includes('OL');
    const batteryCharge = status?.['battery.charge'] ? parseFloat(status['battery.charge']) : null;
    const inputVoltage = status?.['input.voltage'] ?? null;

    const getBatteryColor = (charge) => {
        if (charge > 50) return 'green';
        if (charge > 20) return 'yellow';
        return 'red';
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
                    <IconPlug size={16} color={theme.colors.blue[5]} />
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                        UPS
                    </Text>
                    {isEnabled && status && (
                        <Badge
                            color={isOnline ? 'green' : 'yellow'}
                            variant="light"
                            size="xs"
                            ml="auto"
                        >
                            {isOnline ? 'Online' : 'Battery'}
                        </Badge>
                    )}
                </Box>

                {loading ? (
                    <>
                        <Skeleton height={20} />
                        <Skeleton height={16} width="60%" />
                    </>
                ) : !isEnabled ? (
                    <Text c="dimmed" size="sm">NUT service not enabled</Text>
                ) : status && Object.keys(status).length > 0 ? (
                    <>
                        {batteryCharge !== null && (
                            <GaugeWidget
                                icon={IconPlug}
                                label="Battery"
                                value={batteryCharge}
                                color={getBatteryColor(batteryCharge)}
                            />
                        )}
                        <Group gap="md">
                            {inputVoltage && (
                                <Box>
                                    <Text size="xs" c="dimmed">Input</Text>
                                    <Text size="sm" c="white" fw={500}>{inputVoltage}V</Text>
                                </Box>
                            )}
                        </Group>
                    </>
                ) : (
                    <Text c="dimmed" size="sm">No UPS data</Text>
                )}
            </Stack>
        </Box>
    );
}

export function Sidebar({ opened, onClose, isMobile }) {
    const theme = useMantineTheme();
    const { systemInfo, loading } = useSystemInfo();

    const sidebarContent = (
        <Stack gap="md">
            {/* System Resources Widget */}
            <SystemResourcesWidget systemInfo={systemInfo} loading={loading} />

            {/* Storage Pools Widget */}
            <StoragePoolsWidget systemInfo={systemInfo} loading={loading} />

            {/* GPUs Widget */}
            <GPUsWidget systemInfo={systemInfo} loading={loading} />

            {/* UPS Widget */}
            <UpsWidget systemInfo={systemInfo} loading={loading} />
        </Stack>
    );

    // Mobile: render as a Mantine Drawer
    if (isMobile) {
        return (
            <Drawer
                opened={opened}
                onClose={onClose}
                position="left"
                size="300px"
                withCloseButton
                styles={{
                    body: {
                        padding: '16px',
                        backgroundColor: 'rgba(22, 22, 28, 0.95)',
                        backdropFilter: 'blur(20px) saturate(150%)',
                    },
                    header: {
                        backgroundColor: 'rgba(22, 22, 28, 0.95)',
                        backdropFilter: 'blur(20px) saturate(150%)',
                        padding: '12px 16px',
                    },
                    close: {
                        color: 'rgba(255, 255, 255, 0.7)',
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    },
                }}
            >
                {sidebarContent}
            </Drawer>
        );
    }

    // Desktop: render as fixed sidebar
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
                flexShrink: 0,
            }}
        >
            {sidebarContent}
        </Box>
    );
}
