import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    NumberInput,
    Stack,
    Alert,
    Loader,
    Radio,
    Checkbox,
    useMantineTheme,
    Card,
    Badge,
    Divider,
    SimpleGrid,
    Progress,
} from '@mantine/core';
import {
    IconPlug,
    IconRefresh,
    IconCheck,
    IconAlertTriangle,
    IconBattery,
} from '@tabler/icons-react';

const VITAL_POLL_INTERVAL = 10000;

export function UpsTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [refreshingVitals, setRefreshingVitals] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [devices, setDevices] = useState([]);
    const [config, setConfig] = useState({
        selected_device: null,
        shutdown_mode: 'battery',
        shutdown_battery_pct: 15,
        shutdown_minutes: 5,
        cancel_on_power_return: true,
    });
    const [deviceStatus, setDeviceStatus] = useState(null);
    const [serviceStatus, setServiceStatus] = useState({ enabled: false, active: false });
    const pollRef = useRef(null);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/settings/ups');
            const data = await response.json();

            setConfig(data.config);
            setDeviceStatus(data.status);
            setServiceStatus(data.service_status);
        } catch (err) {
            setError('Failed to load UPS settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const detectDevices = useCallback(async () => {
        try {
            setDetecting(true);
            setError(null);
            const response = await fetch('/api/settings/ups/detect');
            const data = await response.json();
            setDevices(data.devices);
        } catch (err) {
            setError('Failed to detect UPS devices');
            console.error(err);
        } finally {
            setDetecting(false);
        }
    }, []);

    const refreshVitals = useCallback(async () => {
        if (!config.selected_device || !serviceStatus.enabled) return;

        try {
            setRefreshingVitals(true);
            const response = await fetch('/api/settings/ups');
            const data = await response.json();
            setDeviceStatus(data.status);
            setServiceStatus(data.service_status);
        } catch (err) {
            console.error('Failed to refresh UPS vitals', err);
        } finally {
            setRefreshingVitals(false);
        }
    }, [config.selected_device, serviceStatus.enabled]);

    useEffect(() => {
        fetchSettings();
        detectDevices();
    }, [fetchSettings, detectDevices]);

    // Poll vitals when config is active
    useEffect(() => {
        if (serviceStatus.enabled && config.selected_device) {
            pollRef.current = setInterval(refreshVitals, VITAL_POLL_INTERVAL);

            return () => clearInterval(pollRef.current);
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, [serviceStatus.enabled, config.selected_device, refreshVitals]);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const saveResponse = await fetch('/api/settings/ups', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            const saveData = await saveResponse.json();

            if (!saveResponse.ok) {
                throw new Error(saveData.message || 'Failed to save UPS settings');
            }

            const applyResponse = await fetch('/api/settings/ups/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const applyData = await applyResponse.json();

            if (!applyResponse.ok) {
                throw new Error(applyData.message || 'Failed to apply UPS configuration');
            }

            setConfig(saveData.config);
            setSuccess(applyData.message || 'UPS configuration saved and applied successfully.');
            setTimeout(() => setSuccess(null), 3000);

            const statusResponse = await fetch('/api/settings/ups');
            const statusData = await statusResponse.json();
            setServiceStatus(statusData.service_status);
            setDeviceStatus(statusData.status);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const getDeviceDisplayName = (device) => {
        const parts = [device.vendor, device.product].filter(Boolean);
        return parts.length > 0 ? parts.join(' - ') : device.id;
    };

    const isOnline = deviceStatus?.['ups.status']?.includes('OL');
    const batteryCharge = deviceStatus?.['battery.charge'] ? parseFloat(deviceStatus['battery.charge']) : null;
    const inputVoltage = deviceStatus?.['input.voltage'] ?? null;
    const outputVoltage = deviceStatus?.['output.voltage'] ?? null;
    const batteryRuntime = deviceStatus?.['battery.runtime'] ?? null;
    const batteryVoltage = deviceStatus?.['battery.voltage'] ?? null;
    const upsLoad = deviceStatus?.['ups.load'] ?? null;
    const upsModel = deviceStatus?.['ups.model'] ?? null;
    const upsManufacturer = deviceStatus?.['ups.mfr'] ?? null;

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
                    <Title order={3} c="white">UPS Settings</Title>
                    <Text size="sm" c="dimmed">Configure and manage your UPS device</Text>
                </div>
                <Button
                    variant="light"
                    leftSection={<IconRefresh size={16} />}
                    onClick={detectDevices}
                    loading={detecting}
                >
                    Refresh
                </Button>
            </Group>

            <Stack gap="lg">
                {/* Service Status */}
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group justify="space-between" mb="md">
                        <Title order={5} c="white">NUT Service Status</Title>
                        <Group gap="xs">
                            <Badge color={serviceStatus.enabled ? 'green' : 'gray'} variant="light">
                                {serviceStatus.enabled ? (serviceStatus.active ? 'Running' : 'Enabled') : 'Disabled'}
                            </Badge>
                        </Group>
                    </Group>
                    <Text size="sm" c="dimmed">
                        NUT services must be enabled for UPS monitoring.
                    </Text>
                </Box>

                {/* Blocked state when NUT services are disabled */}
                {!serviceStatus.enabled && (
                    <Alert
                        color="yellow"
                        variant="light"
                        icon={<IconAlertTriangle size={16} />}
                    >
                        <Text size="sm" fw={700} mb={4}>
                            NUT service is not enabled
                        </Text>
                        <Text size="sm" c="white">
                            To configure your UPS, go to the{' '}
                            <Text component="span" fw={600} c="white">Services</Text>{' '}
                            tab and enable{' '}
                            <Text component="span" fw={600} c="white">NUT (UPS)</Text>.
                            NUT (Network UPS Tools) is required for UPS monitoring and automatic shutdown.
                        </Text>
                    </Alert>
                )}

                {/* Detected Devices */}
                {serviceStatus.enabled && (
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '12px',
                        padding: '20px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group justify="space-between" mb="md">
                        <div>
                            <Title order={5} c="white">Detected UPS Devices</Title>
                            <Text size="sm" c="dimmed">
                                {devices.length > 0
                                    ? `${devices.length} device(s) found via USB scan`
                                    : 'No UPS devices detected. Connect a UPS and click Refresh.'}
                            </Text>
                        </div>
                    </Group>

                    {devices.length > 0 ? (
                        <Radio.Group
                            value={config.selected_device}
                            onChange={(value) => setConfig({ ...config, selected_device: value })}
                        >
                            <Stack gap="sm">
                                {devices.map((device) => (
                                    <Card
                                        key={device.id}
                                        style={{
                                            backgroundColor: theme.colors.dark[5],
                                            border: `1px solid ${
                                                config.selected_device === device.id
                                                    ? theme.colors.blue[5]
                                                    : theme.colors.dark[4]
                                            }`,
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => setConfig({ ...config, selected_device: device.id })}
                                    >
                                        <Radio
                                            value={device.id}
                                            label={
                                                <Group justify="space-between" style={{ width: '100%' }}>
                                                    <div>
                                                        <Text size="sm" fw={500} c="white">
                                                            {getDeviceDisplayName(device)}
                                                        </Text>
                                                        <Text size="xs" c="dimmed">
                                                            Driver: {device.driver} | Serial: {device.serial || 'N/A'}
                                                        </Text>
                                                    </div>
                                                </Group>
                                            }
                                        />
                                    </Card>
                                ))}
                            </Stack>
                        </Radio.Group>
                    ) : (
                        <Text size="sm" c="dimmed" ta="center" py="md">
                            {detecting ? 'Scanning USB bus...' : 'No UPS devices found.'}
                        </Text>
                    )}
                </Box>
                )}

                {/* UPS Vitals */}
                {serviceStatus.enabled && config.selected_device && (
                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Group justify="space-between" mb="md">
                            <Group gap="sm">
                                <Title order={5} c="white">UPS Vitals</Title>
                                {deviceStatus && Object.keys(deviceStatus).length > 0 ? (
                                    <Badge
                                        color={isOnline ? 'green' : 'yellow'}
                                        variant="light"
                                        leftSection={<IconPlug size={12} />}
                                    >
                                        {isOnline ? 'On Line' : 'On Battery'}
                                    </Badge>
                                ) : (
                                    <Badge color="gray" variant="light">
                                        Waiting for data...
                                    </Badge>
                                )}
                            </Group>
                            <Button
                                variant="subtle"
                                size="compact-sm"
                                leftSection={<IconRefresh size={14} />}
                                onClick={refreshVitals}
                                loading={refreshingVitals}
                            >
                                Refresh
                            </Button>
                        </Group>

                        {deviceStatus && Object.keys(deviceStatus).length > 0 ? (
                            <Stack gap="md">
                                {/* Battery */}
                                {batteryCharge !== null && (
                                    <Box>
                                        <Group justify="space-between" mb={4}>
                                            <Text size="sm" fw={500} c="white">
                                                <IconBattery size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                Battery
                                            </Text>
                                            <Text size="sm" fw={600} c="white">{batteryCharge}%</Text>
                                        </Group>
                                        <Progress
                                            value={batteryCharge}
                                            color={batteryCharge > 50 ? 'green' : batteryCharge > 20 ? 'yellow' : 'red'}
                                            size="lg"
                                            radius="sm"
                                        />
                                    </Box>
                                )}

                                {/* Power info grid */}
                                <SimpleGrid cols={3}>
                                    <Card style={{ backgroundColor: theme.colors.dark[5] }}>
                                        <Text size="xs" c="dimmed" mb={4}>Input Voltage</Text>
                                        <Text size="lg" fw={600} c="white">
                                            {inputVoltage ? `${inputVoltage}V` : 'N/A'}
                                        </Text>
                                    </Card>
                                    <Card style={{ backgroundColor: theme.colors.dark[5] }}>
                                        <Text size="xs" c="dimmed" mb={4}>Output Voltage</Text>
                                        <Text size="lg" fw={600} c="white">
                                            {outputVoltage ? `${outputVoltage}V` : 'N/A'}
                                        </Text>
                                    </Card>
                                    <Card style={{ backgroundColor: theme.colors.dark[5] }}>
                                        <Text size="xs" c="dimmed" mb={4}>Load</Text>
                                        <Text size="lg" fw={600} c="white">
                                            {upsLoad ? `${upsLoad}%` : 'N/A'}
                                        </Text>
                                    </Card>
                                </SimpleGrid>

                                <SimpleGrid cols={3}>
                                    <Card style={{ backgroundColor: theme.colors.dark[5] }}>
                                        <Text size="xs" c="dimmed" mb={4}>Battery Voltage</Text>
                                        <Text size="lg" fw={600} c="white">
                                            {batteryVoltage ? `${batteryVoltage}V` : 'N/A'}
                                        </Text>
                                    </Card>
                                    <Card style={{ backgroundColor: theme.colors.dark[5] }}>
                                        <Text size="xs" c="dimmed" mb={4}>Runtime Left</Text>
                                        <Text size="lg" fw={600} c="white">
                                            {batteryRuntime ? `${Math.round(batteryRuntime / 60)} min` : 'N/A'}
                                        </Text>
                                    </Card>
                                    <Card style={{ backgroundColor: theme.colors.dark[5] }}>
                                        <Text size="xs" c="dimmed" mb={4}>Model</Text>
                                        <Text size="sm" fw={500} c="white" truncate="end">
                                            {upsModel || upsManufacturer || 'N/A'}
                                        </Text>
                                    </Card>
                                </SimpleGrid>
                            </Stack>
                        ) : (
                            <Text size="sm" c="dimmed" ta="center" py="md">
                                {refreshingVitals ? 'Connecting to UPS...' : 'Unable to read UPS data. Check that the UPS is connected.'}
                            </Text>
                        )}
                    </Box>
                )}

                {/* Shutdown Configuration */}
                {serviceStatus.enabled && config.selected_device && (
                    <Box
                        style={{
                            backgroundColor: theme.colors.dark[6],
                            borderRadius: '12px',
                            padding: '20px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                        }}
                    >
                        <Title order={5} c="white" mb="md">Shutdown Configuration</Title>
                        <Text size="sm" c="dimmed" mb="lg">
                            Configure when the system should automatically shut down during a power outage.
                        </Text>

                        <Stack gap="lg">
                            <Radio.Group
                                value={config.shutdown_mode}
                                onChange={(value) => setConfig({ ...config, shutdown_mode: value })}
                                label="Shutdown Trigger"
                                description="Choose when to initiate shutdown during a power outage"
                            >
                                <Stack gap="sm" mt="sm">
                                    <Radio
                                        value="battery"
                                        label={
                                            <div>
                                                <Text size="sm" fw={500} c="white">When battery is low</Text>
                                                <Text size="xs" c="dimmed">
                                                    Shut down when battery charge drops below a percentage
                                                </Text>
                                            </div>
                                        }
                                    />
                                    <Radio
                                        value="time"
                                        label={
                                            <div>
                                                <Text size="sm" fw={500} c="white">After a set time</Text>
                                                <Text size="xs" c="dimmed">
                                                    Shut down after being on battery for a number of minutes
                                                </Text>
                                            </div>
                                        }
                                    />
                                </Stack>
                            </Radio.Group>

                            {config.shutdown_mode === 'battery' ? (
                                <NumberInput
                                    label="Battery Percentage Threshold"
                                    description="Shut down when battery charge drops below this level"
                                    value={config.shutdown_battery_pct}
                                    onChange={(value) => setConfig({ ...config, shutdown_battery_pct: value || 15 })}
                                    min={5}
                                    max={100}
                                    suffix="%"
                                    required
                                />
                            ) : (
                                <NumberInput
                                    label="Time on Battery (minutes)"
                                    description="Shut down after being on battery for this many minutes"
                                    value={config.shutdown_minutes}
                                    onChange={(value) => setConfig({ ...config, shutdown_minutes: value || 5 })}
                                    min={1}
                                    max={60}
                                    suffix=" min"
                                    required
                                />
                            )}

                            <Divider />

                            <Checkbox
                                checked={config.cancel_on_power_return}
                                onChange={(e) => setConfig({ ...config, cancel_on_power_return: e.currentTarget.checked })}
                                label={
                                    <div>
                                        <Text size="sm" fw={500} c="white">Cancel shutdown if power returns</Text>
                                        <Text size="xs" c="dimmed">
                                            When checked, a scheduled shutdown is cancelled if AC power is restored.
                                            {config.cancel_on_power_return
                                                ? ''
                                                : ' Currently, shutdown will proceed even if power returns.'}
                                        </Text>
                                    </div>
                                }
                            />
                        </Stack>
                    </Box>
                )}

                {/* Action Buttons */}
                {serviceStatus.enabled && config.selected_device && (
                    <>
                        {error && (
                            <Alert
                                color="red"
                                variant="light"
                                onClose={() => setError(null)}
                                withCloseButton
                            >
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert
                                color="green"
                                variant="light"
                                onClose={() => setSuccess(null)}
                                withCloseButton
                                icon={<IconCheck size={16} />}
                            >
                                {success}
                            </Alert>
                        )}

                        <Group justify="flex-end">
                            <Button
                                loading={saving}
                                onClick={handleSave}
                                leftSection={<IconPlug size={16} />}
                            >
                                Save &amp; Apply
                            </Button>
                        </Group>
                    </>
                )}

                {/* No device selected warning */}
                {serviceStatus.enabled && !config.selected_device && devices.length > 0 && (
                    <Alert
                        color="yellow"
                        variant="light"
                        icon={<IconAlertTriangle size={16} />}
                    >
                        Select a UPS device above to configure shutdown settings.
                    </Alert>
                )}
            </Stack>
        </Box>
    );
}
