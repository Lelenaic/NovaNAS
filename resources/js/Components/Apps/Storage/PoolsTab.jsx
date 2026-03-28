import { useEffect, useState } from 'react';
import { Box, Text, Badge, Group, LoadingOverlay, ThemeIcon, Progress, ActionIcon, Tooltip, Button, Modal, Alert, TextInput, Loader } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRefresh, IconStack2, IconCheckupList, IconAlertTriangle, IconCopy, IconCheck, IconDatabase, IconEngine, IconPlus, IconTrash, IconArrowBarDown, IconArrowBarUp } from '@tabler/icons-react';
import { useMantineTheme } from '@mantine/core';
import { CreatePoolWizard } from './CreatePoolWizard';
import { FileSelector } from '../../FileSelector';

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getHealthColor(health) {
    switch (health?.toUpperCase()) {
        case 'ONLINE':
            return 'green';
        case 'DEGRADED':
            return 'yellow';
        case 'FAULTED':
        case 'UNAVAIL':
            return 'red';
        case 'OFFLINE':
            return 'gray';
        case 'UNMOUNTED':
            return 'orange';
        default:
            return 'blue';
    }
}

function getFsLabel(type) {
    switch (type) {
        case 'zfs':
            return 'ZFS Pool';
        case 'ext4':
            return 'EXT4 Volume';
        default:
            return 'Storage Volume';
    }
}

function getFsIcon(type) {
    switch (type) {
        case 'zfs':
            return IconStack2;
        case 'ext4':
            return IconDatabase;
        default:
            return IconDatabase;
    }
}

function PoolCard({ pool, onMount, onUnmount, onDelete }) {
    const theme = useMantineTheme();
    const healthColor = getHealthColor(pool.health);
    const usedPercentage = pool.size > 0 ? Math.round((pool.allocated / pool.size) * 100) : 0;
    const [copied, setCopied] = useState(false);
    const FsIcon = getFsIcon(pool.type);

    const handleCopy = () => {
        if (!pool.mountpoint) return;

        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(pool.mountpoint);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
        }

        // Fallback for HTTP/non-secure contexts
        const textarea = document.createElement('textarea');
        textarea.value = pool.mountpoint;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
        document.body.removeChild(textarea);
    };

    return (
        <Box
            style={{
                backgroundColor: theme.colors.dark[6],
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${theme.colors.dark[4]}`,
                marginBottom: '12px',
            }}
        >
            {/* Header Row */}
            <Group justify="space-between" align="flex-start" mb="md">
                <Group gap="md">
                    <ThemeIcon
                        size={48}
                        radius="md"
                        variant="light"
                        color={healthColor}
                    >
                        <FsIcon size={24} />
                    </ThemeIcon>
                    <Box>
                        <Group gap="xs">
                            <Text size="lg" fw={700}>{pool.name}</Text>
                            {pool.isSystem && (
                                <Badge
                                    size="sm"
                                    color="green"
                                    variant="light"
                                    leftSection={<IconEngine size={12} />}
                                >
                                    System
                                </Badge>
                            )}
                        </Group>
                        <Text size="xs" c="dimmed">{getFsLabel(pool.type)}</Text>
                    </Box>
                </Group>
                <Badge
                    size="lg"
                    color={healthColor}
                    variant="light"
                    leftSection={
                        healthColor === 'green' ? <IconCheckupList size={14} /> :
                        healthColor === 'red' ? <IconAlertTriangle size={14} /> : null
                    }
                >
                    {pool.health || 'Unknown'}
                </Badge>
            </Group>

            {/* Usage Bar */}
            <Box mb="md">
                <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={500}>Usage</Text>
                    <Text size="xs" c="dimmed">
                        {formatBytes(pool.allocated)} / {formatBytes(pool.size)} ({usedPercentage}%)
                    </Text>
                </Group>
                <Progress
                    value={usedPercentage}
                    size="md"
                    color={usedPercentage > 80 ? 'red' : usedPercentage > 60 ? 'yellow' : 'blue'}
                />
            </Box>

            {/* Details Grid */}
            <Group gap="xl">
                <Box>
                    <Text size="xs" c="dimmed" mb={2}>Total Size</Text>
                    <Text size="sm" fw={600}>{formatBytes(pool.size)}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed" mb={2}>Used</Text>
                    <Text size="sm" fw={600}>{formatBytes(pool.allocated)}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed" mb={2}>Free</Text>
                    <Text size="sm" fw={600}>{formatBytes(pool.free)}</Text>
                </Box>
                <Box style={{ flex: 1 }}>
                    <Text size="xs" c="dimmed" mb={2}>Mount Point</Text>
                    <Group gap="xs">
                        <Text size="sm" fw={500} lineClamp={1}>
                            {pool.mountpoint || '-'}
                        </Text>
                        {pool.mountpoint && (
                            <Tooltip label={copied ? 'Copied!' : 'Copy path'}>
                                <ActionIcon
                                    variant="subtle"
                                    color={copied ? 'green' : 'gray'}
                                    size="sm"
                                    onClick={handleCopy}
                                >
                                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </Group>
                </Box>
            </Group>

            {/* Action Buttons */}
            {!pool.isSystem && (
                <Group justify="flex-end" mt="md" pt="sm" style={{ borderTop: `1px solid ${theme.colors.dark[4]}` }}>
                    {pool.mountpoint ? (
                        <Button
                            variant="light"
                            color="yellow"
                            size="xs"
                            leftSection={<IconArrowBarDown size={14} />}
                            onClick={() => onUnmount(pool)}
                        >
                            Unmount
                        </Button>
                    ) : (
                        <Button
                            variant="light"
                            color="green"
                            size="xs"
                            leftSection={<IconArrowBarUp size={14} />}
                            onClick={() => onMount(pool)}
                        >
                            Mount
                        </Button>
                    )}
                    <Button
                        variant="light"
                        color="red"
                        size="xs"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => onDelete(pool)}
                    >
                        Delete
                    </Button>
                </Group>
            )}
        </Box>
    );
}

export function PoolsTab() {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const theme = useMantineTheme();
    const [wizardOpened, { open: openWizard, close: closeWizard }] = useDisclosure(false);
    const [unmountModal, { open: openUnmountModal, close: closeUnmountModal }] = useDisclosure(false);
    const [deleteModal, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
    const [mountModal, { open: openMountModal, close: closeMountModal }] = useDisclosure(false);
    const [fileSelectorOpened, { open: openFileSelector, close: closeFileSelector }] = useDisclosure(false);
    const [selectedPool, setSelectedPool] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [mountPath, setMountPath] = useState('');
    const [mountEmptyError, setMountEmptyError] = useState('');
    const [mountCheckingEmpty, setMountCheckingEmpty] = useState(false);
    const [mountIsValid, setMountIsValid] = useState(false);

    const fetchPools = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/storage/pools', {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });
            const data = await response.json();
            setPools(data.pools || []);
        } catch (err) {
            setError('Failed to load storage pools');
            console.error('Error fetching pools:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPools();
    }, []);

    const handleUnmountClick = (pool) => {
        setSelectedPool(pool);
        openUnmountModal();
    };

    const handleDeleteClick = (pool) => {
        setSelectedPool(pool);
        openDeleteModal();
    };

    const handleMountClick = (pool) => {
        setSelectedPool(pool);
        setMountPath('');
        setMountEmptyError('');
        setMountIsValid(false);
        openMountModal();
    };

    const checkMountDirectoryEmpty = async (path) => {
        if (!path) {
            setMountIsValid(false);
            return;
        }
        setMountCheckingEmpty(true);
        setMountEmptyError('');
        setMountIsValid(false);
        try {
            const response = await fetch(`/api/storage/directories?path=${encodeURIComponent(path)}`, {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    setMountEmptyError('The selected directory is not empty. Please choose an empty directory.');
                    setMountIsValid(false);
                } else {
                    setMountIsValid(true);
                }
            } else {
                setMountEmptyError('Could not verify directory contents.');
                setMountIsValid(false);
            }
        } catch {
            setMountEmptyError('Could not verify directory contents.');
            setMountIsValid(false);
        } finally {
            setMountCheckingEmpty(false);
        }
    };

    const handleMountPathChange = (e) => {
        const path = e.target.value;
        setMountPath(path);
        setMountEmptyError('');
        setMountIsValid(false);
    };

    const handleMountPathBlur = () => {
        if (mountPath) {
            checkMountDirectoryEmpty(mountPath);
        }
    };

    const handleMountConfirm = async () => {
        if (!selectedPool || !mountPath) return;
        setActionLoading(true);
        try {
            const response = await fetch(`/api/storage/pools/mount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify({ type: selectedPool.type, pool: selectedPool.name, mountpoint: mountPath }),
            });
            const data = await response.json();
            if (response.ok) {
                closeMountModal();
                setSelectedPool(null);
                setMountPath('');
                fetchPools();
            } else {
                setError(data.error || 'Failed to mount pool');
            }
        } catch (err) {
            setError('Failed to mount pool');
        } finally {
            setActionLoading(false);
        }
    };

    const handleMountPathSelect = (path) => {
        setMountPath(path);
        checkMountDirectoryEmpty(path);
    };

    const handleUnmountConfirm = async () => {
        if (!selectedPool) return;
        setActionLoading(true);
        try {
            const response = await fetch(`/api/storage/pools/unmount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify({ type: selectedPool.type, pool: selectedPool.name }),
            });
            const data = await response.json();
            if (response.ok) {
                closeUnmountModal();
                setSelectedPool(null);
                fetchPools();
            } else {
                setError(data.error || 'Failed to unmount pool');
            }
        } catch (err) {
            setError('Failed to unmount pool');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!selectedPool) return;
        setActionLoading(true);
        try {
            const response = await fetch(`/api/storage/pools/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify({ type: selectedPool.type, pool: selectedPool.name }),
            });
            const data = await response.json();
            if (response.ok) {
                closeDeleteModal();
                setSelectedPool(null);
                fetchPools();
            } else {
                setError(data.error || 'Failed to delete pool');
            }
        } catch (err) {
            setError('Failed to delete pool');
        } finally {
            setActionLoading(false);
        }
    };

    // Calculate stats
    const totalCapacity = pools.reduce((sum, pool) => sum + pool.size, 0);
    const totalUsed = pools.reduce((sum, pool) => sum + pool.allocated, 0);
    const totalFree = pools.reduce((sum, pool) => sum + pool.free, 0);
    const onlinePools = pools.filter(p => p.health?.toUpperCase() === 'ONLINE').length;
    const degradedPools = pools.filter(p => p.health?.toUpperCase() === 'DEGRADED').length;
    const failedPools = pools.filter(p => ['FAULTED', 'UNAVAIL'].includes(p.health?.toUpperCase())).length;

    // Group pools by type
    const zfsPools = pools.filter(p => p.type === 'zfs');
    const ext4Pools = pools.filter(p => p.type === 'ext4');

    return (
        <Box style={{ position: 'relative' }}>
            <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />

            {/* Summary Stats */}
            <Box
                style={{
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '24px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                }}
            >
                <Group justify="space-between" align="center">
                    <Group gap="xl">
                        <Box>
                            <Text size="xs" c="dimmed" mb={4}>Total Capacity</Text>
                            <Text size="xl" fw={700}>{formatBytes(totalCapacity)}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed" mb={4}>Used</Text>
                            <Text size="lg" fw={600}>{formatBytes(totalUsed)}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed" mb={4}>Free</Text>
                            <Text size="lg" fw={600}>{formatBytes(totalFree)}</Text>
                        </Box>
                        <Box>
                            <Text size="xs" c="dimmed" mb={4}>Online</Text>
                            <Badge size="lg" color="green" variant="light">{onlinePools}</Badge>
                        </Box>
                        {degradedPools > 0 && (
                            <Box>
                                <Text size="xs" c="dimmed" mb={4}>Degraded</Text>
                                <Badge size="lg" color="yellow" variant="light">{degradedPools}</Badge>
                            </Box>
                        )}
                        {failedPools > 0 && (
                            <Box>
                                <Text size="xs" c="dimmed" mb={4}>Failed</Text>
                                <Badge size="lg" color="red" variant="light">{failedPools}</Badge>
                            </Box>
                        )}
                        <Box>
                            <Text size="xs" c="dimmed" mb={4}>Total Pools</Text>
                            <Badge size="lg" color="gray" variant="light">{pools.length}</Badge>
                        </Box>
                    </Group>
                    <Box
                        onClick={fetchPools}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: theme.colors.blue[6],
                            color: 'white',
                            transition: 'background-color 0.15s ease',
                        }}
                    >
                        <IconRefresh size={16} />
                        <Text size="sm" fw={500}>Refresh</Text>
                    </Box>
                </Group>
            </Box>

            {/* Pool List */}
            <Group justify="space-between" align="center" mb="md">
                <Text size="lg" fw={600}>Storage Pools</Text>
                <Button
                    variant="light"
                    color="green"
                    size="sm"
                    leftSection={<IconPlus size={16} />}
                    onClick={openWizard}
                >
                    New Pool
                </Button>
            </Group>

            {error && (
                <Text c="red" mb="md">{error}</Text>
            )}

            {!loading && !error && pools.length === 0 && (
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <ThemeIcon size={64} radius="xl" variant="light" color="gray" mx="auto" mb="md">
                        <IconDatabase size={32} />
                    </ThemeIcon>
                    <Text size="lg" fw={500} c="dimmed">No storage pools found</Text>
                    <Text size="sm" c="dimmed" mt="xs" mb="md">
                        Create a ZFS pool or mount an EXT4 filesystem to see it here
                    </Text>
                    <Button
                        variant="light"
                        color="green"
                        leftSection={<IconPlus size={16} />}
                        onClick={openWizard}
                    >
                        Create your first pool
                    </Button>
                </Box>
            )}

            {!loading && !error && zfsPools.length > 0 && (
                <Box mb="xl">
                    <Group gap="xs" mb="md">
                        <IconStack2 size={18} />
                        <Text size="md" fw={600}>ZFS Pools</Text>
                        <Badge size="sm" variant="light" color="blue">{zfsPools.length}</Badge>
                    </Group>
                    {zfsPools.map((pool) => (
                        <PoolCard key={`zfs-${pool.name}`} pool={pool} onMount={handleMountClick} onUnmount={handleUnmountClick} onDelete={handleDeleteClick} />
                    ))}
                </Box>
            )}

            {!loading && !error && ext4Pools.length > 0 && (
                <Box mb="xl">
                    <Group gap="xs" mb="md">
                        <IconDatabase size={18} />
                        <Text size="md" fw={600}>EXT4 Volumes</Text>
                        <Badge size="sm" variant="light" color="teal">{ext4Pools.length}</Badge>
                    </Group>
                    {ext4Pools.map((pool) => (
                        <PoolCard key={`ext4-${pool.name}`} pool={pool} onMount={handleMountClick} onUnmount={handleUnmountClick} onDelete={handleDeleteClick} />
                    ))}
                </Box>
            )}

            <CreatePoolWizard
                opened={wizardOpened}
                onClose={closeWizard}
                onSuccess={fetchPools}
            />

            {/* Mount Modal */}
            <Modal
                opened={mountModal}
                onClose={() => { closeMountModal(); setSelectedPool(null); setMountPath(''); setMountEmptyError(''); setMountIsValid(false); }}
                title="Mount Volume"
                centered
            >
                <Text size="sm" mb="md">
                    Mount {selectedPool?.type === 'zfs' ? 'ZFS pool' : 'EXT4 volume'} <strong>{selectedPool?.name}</strong> at the specified path.
                    {selectedPool?.type === 'ext4' && ' The path will also be added to /etc/fstab for automatic mounting on boot.'}
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                    The directory must be empty.
                </Text>
                <Group gap="xs" mb="md">
                    <TextInput
                        placeholder="/media/..."
                        value={mountPath}
                        onChange={handleMountPathChange}
                        onBlur={handleMountPathBlur}
                        style={{ flex: 1 }}
                        size="md"
                        error={mountEmptyError || undefined}
                        rightSection={mountCheckingEmpty ? <Loader size="xs" /> : undefined}
                    />
                    <Button
                        variant="light"
                        size="md"
                        onClick={openFileSelector}
                    >
                        Browse
                    </Button>
                </Group>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => { closeMountModal(); setSelectedPool(null); setMountPath(''); setMountEmptyError(''); setMountIsValid(false); }}>Cancel</Button>
                    <Button color="green" loading={actionLoading} onClick={handleMountConfirm} disabled={!mountPath || !mountIsValid || mountCheckingEmpty}>Mount</Button>
                </Group>
            </Modal>

            <FileSelector
                opened={fileSelectorOpened}
                onClose={closeFileSelector}
                onSelect={handleMountPathSelect}
                title="Select Mount Point"
                selectLabel="Select Folder"
                initialPath={mountPath || '/media'}
                allowFiles={false}
                showFiles={false}
            />

            {/* Unmount Confirmation Modal */}
            <Modal
                opened={unmountModal}
                onClose={() => { closeUnmountModal(); setSelectedPool(null); }}
                title="Unmount Pool"
                centered
            >
                <Alert color="yellow" mb="md" icon={<IconAlertTriangle size={16} />}>
                    {selectedPool?.type === 'zfs'
                        ? `This will unmount the ZFS pool "${selectedPool?.name}" by setting its mountpoint to none.`
                        : `This will unmount the EXT4 volume "${selectedPool?.name}", remove its entry from /etc/fstab, and remove the mount directory. The automount on reboot will be disabled.`
                    }
                </Alert>
                <Text size="sm" mb="md">
                    The pool and its data will remain intact. You can remount it later.
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => { closeUnmountModal(); setSelectedPool(null); }}>Cancel</Button>
                    <Button color="yellow" loading={actionLoading} onClick={handleUnmountConfirm}>Unmount</Button>
                </Group>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                opened={deleteModal}
                onClose={() => { closeDeleteModal(); setSelectedPool(null); }}
                title="Delete Pool"
                centered
            >
                <Alert color="red" mb="md" icon={<IconAlertTriangle size={16} />}>
                    <Text fw={700} size="sm">This action is destructive and irreversible!</Text>
                </Alert>
                <Text size="sm" mb="md">
                    {selectedPool?.type === 'zfs'
                        ? `This will permanently destroy the ZFS pool "${selectedPool?.name}" and ALL data stored on it.`
                        : `This will unmount the EXT4 volume "${selectedPool?.name}", remove its /etc/fstab entry, and wipe the filesystem. ALL data will be permanently lost.`
                    }
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => { closeDeleteModal(); setSelectedPool(null); }}>Cancel</Button>
                    <Button color="red" loading={actionLoading} onClick={handleDeleteConfirm}>Delete Permanently</Button>
                </Group>
            </Modal>
        </Box>
    );
}
