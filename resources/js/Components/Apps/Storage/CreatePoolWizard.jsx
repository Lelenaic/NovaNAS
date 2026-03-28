import { useEffect, useState } from 'react';
import {
    Box,
    Text,
    Group,
    Modal,
    Stack,
    Button,
    Badge,
    TextInput,
    Alert,
    Progress,
    ThemeIcon,
    Loader,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMantineTheme } from '@mantine/core';
import {
    IconStack2,
    IconDatabase,
    IconDisc,
    IconCheck,
    IconAlertTriangle,
    IconArrowRight,
    IconArrowLeft,
    IconInfoCircle,
    IconServer,
    IconShieldCheck,
    IconLayersDifference,
    IconLayersIntersect,
    IconLock,
    IconBolt,
    IconFolder,
} from '@tabler/icons-react';
import { FileSelector } from '../../FileSelector';

const STEPS = [
    { id: 1, label: 'Filesystem' },
    { id: 2, label: 'Select Disks' },
    { id: 3, label: 'Configure' },
    { id: 4, label: 'Review' },
];

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function StepIndicator({ currentStep, theme }) {
    return (
        <Group justify="center" gap={0} mb="xl">
            {STEPS.map((step, index) => {
                const isActive = step.id === currentStep;
                const isCompleted = step.id < currentStep;
                const isLast = index === STEPS.length - 1;

                return (
                    <Group key={step.id} gap={0}>
                        <Group gap="xs">
                            <Box
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isActive
                                        ? theme.colors.blue[6]
                                        : isCompleted
                                            ? theme.colors.green[6]
                                            : theme.colors.dark[4],
                                    color: isActive || isCompleted ? 'white' : theme.colors.gray[5],
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {isCompleted ? <IconCheck size={18} /> : step.id}
                            </Box>
                            <Text
                                size="sm"
                                fw={isActive ? 600 : 400}
                                c={isActive ? undefined : 'dimmed'}
                            >
                                {step.label}
                            </Text>
                        </Group>
                        {!isLast && (
                            <Box
                                style={{
                                    width: 48,
                                    height: 2,
                                    margin: '0 8px',
                                    backgroundColor: isCompleted ? theme.colors.green[6] : theme.colors.dark[4],
                                    transition: 'background-color 0.2s ease',
                                }}
                            />
                        )}
                    </Group>
                );
            })}
        </Group>
    );
}

function FilesystemSelection({ selectedFs, onSelect, backends, theme }) {
    const fsOptions = [
        {
            id: 'zfs',
            name: 'ZFS',
            fullName: 'ZFS Pool',
            description: 'Advanced filesystem with built-in RAID, snapshots, compression, and data integrity checks.',
            icon: IconStack2,
            color: 'blue',
            features: ['RAIDZ support', 'Snapshots', 'Compression', 'Data checksums'],
            available: backends.zfs ?? false,
        },
        {
            id: 'ext4',
            name: 'EXT4',
            fullName: 'EXT4 Volume',
            description: 'Mature, reliable Linux filesystem. Simple setup — format a disk and mount it.',
            icon: IconDatabase,
            color: 'teal',
            features: ['Fast & stable', 'Low overhead', 'Wide compatibility', 'Easy to manage'],
            available: backends.ext4 ?? false,
        },
    ];

    return (
        <Box>
            <Text size="sm" c="dimmed" ta="center" mb="xl">
                Choose the filesystem type for your new storage pool
            </Text>
            <Group justify="center" gap="xl">
                {fsOptions.map((fs) => {
                    const isSelected = selectedFs === fs.id;
                    const FsIcon = fs.icon;

                    return (
                        <Box
                            key={fs.id}
                            onClick={() => fs.available && onSelect(fs.id)}
                            style={{
                                width: 280,
                                padding: '28px 24px',
                                borderRadius: '16px',
                                cursor: fs.available ? 'pointer' : 'not-allowed',
                                backgroundColor: theme.colors.dark[6],
                                border: isSelected
                                    ? `2px solid ${fs.color === 'blue' ? theme.colors.blue[5] : theme.colors.teal[5]}`
                                    : `2px solid ${theme.colors.dark[4]}`,
                                opacity: fs.available ? 1 : 0.45,
                                transition: 'all 0.2s ease',
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            {isSelected && (
                                <ThemeIcon
                                    size={28}
                                    radius="xl"
                                    color={fs.color}
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 12,
                                    }}
                                >
                                    <IconCheck size={16} />
                                </ThemeIcon>
                            )}

                            <ThemeIcon
                                size={64}
                                radius="xl"
                                variant="light"
                                color={fs.color}
                                mb="md"
                            >
                                <FsIcon size={32} />
                            </ThemeIcon>

                            <Text size="lg" fw={700} mb={4}>
                                {fs.fullName}
                            </Text>
                            <Text size="xs" c="dimmed" mb="md" style={{ lineHeight: 1.5 }}>
                                {fs.description}
                            </Text>

                            <Stack gap={4}>
                                {fs.features.map((feat, i) => (
                                    <Group key={i} gap="xs" justify="center">
                                        <IconCheck size={14} color={fs.color === 'blue' ? theme.colors.blue[4] : theme.colors.teal[4]} />
                                        <Text size="xs" c="dimmed">{feat}</Text>
                                    </Group>
                                ))}
                            </Stack>

                            {!fs.available && (
                                <Badge
                                    size="sm"
                                    color="red"
                                    variant="light"
                                    mt="md"
                                    leftSection={<IconAlertTriangle size={12} />}
                                >
                                    Not available
                                </Badge>
                            )}
                        </Box>
                    );
                })}
            </Group>
        </Box>
    );
}

function DiskSelection({ selectedDisks, onToggleDisk, disks, loading, fsType, usedDisks, theme }) {
    if (loading) {
        return (
            <Box ta="center" py="xl">
                <Loader size="lg" />
                <Text size="sm" c="dimmed" mt="md">Scanning disks...</Text>
            </Box>
        );
    }

    if (disks.length === 0) {
        return (
            <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
                No available disks found. All disks may be in use or are system disks.
            </Alert>
        );
    }

    const isDiskDisabled = (disk) => disk.isSystem || usedDisks.includes(disk.name);

    return (
        <Box>
            <Group justify="space-between" align="center" mb="md">
                <Box>
                    <Text size="sm" fw={500}>Select disks for your pool</Text>
                    <Text size="xs" c="dimmed">
                        {fsType === 'ext4'
                            ? 'Choose one disk to format with EXT4'
                            : 'Click disks to add them to the pool'
                        }
                    </Text>
                </Box>
                <Badge size="lg" variant="light" color="blue">
                    {selectedDisks.length} selected
                </Badge>
            </Group>

            {fsType === 'ext4' && selectedDisks.length > 0 && (
                <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light" mb="md">
                    <Text size="sm">Warning: This disk will be <strong>formatted</strong>. All existing data will be erased.</Text>
                </Alert>
            )}

            <Box
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    padding: '4px',
                }}
            >
                {disks.map((disk) => {
                    const isSelected = selectedDisks.includes(disk.name);
                    const disabled = isDiskDisabled(disk);
                    const isInUse = usedDisks.includes(disk.name);

                    return (
                        <Box
                            key={disk.name}
                            onClick={() => !disabled && onToggleDisk(disk.name)}
                            style={{
                                padding: '16px',
                                borderRadius: '12px',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                backgroundColor: theme.colors.dark[5],
                                border: isSelected
                                    ? `2px solid ${theme.colors.blue[5]}`
                                    : `2px solid ${theme.colors.dark[4]}`,
                                opacity: disabled ? 0.4 : 1,
                                transition: 'all 0.15s ease',
                                position: 'relative',
                            }}
                        >
                            {isSelected && (
                                <ThemeIcon
                                    size={24}
                                    radius="xl"
                                    color="blue"
                                    style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                    }}
                                >
                                    <IconCheck size={14} />
                                </ThemeIcon>
                            )}

                            {disabled && (
                                <ThemeIcon
                                    size={24}
                                    radius="xl"
                                    color={isInUse ? 'yellow' : 'red'}
                                    variant="light"
                                    style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                    }}
                                >
                                    <IconLock size={14} />
                                </ThemeIcon>
                            )}

                            <ThemeIcon
                                size={40}
                                radius="md"
                                variant="light"
                                color={disk.isFlash ? 'teal' : disk.rotational ? 'gray' : 'cyan'}
                                mb="sm"
                            >
                                {disk.isFlash ? <IconBolt size={20} /> : <IconDisc size={20} />}
                            </ThemeIcon>

                            <Text size="sm" fw={700}>
                                /dev/{disk.name}
                            </Text>
                            <Text size="xs" c="dimmed" mt={2}>
                                {formatBytes(disk.size)}
                            </Text>

                            <Group gap={6} mt="xs">
                                <Badge
                                    size="xs"
                                    variant="light"
                                    color={disk.isFlash ? 'teal' : disk.rotational ? 'gray' : 'cyan'}
                                >
                                    {disk.isFlash ? 'Flash' : disk.rotational ? 'HDD' : 'SSD'}
                                </Badge>
                                {disk.isSystem && (
                                    <Badge size="xs" variant="light" color="red">
                                        System
                                    </Badge>
                                )}
                                {isInUse && (
                                    <Badge size="xs" variant="light" color="yellow">
                                        In Use
                                    </Badge>
                                )}
                                {disk.removable && (
                                    <Badge size="xs" variant="light" color="orange">
                                        USB
                                    </Badge>
                                )}
                            </Group>

                            {(disk.model || disk.vendor) && (
                                <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
                                    {disk.model?.trim() || disk.vendor?.trim()}
                                </Text>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

const VDEV_OPTIONS = [
    { value: 'stripe', label: 'Stripe (RAID 0)', description: 'No redundancy, maximum capacity' },
    { value: 'mirror', label: 'Mirror (RAID 1)', description: 'Full disk duplication, 2+ disks' },
    { value: 'raidz', label: 'RAIDZ (RAID 5)', description: 'Single parity, 3+ disks' },
    { value: 'raidz2', label: 'RAIDZ2 (RAID 6)', description: 'Double parity, 4+ disks' },
];

function ConfigurationStep({ config, setConfig, fsType, selectedDisks, theme, nameError, onNameChange }) {
    const [fileSelectorOpened, { open: openFileSelector, close: closeFileSelector }] = useDisclosure(false);
    const [checkingEmpty, setCheckingEmpty] = useState(false);
    const [emptyError, setEmptyError] = useState(config.mountpointEmptyError || '');

    const vdevMinDisks = {
        stripe: 1,
        mirror: 2,
        raidz: 3,
        raidz2: 4,
    };

    const currentVdev = config.vdevType || 'stripe';
    const minRequired = vdevMinDisks[currentVdev] || 1;
    const hasEnoughDisks = selectedDisks.length >= minRequired;

    const checkDirectoryEmpty = async (path) => {
        setCheckingEmpty(true);
        setEmptyError('');
        try {
            const response = await fetch(`/api/storage/directories?path=${encodeURIComponent(path)}`, {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    setEmptyError('The selected directory is not empty. Please choose an empty directory.');
                    setConfig({ ...config, mountpoint: path, mountpointIsEmpty: false });
                    return;
                }
                setConfig({ ...config, mountpoint: path, mountpointIsEmpty: true });
            } else {
                setEmptyError('Could not verify directory contents.');
                setConfig({ ...config, mountpoint: path, mountpointIsEmpty: false });
            }
        } catch {
            setEmptyError('Could not verify directory contents.');
            setConfig({ ...config, mountpoint: path, mountpointIsEmpty: false });
        } finally {
            setCheckingEmpty(false);
        }
    };

    const handleMountPointSelect = (path) => {
        checkDirectoryEmpty(path);
    };

    return (
        <Box>
            <Text size="sm" c="dimmed" mb="xl">
                {fsType === 'zfs'
                    ? 'Configure your ZFS pool settings'
                    : 'Configure your EXT4 volume settings'
                }
            </Text>

            <Stack gap="lg">
                {fsType === 'zfs' && (
                    <>
                        <TextInput
                            label="Pool Name"
                            placeholder="e.g. tank, data, media"
                            value={config.name || ''}
                            onChange={(e) => {
                                setConfig({ ...config, name: e.target.value });
                                onNameChange?.();
                            }}
                            description="A unique name for your ZFS pool"
                            size="md"
                            leftSection={<IconServer size={16} />}
                            error={nameError || undefined}
                        />

                        <Box>
                            <Text size="sm" fw={500} mb="xs">RAID Configuration</Text>
                            <Text size="xs" c="dimmed" mb="sm">
                                Choose how data is distributed across {selectedDisks.length} selected disk(s)
                            </Text>
                            <Box
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '10px',
                                }}
                            >
                                {VDEV_OPTIONS.map((opt) => {
                                    const isVdevSelected = currentVdev === opt.value;
                                    const hasDisks = selectedDisks.length >= vdevMinDisks[opt.value];
                                    const vdevIcons = {
                                        stripe: IconLayersDifference,
                                        mirror: IconLayersIntersect,
                                        raidz: IconShieldCheck,
                                        raidz2: IconShieldCheck,
                                    };
                                    const VdevIcon = vdevIcons[opt.value];

                                    return (
                                        <Box
                                            key={opt.value}
                                            onClick={() => hasDisks && setConfig({ ...config, vdevType: opt.value })}
                                            style={{
                                                padding: '14px 16px',
                                                borderRadius: '10px',
                                                cursor: hasDisks ? 'pointer' : 'not-allowed',
                                                backgroundColor: theme.colors.dark[5],
                                                border: isVdevSelected
                                                    ? `2px solid ${theme.colors.blue[5]}`
                                                    : `2px solid ${theme.colors.dark[4]}`,
                                                opacity: hasDisks ? 1 : 0.4,
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            <Group gap="sm" align="center">
                                                <ThemeIcon
                                                    size={32}
                                                    radius="md"
                                                    variant="light"
                                                    color={isVdevSelected ? 'blue' : 'gray'}
                                                >
                                                    <VdevIcon size={16} />
                                                </ThemeIcon>
                                                <Box>
                                                    <Text size="sm" fw={600}>{opt.label}</Text>
                                                    <Text size="xs" c="dimmed">{opt.description}</Text>
                                                </Box>
                                            </Group>
                                            <Text size="xs" c={hasDisks ? 'dimmed' : 'red'} mt="xs">
                                                Min {vdevMinDisks[opt.value]} disk(s) required
                                            </Text>
                                        </Box>
                                    );
                                })}
                            </Box>
                            {!hasEnoughDisks && (
                                <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" mt="sm">
                                    {currentVdev} requires at least {minRequired} disks, but only {selectedDisks.length} selected.
                                    Go back and select more disks.
                                </Alert>
                            )}
                        </Box>
                    </>
                )}

                <Box>
                    <Text size="sm" fw={500} mb="xs">Mount Point</Text>
                    <Text size="xs" c="dimmed" mb="sm">
                        Where the pool will be mounted on the filesystem. The directory must be empty.
                    </Text>
                    <Group gap="xs">
                        <TextInput
                            placeholder="/media/..."
                            value={config.mountpoint || ''}
                            readOnly
                            style={{ flex: 1 }}
                            size="md"
                            leftSection={<IconDatabase size={16} />}
                            rightSection={checkingEmpty ? <Loader size="xs" /> : undefined}
                            error={emptyError || undefined}
                        />
                        <Button
                            variant="light"
                            size="md"
                            onClick={openFileSelector}
                            leftSection={<IconFolder size={16} />}
                        >
                            Browse
                        </Button>
                    </Group>
                </Box>
            </Stack>

            <FileSelector
                opened={fileSelectorOpened}
                onClose={closeFileSelector}
                onSelect={handleMountPointSelect}
                title="Select Mount Point"
                selectLabel="Select Folder"
                initialPath={config.mountpoint || '/media'}
                allowFiles={false}
                showFiles={false}
            />
        </Box>
    );
}

function ReviewStep({ config, fsType, selectedDisks, disks, theme }) {
    const selectedDiskInfo = disks.filter((d) => selectedDisks.includes(d.name));
    const totalSize = selectedDiskInfo.reduce((sum, d) => sum + d.size, 0);

    const effectiveSize = fsType === 'zfs'
        ? config.vdevType === 'mirror'
            ? totalSize / 2
            : config.vdevType === 'raidz'
                ? totalSize - (selectedDiskInfo[0]?.size || 0)
                : config.vdevType === 'raidz2'
                    ? totalSize - 2 * (selectedDiskInfo[0]?.size || 0)
                    : totalSize
        : selectedDiskInfo[0]?.size || 0;

    const reviewItems = [
        { label: 'Filesystem', value: fsType === 'zfs' ? 'ZFS Pool' : 'EXT4 Volume', icon: fsType === 'zfs' ? IconStack2 : IconDatabase },
        ...(fsType === 'zfs' ? [
            { label: 'Pool Name', value: config.name, icon: IconServer },
            { label: 'RAID Type', value: VDEV_OPTIONS.find(o => o.value === config.vdevType)?.label || config.vdevType, icon: IconShieldCheck },
        ] : []),
        { label: 'Disks', value: selectedDisks.map(d => `/dev/${d}`).join(', '), icon: IconDisc },
        { label: 'Mount Point', value: config.mountpoint, icon: IconDatabase },
        { label: 'Effective Capacity', value: formatBytes(effectiveSize), icon: IconInfoCircle },
    ];

    return (
        <Box>
            <Text size="sm" c="dimmed" ta="center" mb="xl">
                Review your configuration before creating the pool
            </Text>

            <Box
                style={{
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '14px',
                    padding: '24px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                }}
            >
                <Stack gap="sm">
                    {reviewItems.map((item, i) => {
                        const ItemIcon = item.icon;
                        return (
                            <Group key={i} gap="md" wrap="nowrap">
                                <ThemeIcon
                                    size={36}
                                    radius="md"
                                    variant="light"
                                    color={fsType === 'zfs' ? 'blue' : 'teal'}
                                >
                                    <ItemIcon size={18} />
                                </ThemeIcon>
                                <Box style={{ flex: 1, minWidth: 0 }}>
                                    <Text size="xs" c="dimmed">{item.label}</Text>
                                    <Text size="sm" fw={600} style={{ wordBreak: 'break-all' }}>
                                        {item.value}
                                    </Text>
                                </Box>
                            </Group>
                        );
                    })}
                </Stack>
            </Box>

            <Alert
                icon={<IconAlertTriangle size={16} />}
                color="orange"
                variant="light"
                mt="md"
            >
                <Text size="sm">
                    {fsType === 'zfs'
                        ? 'This will create a new ZFS pool on the selected disks. Existing data on those disks will not be destroyed unless the disks already have ZFS labels.'
                        : 'This will format the selected disk with EXT4. All existing data on the disk will be permanently erased.'
                    }
                </Text>
            </Alert>
        </Box>
    );
}

export function CreatePoolWizard({ opened, onClose, onSuccess }) {
    const theme = useMantineTheme();
    const [step, setStep] = useState(1);
    const [fsType, setFsType] = useState(null);
    const [selectedDisks, setSelectedDisks] = useState([]);
    const [config, setConfig] = useState({
        name: '',
        vdevType: 'stripe',
        mountpoint: '',
        mountpointIsEmpty: false,
    });
    const [disks, setDisks] = useState([]);
    const [usedDisks, setUsedDisks] = useState([]);
    const [disksLoading, setDisksLoading] = useState(false);
    const [backends, setBackends] = useState({});
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const [nameValidating, setNameValidating] = useState(false);
    const [nameError, setNameError] = useState(null);

    useEffect(() => {
        if (opened) {
            setStep(1);
            setFsType(null);
            setSelectedDisks([]);
            setConfig({ name: '', vdevType: 'stripe', mountpoint: '', mountpointIsEmpty: false });
            setError(null);
            setNameError(null);
            fetchBackends();
        }
    }, [opened]);

    const fetchBackends = async () => {
        try {
            const response = await fetch('/api/storage/backends', {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });
            const data = await response.json();
            setBackends(data.backends || {});
        } catch (err) {
            console.error('Error fetching backends:', err);
        }
    };

    const fetchDisks = async () => {
        setDisksLoading(true);
        try {
            const [disksRes, poolsRes] = await Promise.all([
                fetch('/api/storage/disks', {
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                    },
                }),
                fetch('/api/storage/pools', {
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                    },
                }),
            ]);

            const disksData = await disksRes.json();
            const poolsData = await poolsRes.json();

            // Show all physical disks (system ones will be disabled in the UI)
            setDisks(disksData.disks || []);
            setUsedDisks(poolsData.used_disks || []);
        } catch (err) {
            console.error('Error fetching disks:', err);
        } finally {
            setDisksLoading(false);
        }
    };

    const handleFsSelect = (fs) => {
        setFsType(fs);
    };

    const handleToggleDisk = (diskName) => {
        if (fsType === 'ext4') {
            setSelectedDisks([diskName]);
        } else {
            setSelectedDisks((prev) =>
                prev.includes(diskName)
                    ? prev.filter((d) => d !== diskName)
                    : [...prev, diskName]
            );
        }
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return fsType !== null;
            case 2:
                return selectedDisks.length > 0;
            case 3: {
                if (nameValidating) return false;
                if (fsType === 'zfs') {
                    if (!config.name?.trim()) return false;
                    const vdevMin = { stripe: 1, mirror: 2, raidz: 3, raidz2: 4 };
                    if (selectedDisks.length < (vdevMin[config.vdevType] || 1)) return false;
                }
                return config.mountpoint?.trim()?.length > 0 && config.mountpointIsEmpty === true;
            }
            case 4:
                return true;
            default:
                return false;
        }
    };

    const validatePoolName = async () => {
        if (fsType !== 'zfs') return true;

        const name = config.name?.trim();
        if (!name) {
            setNameError('Pool name is required.');
            return false;
        }

        setNameValidating(true);
        setNameError(null);

        try {
            const response = await fetch('/api/storage/pools/validate-name', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify({ name }),
            });

            const data = await response.json();

            if (!response.ok || !data.valid) {
                setNameError(data.error || 'Invalid pool name.');
                return false;
            }

            return true;
        } catch (err) {
            setNameError('Could not validate pool name. Please try again.');
            return false;
        } finally {
            setNameValidating(false);
        }
    };

    const handleNext = async () => {
        if (step === 1 && fsType) {
            fetchDisks();
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            const isValid = await validatePoolName();
            if (isValid) {
                setStep(4);
            }
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
            setError(null);
        }
    };

    const handleCreate = async () => {
        setCreating(true);
        setError(null);

        const payload = {
            type: fsType,
            disks: selectedDisks,
            mountpoint: config.mountpoint,
        };

        if (fsType === 'zfs') {
            payload.name = config.name;
            payload.vdev_type = config.vdevType;
        } else {
            payload.device = selectedDisks[0];
            payload.persist_fstab = true;
        }

        try {
            const response = await fetch('/api/storage/pools', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to create pool');
                return;
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError('An unexpected error occurred');
            console.error('Error creating pool:', err);
        } finally {
            setCreating(false);
        }
    };

    const getVdevLabel = (type) => {
        return VDEV_OPTIONS.find(o => o.value === type)?.label || type;
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="sm">
                    <ThemeIcon size={32} radius="md" variant="light" color="blue">
                        <IconServer size={18} />
                    </ThemeIcon>
                    <Text size="lg" fw={700}>Create New Pool</Text>
                </Group>
            }
            size="xl"
            centered
            styles={{
                body: { padding: '24px 28px' },
                header: { paddingBottom: 0 },
            }}
        >
            <StepIndicator currentStep={step} theme={theme} />

            <Progress
                value={(step / STEPS.length) * 100}
                size="xs"
                color="blue"
                radius="xl"
                mb="xl"
            />

            {/* Step Content */}
            <Box style={{ minHeight: 380 }}>
                {step === 1 && (
                    <FilesystemSelection
                        selectedFs={fsType}
                        onSelect={handleFsSelect}
                        backends={backends}
                        theme={theme}
                    />
                )}

                {step === 2 && (
                    <DiskSelection
                        selectedDisks={selectedDisks}
                        onToggleDisk={handleToggleDisk}
                        disks={disks}
                        loading={disksLoading}
                        fsType={fsType}
                        usedDisks={usedDisks}
                        theme={theme}
                    />
                )}

                {step === 3 && (
                    <ConfigurationStep
                        config={config}
                        setConfig={setConfig}
                        fsType={fsType}
                        selectedDisks={selectedDisks}
                        theme={theme}
                        nameError={nameError}
                        onNameChange={() => setNameError(null)}
                    />
                )}

                {step === 4 && (
                    <ReviewStep
                        config={config}
                        fsType={fsType}
                        selectedDisks={selectedDisks}
                        disks={disks}
                        theme={theme}
                    />
                )}
            </Box>

            {error && (
                <Alert
                    icon={<IconAlertTriangle size={16} />}
                    color="red"
                    variant="light"
                    mt="md"
                    withCloseButton
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {/* Footer */}
            <Group justify="space-between" mt="xl" pt="md" style={{ borderTop: `1px solid ${theme.colors.dark[4]}` }}>
                <Button
                    variant="subtle"
                    color="gray"
                    onClick={step === 1 ? onClose : handleBack}
                    leftSection={step > 1 ? <IconArrowLeft size={16} /> : undefined}
                >
                    {step === 1 ? 'Cancel' : 'Back'}
                </Button>

                {step < 4 ? (
                    <Button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        loading={nameValidating}
                        rightSection={<IconArrowRight size={16} />}
                        color="blue"
                    >
                        Continue
                    </Button>
                ) : (
                    <Button
                        onClick={handleCreate}
                        loading={creating}
                        color="green"
                        leftSection={<IconCheck size={16} />}
                    >
                        Create Pool
                    </Button>
                )}
            </Group>
        </Modal>
    );
}
