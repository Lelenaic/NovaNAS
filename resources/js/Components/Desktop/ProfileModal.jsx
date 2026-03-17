import { useState, useEffect } from 'react';
import {
    Modal,
    TextInput,
    PasswordInput,
    Button,
    Group,
    Stack,
    Text,
    Alert,
    Divider,
} from '@mantine/core';
import { router } from '@inertiajs/react';
import { IconUser, IconLock, IconAlertCircle, IconCheck } from '@tabler/icons-react';

export function ProfileModal({ opened, onClose }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        username: '',
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    // Fetch profile data when modal opens
    useEffect(() => {
        if (opened) {
            fetchProfile();
        }
    }, [opened]);

    const fetchProfile = async () => {
        try {
            const response = await fetch('/api/profile');
            const data = await response.json();
            if (data.user) {
                setFormData((prev) => ({
                    ...prev,
                    name: data.user.name || '',
                    email: data.user.email || '',
                    username: data.user.username || '',
                }));
            }
        } catch (err) {
            setError('Failed to load profile data');
        }
    };

    const handleChange = (field) => (event) => {
        setFormData((prev) => ({
            ...prev,
            [field]: event.target.value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    const firstError = Object.values(data.errors)[0];
                    throw new Error(firstError[0]);
                }
                throw new Error(data.message || 'Failed to update profile');
            }

            setSuccess('Profile updated successfully');
            setFormData((prev) => ({
                ...prev,
                current_password: '',
                password: '',
                password_confirmation: '',
            }));

            // Use Inertia's router to reload page data without full refresh
            router.reload();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setSuccess(null);
        setFormData((prev) => ({
            ...prev,
            current_password: '',
            password: '',
            password_confirmation: '',
        }));
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title={<Text fw={600}>Edit Profile</Text>}
            size="md"
            centered
        >
            <form onSubmit={handleSubmit}>
                <Stack gap="md">
                    {error && (
                        <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
                            {error}
                        </Alert>
                    )}

                    {success && (
                        <Alert icon={<IconCheck size={16} />} color="green" onClose={() => setSuccess(null)} withCloseButton>
                            {success}
                        </Alert>
                    )}

                    <TextInput
                        label="Username"
                        value={formData.username}
                        disabled
                        description="Username cannot be changed"
                        leftSection={<IconUser size={16} />}
                    />

                    <TextInput
                        label="Name"
                        value={formData.name}
                        onChange={handleChange('name')}
                        required
                        leftSection={<IconUser size={16} />}
                    />

                    <TextInput
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange('email')}
                        required
                        leftSection={<IconUser size={16} />}
                    />

                    <Divider label="Change Password" labelPosition="center" my="sm" />

                    <PasswordInput
                        label="Current Password"
                        value={formData.current_password}
                        onChange={handleChange('current_password')}
                        description="Required only if changing password"
                        leftSection={<IconLock size={16} />}
                    />

                    <PasswordInput
                        label="New Password"
                        value={formData.password}
                        onChange={handleChange('password')}
                        description="Leave blank to keep current password"
                        leftSection={<IconLock size={16} />}
                    />

                    <PasswordInput
                        label="Confirm New Password"
                        value={formData.password_confirmation}
                        onChange={handleChange('password_confirmation')}
                        leftSection={<IconLock size={16} />}
                    />

                    <Group justify="flex-end" mt="md">
                        <Button variant="subtle" onClick={handleClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={loading}>
                            Save Changes
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}
