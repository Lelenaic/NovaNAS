import { useEffect, useState } from 'react';
import { Box, Title, Text, SimpleGrid, Card, Badge, Group, Stack, Loader, Alert } from '@mantine/core';
import { IconBrandDocker, IconBox, IconPhoto, IconHierarchy2, IconNetwork, IconAlertCircle } from '@tabler/icons-react';

export function DashboardTab() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dockerInfo, setDockerInfo] = useState(null);
    const [stats, setStats] = useState({
        containers: 0,
        runningContainers: 0,
        images: 0,
        volumes: 0,
        networks: 0,
    });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch docker info, containers, images, volumes, networks in parallel
            const [infoRes, containersRes, imagesRes, volumesRes, networksRes] = await Promise.all([
                fetch('/api/docker/info'),
                fetch('/api/docker/containers?all=true'),
                fetch('/api/docker/images'),
                fetch('/api/docker/volumes'),
                fetch('/api/docker/networks'),
            ]);

            const infoData = infoRes.ok ? await infoRes.json() : null;
            const containersData = containersRes.ok ? await containersRes.json() : [];
            const imagesData = imagesRes.ok ? await imagesRes.json() : [];
            const volumesData = volumesRes.ok ? await volumesRes.json() : { Volumes: [] };
            const networksData = networksRes.ok ? await networksRes.json() : [];

            setDockerInfo(infoData);

            const runningContainers = containersData.filter((c) => c.State === 'running').length;

            setStats({
                containers: containersData.length,
                runningContainers,
                images: imagesData.length,
                volumes: volumesData.Volumes?.length || 0,
                networks: networksData.length,
            });
        } catch (err) {
            setError('Failed to connect to Docker. Make sure Docker is installed and running.');
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

    if (error) {
        return (
            <Alert icon={<IconAlertCircle size={16} />} title="Docker Error" color="red" variant="light">
                {error}
            </Alert>
        );
    }

    return (
        <Stack gap="lg">
            <Box>
                <Title order={3} mb="xs">Docker Overview</Title>
                <Text c="dimmed" size="sm">
                    Manage your Docker containers, images, volumes, and networks
                </Text>
            </Box>

            {dockerInfo && (
                <Card padding="sm" radius="md" withBorder>
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="dimmed">Docker Version</Text>
                            <Text fw={600}>{dockerInfo.ServerVersion}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">OS</Text>
                            <Text fw={600}>{dockerInfo.OperatingSystem}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">Kernel</Text>
                            <Text fw={600}>{dockerInfo.KernelVersion}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">CPUs</Text>
                            <Text fw={600}>{dockerInfo.NCPU}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed">Memory</Text>
                            <Text fw={600}>{(dockerInfo.MemTotal / 1024 / 1024 / 1024).toFixed(1)} GB</Text>
                        </Box>
                    </Group>
                </Card>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
                <StatCard
                    icon={<IconBrandDocker size={24} />}
                    label="Total Containers"
                    value={stats.containers}
                    color="blue"
                />
                <StatCard
                    icon={<IconBox size={24} />}
                    label="Running"
                    value={stats.runningContainers}
                    color="green"
                />
                <StatCard
                    icon={<IconPhoto size={24} />}
                    label="Images"
                    value={stats.images}
                    color="violet"
                />
                <StatCard
                    icon={<IconHierarchy2 size={24} />}
                    label="Volumes"
                    value={stats.volumes}
                    color="orange"
                />
                <StatCard
                    icon={<IconNetwork size={24} />}
                    label="Networks"
                    value={stats.networks}
                    color="cyan"
                />
            </SimpleGrid>

            <Card padding="md" radius="md" withBorder>
                <Title order={5} mb="md">Quick Actions</Title>
                <Text c="dimmed" size="sm">
                    Use the tabs on the left to manage your Docker resources.
                </Text>
            </Card>
        </Stack>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <Card padding="md" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
                <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        {label}
                    </Text>
                    <Text size="xl" fw={700} mt="xs">
                        {value}
                    </Text>
                </Box>
                <Box
                    style={{
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: `${color}20`,
                        color: color,
                    }}
                >
                    {icon}
                </Box>
            </Group>
        </Card>
    );
}
