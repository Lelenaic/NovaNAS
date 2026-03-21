import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Badge,
    Loader,
    Alert,
    Progress,
    Grid,
    Card,
    ThemeIcon,
    ActionIcon,
    useMantineTheme,
} from '@mantine/core';
import {
    IconAlertCircle,
    IconCpu,
    IconThermometer,
    IconBolt,
    IconDeviceDesktop,
    IconRefresh,
} from '@tabler/icons-react';

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatWatts(watts) {
    return `${watts.toFixed(1)} W`;
}

function getTemperatureColor(temp, theme) {
    if (temp < 50) return theme.colors.green[6];
    if (temp < 70) return theme.colors.yellow[6];
    return theme.colors.red[6];
}

function getUtilizationColor(util, theme) {
    if (util < 30) return theme.colors.green[6];
    if (util < 70) return theme.colors.blue[6];
    if (util < 90) return theme.colors.yellow[6];
    return theme.colors.red[6];
}

function MetricCard({ icon: Icon, label, value, color, theme }) {
    return (
        <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
                backgroundColor: theme.colors.dark[6],
                border: `1px solid ${theme.colors.dark[4]}`,
            }}
        >
            <Group justify="space-between" align="flex-start">
                <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        {label}
                    </Text>
                    <Text size="lg" fw={600} c="white" mt={4}>
                        {value}
                    </Text>
                </div>
                <ThemeIcon
                    variant="light"
                    color={color}
                    size="lg"
                    radius="md"
                >
                    <Icon size={18} />
                </ThemeIcon>
            </Group>
        </Card>
    );
}

function GPUCard({ gpu, providerName, theme }) {
    const memoryPercent = gpu.memory_total > 0
        ? (gpu.memory_used / gpu.memory_total) * 100
        : 0;

    return (
        <Card
            shadow="md"
            padding="lg"
            radius="md"
            style={{
                backgroundColor: theme.colors.dark[6],
                border: `1px solid ${theme.colors.dark[4]}`,
                marginBottom: '16px',
            }}
        >
            <Group justify="space-between" mb="md">
                <div>
                    <Group gap="sm" mb="xs">
                        <IconCpu size={24} color={theme.colors.blue[5]} />
                        <Title order={4} c="white">{gpu.name}</Title>
                    </Group>
                    <Text size="sm" c="dimmed">
                        UUID: {gpu.uuid}
                    </Text>
                </div>
                <Badge color="blue" variant="light">
                    {providerName}
                </Badge>
            </Group>

            <Grid gutter="md">
                <Grid.Col span={3}>
                    <MetricCard
                        icon={IconDeviceDesktop}
                        label="Memory"
                        value={`${formatBytes(gpu.memory_used)} / ${formatBytes(gpu.memory_total)}`}
                        color="blue"
                        theme={theme}
                    />
                </Grid.Col>
                <Grid.Col span={3}>
                    <MetricCard
                        icon={IconCpu}
                        label="GPU Utilization"
                        value={`${gpu.utilization_gpu}%`}
                        color={getUtilizationColor(gpu.utilization_gpu, theme)}
                        theme={theme}
                    />
                </Grid.Col>
                <Grid.Col span={3}>
                    <MetricCard
                        icon={IconThermometer}
                        label="Temperature"
                        value={`${gpu.temperature}°C`}
                        color={getTemperatureColor(gpu.temperature, theme)}
                        theme={theme}
                    />
                </Grid.Col>
                <Grid.Col span={3}>
                    <MetricCard
                        icon={IconBolt}
                        label="Power"
                        value={`${formatWatts(gpu.power_draw)} / ${formatWatts(gpu.power_limit)}`}
                        color="orange"
                        theme={theme}
                    />
                </Grid.Col>
            </Grid>

            <Box mt="md">
                <Text size="sm" fw={500} c="dimmed" mb="xs">
                    Memory Usage
                </Text>
                <Progress
                    value={memoryPercent}
                    color={getUtilizationColor(memoryPercent, theme)}
                    size="md"
                    radius="md"
                />
            </Box>

            <Grid gutter="md" mt="md">
                <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Driver</Text>
                    <Text size="sm" c="white">{gpu.driver || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">CUDA Version</Text>
                    <Text size="sm" c="white">{gpu.cuda_version || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">VBIOS</Text>
                    <Text size="sm" c="white">{gpu.vbios_version || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Clock (SM)</Text>
                    <Text size="sm" c="white">{gpu.clock_sm ? `${gpu.clock_sm} MHz` : 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Clock (Memory)</Text>
                    <Text size="sm" c="white">{gpu.clock_memory ? `${gpu.clock_memory} MHz` : 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Persistence Mode</Text>
                    {gpu.persistence_mode !== null ? (
                        <Badge
                            size="sm"
                            color={gpu.persistence_mode ? 'green' : 'gray'}
                            variant="light"
                        >
                            {gpu.persistence_mode ? 'Enabled' : 'Disabled'}
                        </Badge>
                    ) : (
                        <Text size="sm" c="dimmed">N/A</Text>
                    )}
                </Grid.Col>
            </Grid>
        </Card>
    );
}

export function GPUTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [gpus, setGpus] = useState({});
    const [hasGpu, setHasGpu] = useState(false);

    useEffect(() => {
        fetchGPUs();
    }, []);

    const fetchGPUs = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/gpus');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load GPUs');
            }

            setGpus(data.gpus || {});
            setHasGpu(data.has_gpu || false);
        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    const totalGpus = Object.values(gpus).reduce((acc, provider) => {
        return acc + (provider.gpus?.length || 0);
    }, 0);

    return (
        <Box>

            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={3} c="white">GPUs</Title>
                    <Text size="sm" c="dimmed">Manage and monitor graphics cards</Text>
                </div>
                <Group gap="sm">
                    <ActionIcon
                        variant="subtle"
                        color="blue"
                        size="lg"
                        radius="md"
                        onClick={fetchGPUs}
                        loading={loading}
                    >
                        <IconRefresh size={20} />
                    </ActionIcon>
                    <IconCpu size={32} color={theme.colors.blue[5]} />
                </Group>
            </Group>

            <Alert
                color="blue"
                variant="light"
                mb="md"
                icon={<IconCpu size={16} />}
            >
                <Text size="sm">
                    <strong>NVIDIA GPUs only</strong> - AMD and Intel GPU support coming in future updates.
                </Text>
            </Alert>

            {error && (
                <Alert
                    color="red"
                    variant="light"
                    mb="md"
                    onClose={() => setError(null)}
                    withCloseButton
                    icon={<IconAlertCircle size={16} />}
                >
                    {error}
                </Alert>
            )}

            {!hasGpu && !error && (
                <Alert
                    color="yellow"
                    variant="light"
                    mb="md"
                    icon={<IconAlertCircle size={16} />}
                >
                    No GPUs detected on this system. Install NVIDIA driver and nvidia-smi to enable GPU monitoring.
                </Alert>
            )}

            {totalGpus > 0 && (
                <Group justify="space-between" mb="md">
                    <Text size="sm" c="dimmed">
                        Found {totalGpus} GPU{totalGpus !== 1 ? 's' : ''}
                    </Text>
                    <Badge color="green" variant="light" leftSection={<IconCpu size={12} />}>
                        Driver Installed
                    </Badge>
                </Group>
            )}

            {Object.entries(gpus).map(([providerName, providerData]) => (
                <Box key={providerName} mb="lg">
                    <Text size="sm" fw={600} c="dimmed" mb="sm" tt="uppercase">
                        {providerData.display_name}
                    </Text>
                    {providerData.gpus.map((gpu, index) => (
                        <GPUCard
                            key={`${providerName}-${gpu.index}`}
                            gpu={gpu}
                            providerName={providerData.display_name}
                            theme={theme}
                        />
                    ))}
                </Box>
            ))}
        </Box>
    );
}
