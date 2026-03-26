import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    Modal,
    TextInput,
    Stack,
    Switch,
    Badge,
    Loader,
    Alert,
    ActionIcon,
    useMantineTheme,
    Table,
    Tabs,
    Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    IconTrash,
    IconEdit,
    IconUser,
    IconMail,
    IconCopy,
    IconCheck,
    IconX,
    IconUserPlus,
    IconSend,
} from '@tabler/icons-react';

export function UsersTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('users');

    // Invite User Modal
    const [inviteModalOpened, { open: openInviteModal, close: closeInviteModal }] = useDisclosure(false);
    const [inviteForm, setInviteForm] = useState({
        email: '',
        username: '',
        is_admin: false,
    });
    const [inviteError, setInviteError] = useState(null);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [copiedLink, setCopiedLink] = useState(null);
    const [createSuccess, setCreateSuccess] = useState(false);
    const [smtpConfigured, setSmtpConfigured] = useState(false);

    // Edit User Modal
    const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        is_admin: false,
    });
    const [editError, setEditError] = useState(null);
    const [editLoading, setEditLoading] = useState(false);

    // Delete Confirmation
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        fetchUsers();
        fetchInvitations();
        fetchSmtpStatus();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users');
            const data = await response.json();
            setUsers(data.users || []);
        } catch (err) {
            setError('Failed to load users');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvitations = async () => {
        try {
            const response = await fetch('/api/users/pending');
            const data = await response.json();
            setInvitations(data.invitations || []);
        } catch (err) {
            console.error('Failed to load invitations:', err);
        }
    };

    const fetchSmtpStatus = async () => {
        try {
            const response = await fetch('/api/email/status');
            const data = await response.json();
            setSmtpConfigured(data.configured || false);
        } catch (err) {
            console.error('Failed to load SMTP status:', err);
        }
    };

    const handleInviteUser = async (e) => {
        e.preventDefault();
        setInviteError(null);
        setInviteLoading(true);

        try {
            // First create the pending user invitation
            const response = await fetch('/api/users/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(inviteForm),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    const firstErrorKey = Object.keys(data.errors)[0];
                    const firstError = data.errors[firstErrorKey];
                    throw new Error(Array.isArray(firstError) ? firstError[0] : firstError);
                }
                throw new Error(data.message || data.error || 'Failed to invite user');
            }

            // Then send the invitation email
            const emailResponse = await fetch(`/api/users/invitations/${data.invitation.id}/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const emailData = await emailResponse.json();

            if (!emailResponse.ok) {
                throw new Error(emailData.error || 'Invitation created but failed to send email');
            }

            await fetchInvitations();
            closeInviteModal();
            resetInviteForm();
        } catch (err) {
            setInviteError(err.message);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setInviteError(null);
        setCreateLoading(true);
        setCreateSuccess(false);

        try {
            const response = await fetch('/api/users/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(inviteForm),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    const firstErrorKey = Object.keys(data.errors)[0];
                    const firstError = data.errors[firstErrorKey];
                    throw new Error(Array.isArray(firstError) ? firstError[0] : firstError);
                }
                throw new Error(data.message || data.error || 'Failed to create user');
            }

            // Copy invitation link to clipboard
            const invitationUrl = data.invitation.invitation_url || `${window.location.origin}/invitation/${data.invitation.invitation_token}`;
            copyToClipboard(invitationUrl, data.invitation.id);

            setCreateSuccess(true);
            await fetchInvitations();

            // Close modal after a brief delay so user sees the success feedback
            setTimeout(() => {
                closeInviteModal();
                resetInviteForm();
                setCreateSuccess(false);
            }, 1500);
        } catch (err) {
            setInviteError(err.message);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        setEditError(null);
        setEditLoading(true);

        try {
            const response = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editForm),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update user');
            }

            await fetchUsers();
            closeEditModal();
            setEditingUser(null);
        } catch (err) {
            setEditError(err.message);
        } finally {
            setEditLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete user');
            }

            await fetchUsers();
            setDeleteConfirm(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRevokeInvitation = async (invitationId) => {
        try {
            const response = await fetch(`/api/users/invitations/${invitationId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to revoke invitation');
            }

            await fetchInvitations();
        } catch (err) {
            setError(err.message);
        }
    };

    const openEdit = (user) => {
        setEditingUser(user);
        setEditForm({
            name: user.name,
            email: user.email,
            is_admin: user.is_admin,
        });
        setEditError(null);
        openEditModal();
    };

    const resetInviteForm = () => {
        setInviteForm({
            email: '',
            username: '',
            is_admin: false,
        });
        setInviteError(null);
        setCopiedLink(null);
        setCreateSuccess(false);
    };

    const copyToClipboard = (text, id) => {
        // Try using the Clipboard API first, fall back to textarea method
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                setCopiedLink(id);
                setTimeout(() => setCopiedLink(null), 2000);
            }).catch(() => {
                // Fallback if clipboard API fails
                fallbackCopy(text, id);
            });
        } else {
            // Clipboard API not available (HTTP or unsupported browser)
            fallbackCopy(text, id);
        }
    };

    const fallbackCopy = (text, id) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            setCopiedLink(id);
            setTimeout(() => setCopiedLink(null), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
        document.body.removeChild(textArea);
    };

    // Get the default admin user's ID (the first user created - identified by lowest ID)
    // This matches the backend logic in UserController::destroy
    const getFirstUserId = () => {
        if (users.length === 0) return null;
        return Math.min(...users.map(u => u.id));
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <Box>
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={3} c="white">User Management</Title>
                    <Text size="sm" c="dimmed">Manage users and invitations</Text>
                </div>
                <Button
                    leftSection={<IconUserPlus size={16} />}
                    onClick={openInviteModal}
                >
                    Invite User
                </Button>
            </Group>

            {error && (
                <Alert
                    color="red"
                    variant="light"
                    mb="md"
                    onClose={() => setError(null)}
                    withCloseButton
                >
                    {error}
                </Alert>
            )}

            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                    <Tabs.Tab value="users" leftSection={<IconUser size={16} />}>
                        Users ({users.length})
                    </Tabs.Tab>
                    <Tabs.Tab value="invitations" leftSection={<IconMail size={16} />}>
                        Invitations ({invitations.length})
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="users" pt="md">
                    {users.length === 0 ? (
                        <Box
                            style={{
                                backgroundColor: theme.colors.dark[6],
                                borderRadius: '12px',
                                padding: '40px',
                                textAlign: 'center',
                                border: `1px solid ${theme.colors.dark[4]}`,
                            }}
                        >
                            <Group justify="center" mb="md">
                                <IconUser size={48} color="gray" />
                            </Group>
                            <Text c="dimmed" size="lg" mb="md">No users yet</Text>
                            <Button leftSection={<IconUserPlus size={16} />} onClick={openInviteModal}>
                                Invite Your First User
                            </Button>
                        </Box>
                    ) : (
                        <Table
                            striped
                            highlightOnHover
                            withTableBorder
                            withColumnBorders
                            styles={{
                                table: {
                                    backgroundColor: theme.colors.dark[6],
                                },
                                th: {
                                    backgroundColor: theme.colors.dark[5],
                                    color: theme.colors.gray[3],
                                },
                                td: {
                                    borderColor: theme.colors.dark[4],
                                },
                            }}
                        >
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Name</Table.Th>
                                    <Table.Th>Email</Table.Th>
                                    <Table.Th>Username</Table.Th>
                                    <Table.Th>Admin</Table.Th>
                                    <Table.Th>Created</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {users.map((user) => (
                                    <Table.Tr key={user.id}>
                                        <Table.Td>
                                            <Text fw={500} c="white">{user.name}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text c="dimmed">{user.email}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text c="dimmed">{user.username || '-'}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            {user.is_admin ? (
                                                <Badge color="blue" variant="light">Admin</Badge>
                                            ) : (
                                                <Badge color="gray" variant="light">User</Badge>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" c="dimmed">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs">
                                                <Tooltip label="Edit user">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="gray"
                                                        onClick={() => openEdit(user)}
                                                    >
                                                        <IconEdit size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                {user.id === getFirstUserId() ? (
                                                    <Tooltip label="Cannot delete the default admin user">
                                                        <ActionIcon variant="subtle" color="gray" disabled>
                                                            <IconTrash size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip label="Delete user">
                                                        <ActionIcon
                                                            variant="subtle"
                                                            color="red"
                                                            onClick={() => setDeleteConfirm(user.id)}
                                                        >
                                                            <IconTrash size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    )}
                </Tabs.Panel>

                <Tabs.Panel value="invitations" pt="md">
                    {invitations.length === 0 ? (
                        <Box
                            style={{
                                backgroundColor: theme.colors.dark[6],
                                borderRadius: '12px',
                                padding: '40px',
                                textAlign: 'center',
                                border: `1px solid ${theme.colors.dark[4]}`,
                            }}
                        >
                            <Group justify="center" mb="md">
                                <IconMail size={48} color="gray" />
                            </Group>
                            <Text c="dimmed" size="lg" mb="md">No pending invitations</Text>
                            <Button leftSection={<IconUserPlus size={16} />} onClick={openInviteModal}>
                                Invite a User
                            </Button>
                        </Box>
                    ) : (
                        <Stack gap="md">
                            {invitations.map((invitation) => (
                                <Box
                                    key={invitation.id}
                                    style={{
                                        backgroundColor: theme.colors.dark[6],
                                        borderRadius: '12px',
                                        padding: '20px',
                                        border: `1px solid ${theme.colors.dark[4]}`,
                                    }}
                                >
                                    <Group justify="space-between">
                                        <Group gap="md">
                                            <Box
                                                style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '12px',
                                                    backgroundColor: theme.colors.yellow[6],
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <IconMail size={24} color="white" />
                                            </Box>
                                            <div>
                                                <Group gap="sm">
                                                    <Text fw={600} c="white">{invitation.email}</Text>
                                                    {invitation.is_admin && (
                                                        <Badge color="blue" variant="light" size="sm">Admin</Badge>
                                                    )}
                                                </Group>
                                                <Text size="sm" c="dimmed">
                                                    Username: {invitation.username || '-'} • Expires: {new Date(invitation.expires_at).toLocaleString()}
                                                </Text>
                                            </div>
                                        </Group>
                                        <Group gap="sm">
                                            <Button
                                                variant="light"
                                                size="xs"
                                                leftSection={copiedLink === invitation.id ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                                onClick={() => copyToClipboard(
                                                    `${window.location.origin}/invitation/${invitation.invitation_token || ''}`,
                                                    invitation.id
                                                )}
                                            >
                                                {copiedLink === invitation.id ? 'Copied!' : 'Copy Link'}
                                            </Button>
                                            <Tooltip label="Revoke invitation">
                                                <ActionIcon
                                                    variant="subtle"
                                                    color="red"
                                                    onClick={() => handleRevokeInvitation(invitation.id)}
                                                >
                                                    <IconX size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Group>
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Tabs.Panel>
            </Tabs>

            {/* Invite User Modal */}
            <Modal
                opened={inviteModalOpened}
                onClose={closeInviteModal}
                title={<Text fw={600}>Invite User</Text>}
                size="md"
                centered
            >
                <form onSubmit={handleInviteUser}>
                    <Stack gap="md">
                        {inviteError && (
                            <Alert color="red" variant="light">
                                {inviteError}
                            </Alert>
                        )}

                        <TextInput
                            label="Email"
                            placeholder="john@example.com"
                            description="The invitation will be sent to this email"
                            type="email"
                            value={inviteForm.email}
                            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                            required
                        />

                        <TextInput
                            label="Username"
                            placeholder="john"
                            description="Linux username (required)"
                            value={inviteForm.username}
                            onChange={(e) => setInviteForm({ ...inviteForm, username: e.target.value.toLowerCase() })}
                            required
                        />

                        <Switch
                            label="Admin User"
                            description="Admin users can manage the system"
                            checked={inviteForm.is_admin}
                            onChange={(e) => setInviteForm({ ...inviteForm, is_admin: e.target.checked })}
                        />

                        <Group justify="flex-end" mt="md">
                            <Button variant="subtle" onClick={closeInviteModal}>
                                Cancel
                            </Button>
                            <Tooltip
                                label="SMTP is not configured. Configure email settings to enable sending invitations."
                                disabled={smtpConfigured}
                            >
                                <Button
                                    type="submit"
                                    loading={inviteLoading}
                                    disabled={!smtpConfigured}
                                    leftSection={<IconSend size={16} />}
                                >
                                    Send Invitation
                                </Button>
                            </Tooltip>
                            <Tooltip label="Create user and copy invitation link to clipboard">
                                <Button
                                    variant="light"
                                    loading={createLoading}
                                    color={createSuccess ? 'green' : undefined}
                                    leftSection={createSuccess ? <IconCheck size={16} /> : <IconUserPlus size={16} />}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleCreateUser(e);
                                    }}
                                >
                                    {createSuccess ? 'Link Copied!' : 'Create'}
                                </Button>
                            </Tooltip>
                        </Group>
                    </Stack>
                </form>
            </Modal>

            {/* Edit User Modal */}
            <Modal
                opened={editModalOpened}
                onClose={closeEditModal}
                title={<Text fw={600}>Edit User</Text>}
                size="md"
                centered
            >
                <form onSubmit={handleEditUser}>
                    <Stack gap="md">
                        {editError && (
                            <Alert color="red" variant="light">
                                {editError}
                            </Alert>
                        )}

                        <TextInput
                            label="Name"
                            placeholder="John Doe"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            required
                        />

                        <TextInput
                            label="Email"
                            placeholder="john@example.com"
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            required
                        />

                        <TextInput
                            label="Username"
                            value={editingUser?.username || ''}
                            disabled
                            description="Username cannot be changed"
                        />

                        <Switch
                            label="Admin User"
                            description="Admin users can manage the system"
                            checked={editForm.is_admin}
                            onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })}
                        />

                        <Group justify="flex-end" mt="md">
                            <Button variant="subtle" onClick={closeEditModal}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={editLoading}>
                                Save Changes
                            </Button>
                        </Group>
                    </Stack>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                opened={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={<Text fw={600}>Delete User</Text>}
                size="sm"
                centered
            >
                <Text c="dimmed" mb="lg">
                    Are you sure you want to delete this user? This will also remove their Linux user account and home directory. This action cannot be undone.
                </Text>
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={() => setDeleteConfirm(null)}>
                        Cancel
                    </Button>
                    <Button color="red" onClick={() => handleDeleteUser(deleteConfirm)}>
                        Delete
                    </Button>
                </Group>
            </Modal>
        </Box>
    );
}
