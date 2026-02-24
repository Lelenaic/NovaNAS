import { useState, useEffect } from 'react';
import { Box, Text, Stack, Skeleton, useMantineTheme, Progress, Group } from '@mantine/core';
import { IconClock, IconCpu, IconDeviceDesktop, IconChartBar } from '@tabler/icons-react';

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
                backgroundColor: theme.colors.dark[7],
                borderRadius: '8px',
                padding: '16px',
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

    return (
        <Box
            style={{
                backgroundColor: theme.colors.dark[7],
                borderRadius: '8px',
                padding: '16px',
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
                            <GaugeWidget
                                icon={IconCpu}
                                label="CPU"
                                value={systemInfo.cpu_usage.percentage}
                                color={getCpuColor(systemInfo.cpu_usage.percentage)}
                            />
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

export function Sidebar() {
    const theme = useMantineTheme();
    const { systemInfo, loading } = useSystemInfo();

    return (
        <Box
            style={{
                width: '280px',
                height: '100%',
                backgroundColor: theme.colors.dark[8],
                padding: '16px',
                overflowY: 'auto',
            }}
        >
            <Stack gap="md">
                {/* DateTime Widget */}
                <DateTimeWidget systemInfo={systemInfo} loading={loading} />

                {/* System Resources Widget */}
                <SystemResourcesWidget systemInfo={systemInfo} loading={loading} />
            </Stack>
        </Box>
    );
}
