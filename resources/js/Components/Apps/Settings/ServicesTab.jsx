import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Stack,
    Switch,
    Alert,
    Loader,
    useMantineTheme,
    Badge,
} from '@mantine/core';
import {
    IconCheck,
    IconX,
    IconAlertCircle,
    IconShieldLock,
} from '@tabler/icons-react';

export function ServicesTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [services, setServices] = useState([]);

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/services');
            const data = await response.json();

            setServices(data.services || []);
        } catch (err) {
            setError('Failed to load services');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (serviceId, currentEnabled) => {
        setError(null);
        setSuccess(null);

        const newEnabledState = !currentEnabled;

        try {
            setSaving(true);
            const response = await fetch('/api/services/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ service_id: serviceId, enabled: newEnabledState }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Failed to ${newEnabledState ? 'enable' : 'disable'} service`);
            }

            setSuccess(`${newEnabledState ? 'Enabled' : 'Disabled'} successfully!`);
            setTimeout(() => setSuccess(null), 3000);

            // Refresh services list
            await fetchServices();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
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
                    <Title order={3} c="white">Services</Title>
                    <Text size="sm" c="dimmed">Enable or disable system services</Text>
                </div>
            </Group>

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

            {success && (
                <Alert
                    color="green"
                    variant="light"
                    mb="md"
                    onClose={() => setSuccess(null)}
                    withCloseButton
                    icon={<IconCheck size={16} />}
                >
                    {success}
                </Alert>
            )}

            <Stack gap="md">
                {services.map((service) => (
                    <Box
                        key={service.id}
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Group justify="space-between">
                            <div>
                                <Group gap="sm" mb="xs">
                                    <Title order={5} c="white">{service.name}</Title>
                                    <Badge
                                        color={service.enabled ? 'green' : 'gray'}
                                        variant="light"
                                        leftSection={service.enabled ? <IconCheck size={12} /> : <IconX size={12} />}
                                    >
                                        {service.enabled ? 'Enabled' : 'Disabled'}
                                    </Badge>
                                    <Badge
                                        color={service.active ? 'blue' : 'orange'}
                                        variant="light"
                                        leftSection={service.active ? <IconCheck size={12} /> : <IconX size={12} />}
                                    >
                                        {service.active ? 'Running' : 'Stopped'}
                                    </Badge>
                                </Group>
                                <Text size="sm" c="dimmed">
                                    {service.description}
                                </Text>
                            </div>

                            <Switch
                                checked={service.enabled}
                                onChange={() => handleToggle(service.id, service.enabled)}
                                disabled={saving}
                                size="md"
                                color="green"
                                label={service.enabled ? 'On' : 'Off'}
                                styles={{
                                    label: {
                                        fontWeight: 500,
                                    },
                                }}
                            />
                        </Group>
                    </Box>
                ))}
            </Stack>

            <Alert
                color="blue"
                variant="light"
                mt="lg"
                icon={<IconShieldLock size={16} />}
            >
                <Text size="sm">
                    Enabling a service will start it immediately and configure it to start on boot.
                    Disabling will stop the service and prevent it from starting on boot.
                </Text>
            </Alert>
        </Box>
    );
}
