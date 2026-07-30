import { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Text,
    TextInput,
    Card,
    Badge,
    Group,
    Stack,
    Loader,
    Alert,
    Image,
    ActionIcon,
    Tooltip,
    Select,
    Affix,
    Button,
} from '@mantine/core';
import {
    IconSearch,
    IconAlertCircle,
    IconDownload,
    IconInfoCircle,
    IconRefresh,
} from '@tabler/icons-react';
import { AppDetailModal } from './AppDetailModal';

export function StoreBrowser({ onInstallComplete }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [apps, setApps] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [search, setSearch] = useState('');
    const [selectedApp, setSelectedApp] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [storeId, setStoreId] = useState(null);

    const fetchApps = useCallback(async (category = null, searchTerm = null) => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (category) params.set('category', category);
            if (searchTerm) params.set('search', searchTerm);

            const response = await fetch(`/api/applications/casaos/apps?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch applications');

            const data = await response.json();
            setApps(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await fetch('/api/applications/casaos/categories');
            if (response.ok) {
                const data = await response.json();
                setCategories(data);
            }
        } catch {
            // Categories are optional
        }
    }, []);

    const fetchStores = useCallback(async () => {
        try {
            const response = await fetch('/api/applications/stores');
            if (response.ok) {
                const data = await response.json();
                if (data.length > 0) {
                    setStoreId(data[0].id);
                }
            }
        } catch {
            // Store info is informational
        }
    }, []);

    useEffect(() => {
        fetchStores();
        fetchCategories();
        fetchApps();
    }, [fetchStores, fetchCategories, fetchApps]);

    useEffect(() => {
        fetchApps(selectedCategory, search || null);
    }, [selectedCategory, search, fetchApps]);

    const handleAppClick = (app) => {
        setSelectedApp(app);
        setDetailModalOpen(true);
    };

    const handleInstallComplete = () => {
        fetchApps(selectedCategory, search || null);
        onInstallComplete?.();
    };

    const categoryOptions = [
        { value: '', label: 'All Categories' },
        ...categories.map((cat) => ({
            value: cat.id,
            label: cat.name,
        })),
    ];

    return (
        <Stack gap="md" h="100%">
            <Group justify="space-between" align="center">
                <Box>
                    <Text size="xl" fw={700} c="white">
                        App Store
                    </Text>
                    <Text size="sm" c="dimmed">
                        Browse and install applications
                    </Text>
                </Box>
                <Tooltip label="Refresh">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => fetchApps(selectedCategory, search || null)}
                    >
                        <IconRefresh size={18} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            <Group gap="md">
                <TextInput
                    placeholder="Search applications..."
                    leftSection={<IconSearch size={16} />}
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    style={{ flex: 1 }}
                    size="sm"
                />
                <Select
                    data={categoryOptions}
                    value={selectedCategory || ''}
                    onChange={(value) => setSelectedCategory(value || null)}
                    placeholder="Category"
                    size="sm"
                    style={{ width: 200 }}
                    searchable
                    clearable
                />
            </Group>

            {error && (
                <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" variant="light">
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <Loader size="lg" />
                </Box>
            ) : apps.length === 0 ? (
                <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <Text c="dimmed">No applications found</Text>
                </Box>
            ) : (
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {apps.map((app) => (
                        <Card
                            key={app.id}
                            padding="md"
                            style={{
                                cursor: 'pointer',
                                transition: 'border-color 0.15s ease',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                flex: '1 1 280px',
                                maxWidth: '400px',
                            }}
                            onClick={() => handleAppClick(app)}
                        >
                            <Group gap="md" align="flex-start">
                                {app.icon ? (
                                    <Image
                                        src={app.icon}
                                        w={48}
                                        h={48}
                                        radius="md"
                                        fit="contain"
                                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Cpath d='m9 12 2 2 4-4'/%3E%3C/svg%3E"
                                    />
                                ) : (
                                    <Box
                                        w={48}
                                        h={48}
                                        radius="md"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <IconInfoCircle size={24} color="gray" />
                                    </Box>
                                )}
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                    <Group gap="xs" justify="space-between" align="center">
                                        <Text size="sm" fw={600} c="white" truncate="end">
                                            {app.title}
                                        </Text>
                                        {app.installed && (
                                            <Badge size="xs" color="green" variant="light">
                                                Installed
                                            </Badge>
                                        )}
                                    </Group>
                                    <Text size="xs" c="dimmed" truncate="end" mt={2}>
                                        {app.tagline || 'No description'}
                                    </Text>
                                    <Group gap="xs" mt="xs">
                                        <Badge size="xs" variant="outline" color="gray">
                                            {app.category}
                                        </Badge>
                                        <Text size="xs" c="dimmed">
                                            v{app.version}
                                        </Text>
                                    </Group>
                                </Box>
                            </Group>
                        </Card>
                    ))}
                </Box>
            )}

            <AppDetailModal
                opened={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                app={selectedApp}
                storeProvider="casaos"
                onInstallComplete={handleInstallComplete}
            />
        </Stack>
    );
}
