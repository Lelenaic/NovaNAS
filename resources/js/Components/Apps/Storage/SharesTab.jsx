import { useEffect, useState } from 'react';
import {
    Box,
    Text,
    Group,
    LoadingOverlay,
    ThemeIcon,
    ActionIcon,
    Button,
    Modal,
    Stack,
    Badge,
    Switch,
    TextInput,
    Select,
    MultiSelect,
    Alert,
    Card,
    SimpleGrid,
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    IconFolderShare,
    IconPlus,
    IconPencil,
    IconTrash,
    IconAlertCircle,
    IconCheck,
    IconHome,
} from '@tabler/icons-react';

function ShareModal({ opened, onClose, onSave, initialData, users, existingShares, loading }) {
    const theme = useMantineTheme();
    const [name, setName] = useState('');
    const [comment, setComment] = useState('');
    const [path, setPath] = useState('');
    const [writable, setWritable] = useState('yes');
    const [guest, setGuest] = useState('no');
    const [validUsers, setValidUsers] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setComment(initialData.comment || '');
            setPath(initialData.path || '');
            setWritable(initialData.writable || 'yes');
            setGuest(initialData.guest || 'no');
            setValidUsers(initialData['valid users'] ? initialData['valid users'].split(',').map(u => u.trim()) : []);
        } else {
            setName('');
            setComment('');
            setPath('');
            setWritable('yes');
            setGuest('no');
            setValidUsers([]);
        }
        setError(null);
    }, [initialData, opened]);

    const handleSave = () => {
        if (!name.trim()) {
            setError('Share name is required');
            return;
        }

        // Check for duplicate name (excluding current share if editing)
        if (existingShares) {
            const isDuplicate = existingShares.some(share =>
                share.name.toLowerCase() === name.trim().toLowerCase() &&
                (!initialData || share.name !== initialData.name)
            );
            if (isDuplicate) {
                setError(`A share named "${name.trim()}" already exists`);
                return;
            }
        }

        if (!path.trim() && !initialData) {
            setError('Path is required');
            return;
        }

        onSave({
            name: name.trim(),
            comment: comment.trim() || null,
            path: path.trim() || null,
            writable,
            guest,
            valid_users: validUsers.length > 0 ? validUsers.join(', ') : null,
        });
    };

    const userOptions = users.map((u) => ({
        value: u.value,
        label: u.label,
    }));

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={initialData ? 'Edit Share' : 'Create New Share'}
            size="lg"
            centered
        >
            <Stack gap="md">
                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red">
                        {error}
                    </Alert>
                )}

                <TextInput
                    label="Share Name"
                    placeholder="e.g., documents"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    description="Alphanumeric characters, hyphens and underscores only"
                    required
                />

                <TextInput
                    label="Comment"
                    placeholder="Description for this share"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />

                <TextInput
                    label="Path"
                    placeholder="/media/main/share"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    required
                    description="Full path to the shared directory"
                />

                <Select
                    label="Writable"
                    value={writable}
                    onChange={setWritable}
                    data={[
                        { value: 'yes', label: 'Yes - Allow writes' },
                        { value: 'no', label: 'No - Read only' },
                    ]}
                />

                <Select
                    label="Guest Access"
                    value={guest}
                    onChange={setGuest}
                    data={[
                        { value: 'no', label: 'No - Require authentication' },
                        { value: 'yes', label: 'Yes - Allow guest and users' },
                        { value: 'only', label: 'Only - Guest only access' },
                    ]}
                />

                <MultiSelect
                    label="Valid Users"
                    placeholder="Select users who can access this share"
                    data={userOptions}
                    value={validUsers}
                    onChange={setValidUsers}
                    searchable
                    clearable
                    description="Leave empty to allow all users"
                />

                <Group justify="flex-end" mt="md">
                    <Button variant="subtle" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} loading={loading}>
                        {initialData ? 'Save Changes' : 'Create Share'}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

function DeleteConfirmModal({ opened, onClose, onConfirm, shareName, loading }) {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Delete Share"
            centered
        >
            <Stack gap="md">
                <Alert icon={<IconAlertCircle size={16} />} color="red">
                    Are you sure you want to delete the share "{shareName}"?
                    This action cannot be undone.
                </Alert>
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button color="red" onClick={onConfirm} loading={loading}>
                        Delete Share
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

function ShareCard({ share, onEdit, onDelete, onToggleHomes, users, loadingToggle }) {
    const theme = useMantineTheme();
    const isHomes = share.name === 'homes';
    const isEnabled = share.enabled !== false;

    return (
        <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{
                backgroundColor: theme.colors.dark[6],
                borderColor: theme.colors.dark[4],
            }}
        >
            <Group justify="space-between" mb="sm">
                <Group gap="sm">
                    <ThemeIcon
                        size="lg"
                        radius="md"
                        variant="light"
                        color={isHomes ? 'orange' : 'blue'}
                    >
                        {isHomes ? <IconHome size={20} /> : <IconFolderShare size={20} />}
                    </ThemeIcon>
                    <Box>
                        <Text fw={600} size="md">
                            {share.name}
                        </Text>
                        {share.comment && (
                            <Text size="xs" c="dimmed">
                                {share.comment}
                            </Text>
                        )}
                    </Box>
                </Group>
                {isHomes ? (
                    <Switch
                        label={isEnabled ? 'Enabled' : 'Disabled'}
                        checked={isEnabled}
                        onChange={() => onToggleHomes(!isEnabled)}
                        disabled={loadingToggle}
                        color="green"
                        styles={{
                            root: { cursor: loadingToggle ? 'not-allowed' : 'pointer' },
                            track: { cursor: loadingToggle ? 'not-allowed' : 'pointer' },
                            input: { cursor: loadingToggle ? 'not-allowed' : 'pointer' },
                        }}
                    />
                ) : (
                    <Badge color="green" variant="light">
                        Active
                    </Badge>
                )}
            </Group>

            {!isHomes && (
                <>
                    <Stack gap="xs" mb="md">
                        <Group gap="xs">
                            <Text size="xs" c="dimmed" w={80}>Path:</Text>
                            <Text size="xs" ff="monospace">{share.path || '-'}</Text>
                        </Group>
                        <Group gap="xs">
                            <Text size="xs" c="dimmed" w={80}>Writable:</Text>
                            <Text size="xs">{share.writable === 'yes' ? 'Yes' : 'No'}</Text>
                        </Group>
                        <Group gap="xs">
                            <Text size="xs" c="dimmed" w={80}>Guest:</Text>
                            <Text size="xs">{share.guest || 'no'}</Text>
                        </Group>
                        {share['valid users'] && (
                            <Group gap="xs">
                                <Text size="xs" c="dimmed" w={80}>Users:</Text>
                                <Text size="xs">{share['valid users']}</Text>
                            </Group>
                        )}
                    </Stack>

                    <Group justify="flex-end" gap="xs">
                        <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => onEdit(share)}
                        >
                            <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => onDelete(share)}
                        >
                            <IconTrash size={16} />
                        </ActionIcon>
                    </Group>
                </>
            )}

            {isHomes && (
                <Text size="xs" c="dimmed" mt="xs">
                    Provides each user access to their home directory
                </Text>
            )}
        </Card>
    );
}

export function SharesTab() {
    const theme = useMantineTheme();
    const [shares, setShares] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
    const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
    const [selectedShare, setSelectedShare] = useState(null);

    const fetchShares = async () => {
        try {
            const response = await fetch('/api/storage/shares', {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });
            const data = await response.json();
            setShares(data.shares || []);
        } catch (err) {
            console.error('Error fetching shares:', err);
            setError('Failed to load shares');
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/storage/shares/users', {
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });
            const data = await response.json();
            setUsers(data.users || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            await Promise.all([fetchShares(), fetchUsers()]);
            setLoading(false);
        };
        loadData();
    }, []);

    const handleCreate = () => {
        setSelectedShare(null);
        openEditModal();
    };

    const handleEdit = (share) => {
        setSelectedShare(share);
        openEditModal();
    };

    const handleDelete = (share) => {
        setSelectedShare(share);
        openDeleteModal();
    };

    const handleSave = async (data) => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const url = selectedShare
                ? `/api/storage/shares/${selectedShare.name}`
                : '/api/storage/shares';

            const method = selectedShare ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to save share');
            }

            setSuccess(result.message);
            closeEditModal();
            await fetchShares();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedShare) return;

        setSaving(true);
        setError(null);

        try {
            const response = await fetch(`/api/storage/shares/${selectedShare.name}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete share');
            }

            setSuccess(result.message);
            closeDeleteModal();
            setSelectedShare(null);
            await fetchShares();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleHomes = async (enabled) => {
        setToggling(true);
        setError(null);

        try {
            const response = await fetch('/api/storage/shares/homes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify({ enabled }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to toggle homes share');
            }

            setSuccess(result.message);
            await fetchShares();
        } catch (err) {
            setError(err.message);
        } finally {
            setToggling(false);
        }
    };

    // Separate homes and custom shares
    const homesShare = shares.find(s => s.name === 'homes');
    const customShares = shares.filter(s => s.name !== 'homes');

    return (
        <Box style={{ position: 'relative' }}>
            <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />

            <Group justify="space-between" mb="lg">
                <Box>
                    <Text size="xl" fw={700}>Samba Shares</Text>
                    <Text size="sm" c="dimmed">
                        Manage network shares for Windows/SMB access
                    </Text>
                </Box>
                <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={handleCreate}
                >
                    New Share
                </Button>
            </Group>

            {error && (
                <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    mb="md"
                    onClose={() => setError(null)}
                    withCloseButton
                >
                    {error}
                </Alert>
            )}

            {success && (
                <Alert
                    icon={<IconCheck size={16} />}
                    color="green"
                    mb="md"
                    onClose={() => setSuccess(null)}
                    withCloseButton
                >
                    {success}
                </Alert>
            )}

            {/* Homes Share Section */}
            {homesShare && (
                <Box mb="xl">
                    <Text size="md" fw={600} mb="sm">Home Directories</Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <ShareCard
                            share={homesShare}
                            onEdit={() => {}}
                            onDelete={() => {}}
                            onToggleHomes={handleToggleHomes}
                            users={users}
                            loadingToggle={toggling}
                        />
                    </SimpleGrid>
                </Box>
            )}

            {/* Custom Shares Section */}
            <Box>
                <Text size="md" fw={600} mb="sm">Custom Shares</Text>
                {customShares.length === 0 ? (
                    <Alert icon={<IconFolderShare size={16} />} color="blue" variant="light">
                        No custom shares configured. Click "New Share" to create one.
                    </Alert>
                ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        {customShares.map((share) => (
                            <ShareCard
                                key={share.name}
                                share={share}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggleHomes={() => {}}
                                users={users}
                                loadingToggle={false}
                            />
                        ))}
                    </SimpleGrid>
                )}
            </Box>

            {/* Edit/Create Modal */}
            <ShareModal
                opened={editModalOpened}
                onClose={closeEditModal}
                onSave={handleSave}
                initialData={selectedShare}
                users={users}
                existingShares={customShares}
                loading={saving}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmModal
                opened={deleteModalOpened}
                onClose={closeDeleteModal}
                onConfirm={handleConfirmDelete}
                shareName={selectedShare?.name}
                loading={saving}
            />
        </Box>
    );
}
