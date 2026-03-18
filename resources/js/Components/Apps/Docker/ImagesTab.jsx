import { useEffect, useState } from 'react';
import { Box, Title, Text, Card, Badge, Group, ActionIcon, Stack, Loader, Button, Modal, TextInput, Alert } from '@mantine/core';
import { IconTrash, IconPhoto, IconDownload, IconRefresh, IconAlertCircle } from '@tabler/icons-react';

export function ImagesTab() {
    const [loading, setLoading] = useState(true);
    const [images, setImages] = useState([]);
    const [pullModal, setPullModal] = useState({ open: false });
    const [deleteModal, setDeleteModal] = useState({ open: false, image: null });
    const [pullLoading, setPullLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/docker/images');
            if (response.ok) {
                const data = await response.json();
                setImages(data);
            }
        } catch (err) {
            console.error('Failed to fetch images:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePull = async () => {
        const imageName = pullModal.imageName?.trim();
        if (!imageName) return;

        setPullLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/docker/images/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageName, tag: pullModal.tag || 'latest' }),
            });
            const data = await response.json();
            if (response.ok) {
                fetchImages();
                setPullModal({ open: false });
            } else {
                setError(data.details || data.error || 'Failed to pull image');
            }
        } catch (err) {
            setError('Failed to pull image');
            console.error('Failed to pull image:', err);
        } finally {
            setPullLoading(false);
        }
    };

    const handleDelete = async () => {
        const { image } = deleteModal;
        if (!image) return;

        const imageId = image.ID || '';
        setActionLoading((prev) => ({ ...prev, [imageId]: 'deleting' }));
        setError(null);
        try {
            const response = await fetch(`/api/docker/images/${imageId}?force=true`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (response.ok) {
                fetchImages();
                setDeleteModal({ open: false, image: null });
            } else {
                setError(data.details || data.error || 'Failed to delete image');
            }
        } catch (err) {
            setError('Failed to delete image');
            console.error('Failed to delete image:', err);
        } finally {
            setActionLoading((prev) => ({ ...prev, [imageId]: null }));
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return `${bytes.toFixed(2)} ${units[i]}`;
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Box>
                    <Title order={3}>Images</Title>
                    <Text c="dimmed" size="sm">
                        Manage your Docker images
                    </Text>
                </Box>
                <Group>
                    <Button
                        variant="light"
                        leftSection={<IconDownload size={16} />}
                        onClick={() => setPullModal({ open: true })}
                    >
                        Pull Image
                    </Button>
                    <Button
                        variant="light"
                        leftSection={<IconRefresh size={16} />}
                        onClick={fetchImages}
                    >
                        Refresh
                    </Button>
                </Group>
            </Group>

            {images.length === 0 ? (
                <Card padding="lg" radius="md" withBorder>
                    <Box style={{ textAlign: 'center', padding: '40px' }}>
                        <IconPhoto size={48} style={{ opacity: 0.3 }} />
                        <Text mt="md" c="dimmed">No images found</Text>
                    </Box>
                </Card>
            ) : (
                images.map((image) => {
                    const imageId = image.ID || '';
                    const size = image.Size || '0';
                    const repository = image.Repository || '<none>';
                    const tag = image.Tag || '<none>';

                    return (
                        <Card key={image.ID} padding="md" radius="md" withBorder>
                            <Group justify="space-between">
                                <Box>
                                    <Group gap="sm" mb={4}>
                                        <Badge variant="light" color="blue">
                                            {repository}:{tag}
                                        </Badge>
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                        ID: {imageId.substring(0, 12)}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        Size: {size} | Created: {image.CreatedAt}
                                    </Text>
                                </Box>
                                <ActionIcon
                                    variant="light"
                                    color="red"
                                    onClick={() => setDeleteModal({ open: true, image })}
                                    loading={actionLoading[imageId] === 'deleting'}
                                    title="Delete image"
                                >
                                    <IconTrash size={16} />
                                </ActionIcon>
                            </Group>
                        </Card>
                    );
                })
            )}

            <Modal
                opened={pullModal.open}
                onClose={() => { setPullModal({ open: false }); setError(null); }}
                title="Pull Image"
            >
                <Stack>
                    {error && (
                        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                            {error}
                        </Alert>
                    )}
                    <TextInput
                        label="Image name"
                        placeholder="e.g., nginx, ubuntu, redis"
                        value={pullModal.imageName || ''}
                        onChange={(e) => setPullModal({ ...pullModal, imageName: e.target.value })}
                    />
                    <TextInput
                        label="Tag"
                        placeholder="latest"
                        value={pullModal.tag || ''}
                        onChange={(e) => setPullModal({ ...pullModal, tag: e.target.value })}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setPullModal({ open: false })}>
                            Cancel
                        </Button>
                        <Button onClick={handlePull} loading={pullLoading}>
                            Pull
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <Modal
                opened={deleteModal.open}
                onClose={() => { setDeleteModal({ open: false, image: null }); setError(null); }}
                title="Delete Image"
            >
                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                        {error}
                    </Alert>
                )}
                <Text>
                    Are you sure you want to delete this image? This action cannot be undone.
                </Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setDeleteModal({ open: false, image: null })}>
                        Cancel
                    </Button>
                    <Button color="red" onClick={handleDelete}>
                        Delete
                    </Button>
                </Group>
            </Modal>
        </Stack>
    );
}
