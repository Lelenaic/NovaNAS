import { useState, useEffect } from 'react';
import {
    Box,
    Title,
    Text,
    Group,
    Button,
    Stack,
    Alert,
    Loader,
    Badge,
    Stepper,
    Textarea,
    useMantineTheme,
} from '@mantine/core';
import {
    IconLock,
    IconCheck,
    IconX,
    IconRefresh,
    IconServer,
    IconWorld,
    IconCertificate,
    IconAlertTriangle,
    IconArrowRight,
    IconArrowLeft,
} from '@tabler/icons-react';

export function SslTab() {
    const theme = useMantineTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeStep, setActiveStep] = useState(0);

    const [sslData, setSslData] = useState({
        hostname: null,
        hostname_dyn_dns: null,
        ssl_enabled: false,
        certificate_exists: false,
        certificate_info: null,
    });

    const [reachability, setReachability] = useState(null);
    const [checkingReachability, setCheckingReachability] = useState(false);

    const [issuing, setIssuing] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [enabling, setEnabling] = useState(false);
    const [disabling, setDisabling] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [generatingSelfSigned, setGeneratingSelfSigned] = useState(false);

    const [customCert, setCustomCert] = useState({
        certificate: '',
        private_key: '',
        ca_bundle: '',
    });

    useEffect(() => {
        fetchSslStatus();
    }, []);

    const fetchSslStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/settings/ssl');
            const data = await response.json();
            setSslData(data);
        } catch (err) {
            setError('Failed to load SSL status');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckReachability = async () => {
        setCheckingReachability(true);
        setReachability(null);
        setError(null);

        try {
            const response = await fetch('/api/settings/ssl/check-reachability', {
                method: 'POST',
            });
            const data = await response.json();
            setReachability(data);
        } catch (err) {
            setError('Failed to check reachability');
        } finally {
            setCheckingReachability(false);
        }
    };

    const handleIssueCertificate = async () => {
        setIssuing(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/settings/ssl/issue-certificate', {
                method: 'POST',
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to issue certificate');
            }

            setSuccess(data.message || 'Certificate issued successfully!');
            await fetchSslStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setIssuing(false);
        }
    };

    const handleInstallCertificate = async () => {
        setInstalling(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/settings/ssl/install-certificate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customCert),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to install certificate');
            }

            setSuccess(data.message || 'Certificate installed successfully!');
            setCustomCert({ certificate: '', private_key: '', ca_bundle: '' });
            await fetchSslStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setInstalling(false);
        }
    };

    const handleEnableSsl = async () => {
        setEnabling(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/settings/ssl/enable', {
                method: 'POST',
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to enable SSL');
            }

            setSuccess(data.message || 'SSL enabled successfully!');
            await fetchSslStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setEnabling(false);
        }
    };

    const handleDisableSsl = async () => {
        setDisabling(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/settings/ssl/disable', {
                method: 'POST',
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to disable SSL');
            }

            setSuccess(data.message || 'SSL disabled successfully!');
            await fetchSslStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setDisabling(false);
        }
    };

    const handleDeleteCertificate = async () => {
        setDeleting(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/settings/ssl/certificate', {
                method: 'DELETE',
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete certificate');
            }

            setSuccess(data.message || 'Certificate deleted successfully!');
            await fetchSslStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    const handleGenerateSelfSigned = async () => {
        setGeneratingSelfSigned(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/settings/ssl/generate-self-signed', {
                method: 'POST',
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate self-signed certificate');
            }

            setSuccess(data.message || 'Self-signed certificate generated successfully!');
            await fetchSslStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setGeneratingSelfSigned(false);
        }
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    const cardStyle = {
        backgroundColor: theme.colors.dark[6],
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${theme.colors.dark[4]}`,
    };

    const hostnameSet = !!sslData.hostname;
    const isReachable = reachability?.reachable === true;
    const hasCert = sslData.certificate_exists;

    return (
        <Box>
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={3} c="white">SSL</Title>
                    <Text size="sm" c="dimmed">Set up HTTPS for your NAS</Text>
                </div>
                {sslData.ssl_enabled && (
                    <Badge color="green" variant="light" size="lg">
                        SSL Active
                    </Badge>
                )}
            </Group>

            {error && (
                <Alert
                    color="red"
                    variant="light"
                    mb="md"
                    onClose={() => setError(null)}
                    withCloseButton
                    icon={<IconAlertTriangle size={16} />}
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

            <Stepper active={activeStep} mb="xl" color="blue" size="sm">
                <Stepper.Step
                    label="Hostname"
                    description="Configure hostname"
                    icon={<IconServer size={18} />}
                    completedIcon={<IconCheck size={18} />}
                />
                <Stepper.Step
                    label="Reachability"
                    description="Check internet access"
                    icon={<IconWorld size={18} />}
                    completedIcon={<IconCheck size={18} />}
                />
                <Stepper.Step
                    label="SSL Certificate"
                    description="Issue & enable HTTPS"
                    icon={<IconCertificate size={18} />}
                    completedIcon={<IconCheck size={18} />}
                />
            </Stepper>

            {/* Step 1: Hostname */}
            {activeStep === 0 && (
                <Stack gap="lg">
                    <Box style={cardStyle}>
                        <Group justify="space-between" mb="md">
                            <Title order={5} c="white">Step 1: Set Hostname</Title>
                            {hostnameSet && (
                                <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={14} />}>
                                    Set
                                </Badge>
                            )}
                        </Group>
                        <Text size="sm" c="dimmed" mb="md">
                            A hostname is required for SSL certificates. You can set it in the General tab or by clicking "Set as Hostname" on a DynDNS configuration.
                        </Text>

                        {hostnameSet ? (
                            <Alert color="green" variant="light" mb="md">
                                <Text fw={500}>
                                    Current hostname: {sslData.hostname}
                                </Text>
                                {sslData.hostname_dyn_dns && (
                                    <Text size="sm" c="dimmed">
                                        Set via DynDNS: {sslData.hostname_dyn_dns.full_domain}
                                    </Text>
                                )}
                            </Alert>
                        ) : (
                            <Alert color="yellow" variant="light" mb="md">
                                <Text fw={500}>No hostname configured</Text>
                                <Text size="sm" c="dimmed">
                                    Go to General tab or DynDNS tab to set a hostname.
                                </Text>
                            </Alert>
                        )}

                        <Group justify="flex-end" mt="md">
                            <Button
                                rightSection={<IconArrowRight size={16} />}
                                disabled={!hostnameSet}
                                onClick={() => setActiveStep(1)}
                            >
                                Next
                            </Button>
                        </Group>
                    </Box>
                </Stack>
            )}

            {/* Step 2: Reachability */}
            {activeStep === 1 && (
                <Stack gap="lg">
                    <Box style={cardStyle}>
                        <Group justify="space-between" mb="md">
                            <Title order={5} c="white">Step 2: Check Reachability</Title>
                            {isReachable && (
                                <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={14} />}>
                                    Reachable
                                </Badge>
                            )}
                        </Group>
                        <Text size="sm" c="dimmed" mb="md">
                            Your NAS must be reachable from the internet for Let's Encrypt to issue a certificate.
                            The domain <strong>{sslData.hostname}</strong> will be checked.
                        </Text>

                        <Group mb="md">
                            <Button
                                variant="light"
                                leftSection={<IconRefresh size={16} />}
                                onClick={handleCheckReachability}
                                loading={checkingReachability}
                            >
                                Check Reachability
                            </Button>
                        </Group>

                        {reachability && (
                            <Alert
                                color={reachability.reachable ? 'green' : 'yellow'}
                                variant="light"
                                mb="md"
                                icon={reachability.reachable ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
                            >
                                <Text fw={500}>
                                    {reachability.reachable
                                        ? `Reachable${reachability.ip ? ` (IP: ${reachability.ip})` : ''}`
                                        : 'Not reachable from the internet'}
                                </Text>
                                {!reachability.reachable && (
                                    <Text size="sm" c="dimmed">
                                        Let's Encrypt certificates will not be available. You can use a custom certificate instead.
                                    </Text>
                                )}
                                {reachability.reachable && reachability.message && (
                                    <Text size="sm" c="dimmed">{reachability.message}</Text>
                                )}
                            </Alert>
                        )}

                        <Group justify="space-between" mt="md">
                            <Button
                                variant="subtle"
                                leftSection={<IconArrowLeft size={16} />}
                                onClick={() => setActiveStep(0)}
                            >
                                Back
                            </Button>
                            <Button
                                rightSection={<IconArrowRight size={16} />}
                                onClick={() => setActiveStep(2)}
                            >
                                Next
                            </Button>
                        </Group>
                    </Box>
                </Stack>
            )}

            {/* Step 3: SSL Certificate */}
            {activeStep === 2 && (
                <Stack gap="lg">
                    {/* Current SSL Status */}
                    {sslData.ssl_enabled && (
                        <Box style={cardStyle}>
                            <Group justify="space-between" mb="md">
                                <Title order={5} c="white">SSL Status</Title>
                                <Badge color="green" variant="light" size="lg">
                                    Enabled
                                </Badge>
                            </Group>
                            {hasCert && sslData.certificate_info && (
                                <Stack gap="xs" mb="md">
                                    <Text size="sm" c="dimmed">
                                        Domain: <strong c="white">{sslData.certificate_info.domain}</strong>
                                    </Text>
                                    <Text size="sm" c="dimmed">
                                        Issuer: <strong c="white">{sslData.certificate_info.issuer}</strong>
                                    </Text>
                                    <Text size="sm" c="dimmed">
                                        Expires: <strong c="white">{sslData.certificate_info.expires_at}</strong>
                                    </Text>
                                </Stack>
                            )}
                            <Group gap="sm">
                                <Button
                                    color="red"
                                    variant="light"
                                    leftSection={<IconX size={16} />}
                                    onClick={handleDisableSsl}
                                    loading={disabling}
                                >
                                    Disable SSL
                                </Button>
                                <Button
                                    color="red"
                                    variant="subtle"
                                    leftSection={<IconX size={16} />}
                                    onClick={handleDeleteCertificate}
                                    loading={deleting}
                                >
                                    Delete Certificate
                                </Button>
                            </Group>
                        </Box>
                    )}

                    {/* Let's Encrypt */}
                    <Box style={cardStyle}>
                        <Title order={5} c="white" mb="md">Let's Encrypt (Recommended)</Title>
                        {isReachable ? (
                            <Text size="sm" c="dimmed" mb="md">
                                Request a free SSL certificate from Let's Encrypt via acme.sh.
                                The certificate will be issued and installed automatically.
                            </Text>
                        ) : (
                            <Alert color="yellow" variant="light" mb="md">
                                <Text fw={500}>Let's Encrypt requires the NAS to be reachable from the internet.</Text>
                                <Text size="sm" c="dimmed">
                                    Your NAS is not reachable. Use a custom certificate instead, or fix your network configuration and try again.
                                </Text>
                            </Alert>
                        )}
                        <Group>
                            <Button
                                leftSection={<IconLock size={16} />}
                                onClick={handleIssueCertificate}
                                loading={issuing}
                                disabled={hasCert || !isReachable}
                            >
                                {hasCert ? 'Certificate Already Installed' : 'Request Certificate'}
                            </Button>
                        </Group>
                    </Box>

                    {/* Custom Certificate */}
                    <Box style={cardStyle}>
                        <Title order={5} c="white" mb="md">Custom Certificate</Title>
                        <Text size="sm" c="dimmed" mb="md">
                            Or install your own SSL certificate. Paste your certificate, private key, and optionally a CA bundle in PEM format.
                        </Text>
                        <Stack gap="md">
                            <Textarea
                                label="Certificate (PEM)"
                                placeholder="-----BEGIN CERTIFICATE-----"
                                value={customCert.certificate}
                                onChange={(e) => setCustomCert({ ...customCert, certificate: e.target.value })}
                                minRows={6}
                                required
                                styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
                            />
                            <Textarea
                                label="Private Key (PEM)"
                                placeholder="-----BEGIN PRIVATE KEY-----"
                                value={customCert.private_key}
                                onChange={(e) => setCustomCert({ ...customCert, private_key: e.target.value })}
                                minRows={6}
                                required
                                styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
                            />
                            <Textarea
                                label="CA Bundle (optional, PEM)"
                                placeholder="-----BEGIN CERTIFICATE-----"
                                value={customCert.ca_bundle}
                                onChange={(e) => setCustomCert({ ...customCert, ca_bundle: e.target.value })}
                                minRows={4}
                                styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
                            />
                            <Group>
                                <Button
                                    leftSection={<IconLock size={16} />}
                                    onClick={handleInstallCertificate}
                                    loading={installing}
                                    disabled={!customCert.certificate || !customCert.private_key}
                                >
                                    Install Certificate
                                </Button>
                            </Group>
                        </Stack>
                    </Box>

                    {/* Self-Signed Certificate */}
                    <Box style={cardStyle}>
                        <Title order={5} c="white" mb="md">Self-Signed Certificate</Title>
                        <Alert color="yellow" variant="light" mb="md">
                            <Text fw={500} mb="xs">Not Recommended for Production</Text>
                            <Text size="sm">
                                Self-signed certificates are not trusted by browsers and will show a security warning to users.
                                They are only suitable for testing or internal use where you can manually trust the certificate.
                                This certificate will be valid for 3 months and will be automatically renewed monthly.
                            </Text>
                        </Alert>
                        <Text size="sm" c="dimmed" mb="md">
                            Generate a self-signed certificate using OpenSSL. The certificate will be installed via acme.sh
                            and automatically renewed every month before expiration.
                        </Text>
                        <Group>
                            <Button
                                leftSection={<IconLock size={16} />}
                                onClick={handleGenerateSelfSigned}
                                loading={generatingSelfSigned}
                                disabled={hasCert}
                                color="yellow"
                            >
                                {hasCert ? 'Certificate Already Installed' : 'Generate Self-Signed Certificate'}
                            </Button>
                        </Group>
                    </Box>

                    <Group justify="flex-start" mt="md">
                        <Button
                            variant="subtle"
                            leftSection={<IconArrowLeft size={16} />}
                            onClick={() => setActiveStep(1)}
                        >
                            Back
                        </Button>
                    </Group>
                </Stack>
            )}
        </Box>
    );
}
