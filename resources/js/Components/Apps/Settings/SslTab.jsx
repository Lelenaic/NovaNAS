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
    Modal,
    Checkbox,
    Tooltip,
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
    IconShield,
} from '@tabler/icons-react';

function ReachabilityAlert({ reachability, hostname }) {
    if (!reachability) {
        return null;
    }

    return (
        <Alert
            color={reachability.reachable ? 'green' : 'yellow'}
            variant="light"
            mb="md"
            icon={reachability.reachable ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
        >
            <Text fw={500}>
                {reachability.reachable
                    ? `Reachable${reachability.ip ? ` (IP: ${reachability.ip})` : ''}`
                    : reachability.ip === null
                        ? 'Hostname cannot be resolved'
                        : 'Not reachable from the internet'}
            </Text>
            {!reachability.reachable && reachability.ip === null && (
                <Text size="sm" mt={4}>
                    The hostname <strong>{hostname}</strong> cannot be resolved by the public DNS server. Verify that your hostname is correct and that its DNS records (e.g. an A record pointing to your public IP) are properly configured. Once the DNS records resolve correctly, re-run the check.
                </Text>
            )}
            {!reachability.reachable && reachability.ip !== null && (
                <Text size="sm" mt={4}>
                    Let's Encrypt certificates will not be available. You can use a custom certificate instead.
                </Text>
            )}
            {reachability.reachable && reachability.message && (
                <Text size="sm" mt={4}>{reachability.message}</Text>
            )}
        </Alert>
    );
}

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

    const [enableModalOpen, setEnableModalOpen] = useState(false);
    const [enablePortStatus, setEnablePortStatus] = useState(null);
    const [enableForceHttps, setEnableForceHttps] = useState(true);
    const [deleteDisabledModalOpen, setDeleteDisabledModalOpen] = useState(false);

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

            // If a certificate is already issued, jump straight to the certificate step.
            setActiveStep(data.certificate_exists ? 2 : 0);
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

            setSuccess(data.message || 'Certificate saved successfully!');
            setCustomCert({ certificate: '', private_key: '', ca_bundle: '' });
            await fetchSslStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setInstalling(false);
        }
    };

    const handleEnableSsl = async () => {
        try {
            const response = await fetch('/api/settings/ssl/firewall-port');
            const data = await response.json();
            setEnablePortStatus(data);
            // Cancel out of HTTP->HTTPS redirect if port 443 is not open (and firewall is active).
            setEnableForceHttps(data.open);
        } catch (err) {
            setEnablePortStatus({ open: true, firewall_active: false });
        }
        setEnableModalOpen(true);
    };

    const confirmEnableSsl = async () => {
        setEnabling(true);
        setError(null);
        setSuccess(null);
        setEnableModalOpen(false);

        try {
            const response = await fetch('/api/settings/ssl/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force_https: enableForceHttps }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to enable SSL');
            }

            if (enableForceHttps) {
                // With HTTP->HTTPS redirect active, reload on the HTTPS page
                // instead of refreshing status over HTTP (which would be redirected).
                window.location.href = window.location.href.replace(/^http:/, 'https:');
                return;
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
    const redirectLocked = enablePortStatus?.firewall_active && !enablePortStatus?.open;

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

            <Modal
                opened={enableModalOpen}
                onClose={() => setEnableModalOpen(false)}
                title="Enable SSL"
                centered
            >
                <Text size="sm" mb="md">
                    Enable HTTPS on this NAS using the installed certificate?
                </Text>
                {redirectLocked && (
                    <Alert color="yellow" variant="light" mb="md" icon={<IconAlertTriangle size={16} />}>
                        <Text fw={500}>Port 443 is not open in the firewall</Text>
                        <Text size="sm" mt={4}>
                            Redirecting HTTP to HTTPS requires port 443/tcp to be reachable. Open this port in the
                            firewall first if you want to force redirects.
                        </Text>
                    </Alert>
                )}
                <Checkbox
                    label="Force redirect HTTP to HTTPS"
                    description="All HTTP traffic on port 80 will be redirected to HTTPS."
                    checked={enableForceHttps}
                    onChange={(e) => setEnableForceHttps(e.currentTarget.checked)}
                    disabled={redirectLocked}
                    mb="md"
                />
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={() => setEnableModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={confirmEnableSsl} loading={enabling} leftSection={<IconShield size={16} />}>
                        Enable SSL
                    </Button>
                </Group>
            </Modal>

            <Modal
                opened={deleteDisabledModalOpen}
                onClose={() => setDeleteDisabledModalOpen(false)}
                title="Delete Certificate Unavailable"
                centered
            >
                <Text size="sm">
                    You cannot delete the certificate while SSL is enabled, because Apache is currently using it to
                    serve HTTPS traffic.
                </Text>
                <Text size="sm" mt="md" c="dimmed">
                    Click <strong>Disable SSL</strong> first, then you'll be able to delete the certificate.
                </Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="light" onClick={() => setDeleteDisabledModalOpen(false)}>
                        Got it
                    </Button>
                </Group>
            </Modal>

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

                        {reachability && <ReachabilityAlert reachability={reachability} hostname={sslData.hostname} />}

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
                    {/* Current Certificate (always shown when one exists) */}
                    {hasCert && (
                        <Box style={cardStyle}>
                            <Group justify="space-between" mb="md">
                                <Title order={5} c="white">Current Certificate</Title>
                                <Badge color={sslData.ssl_enabled ? 'green' : 'yellow'} variant="light" size="lg">
                                    {sslData.ssl_enabled ? 'SSL Enabled' : 'Saved, not active'}
                                </Badge>
                            </Group>
                            {sslData.certificate_info && (
                                <Stack gap="xs" mb="md">
                                    <Text size="sm">
                                        Domain: <strong c="white">{sslData.certificate_info.domain}</strong>
                                    </Text>
                                    <Text size="sm">
                                        Issuer: <strong c="white">{sslData.certificate_info.issuer}</strong>
                                    </Text>
                                    <Text size="sm">
                                        Expires: <strong c="white">{sslData.certificate_info.expires_at}</strong>
                                    </Text>
                                </Stack>
                            )}
                            <Text size="sm" c="dimmed" mb="md">
                                A certificate is already saved, so the generation options below are disabled to avoid replacing it.
                                If you need a different certificate, delete this one first. Note: SSL is not active until you click Enable SSL.
                            </Text>
                            <Group gap="sm">
                                {!sslData.ssl_enabled && (
                                    <Button
                                        variant="light"
                                        leftSection={<IconShield size={16} />}
                                        onClick={handleEnableSsl}
                                        loading={enabling}
                                    >
                                        Enable SSL
                                    </Button>
                                )}
                                {sslData.ssl_enabled && (
                                    <Button
                                        color="red"
                                        variant="light"
                                        leftSection={<IconX size={16} />}
                                        onClick={handleDisableSsl}
                                        loading={disabling}
                                    >
                                        Disable SSL
                                    </Button>
                                )}
                                <Box
                                    onClick={() => sslData.ssl_enabled && setDeleteDisabledModalOpen(true)}
                                    className={sslData.ssl_enabled ? 'novanas-delete-disabled' : undefined}
                                    style={sslData.ssl_enabled ? { cursor: 'not-allowed' } : undefined}
                                >
                                    <Tooltip
                                        label="Disable SSL first to delete the certificate"
                                        disabled={!sslData.ssl_enabled}
                                        withArrow
                                    >
                                        <Button
                                            color="red"
                                            variant="subtle"
                                            leftSection={<IconX size={16} />}
                                            onClick={handleDeleteCertificate}
                                            loading={deleting}
                                            disabled={sslData.ssl_enabled}
                                        >
                                            Delete Certificate
                                        </Button>
                                    </Tooltip>
                                </Box>
                            </Group>
                        </Box>
                    )}

                    {/* Let's Encrypt */}
                    <Box style={cardStyle}>
                        <Title order={5} c="white" mb="md">Let's Encrypt (Recommended)</Title>
                        <Text size="sm" c="dimmed" mb="md">
                            Request a free SSL certificate from Let's Encrypt via acme.sh.
                            The certificate will be issued and saved automatically. Click Enable SSL to activate HTTPS.
                        </Text>
                        <ReachabilityAlert reachability={reachability} hostname={sslData.hostname} />
                        <Group>
                            <Button
                                leftSection={<IconLock size={16} />}
                                onClick={handleIssueCertificate}
                                loading={issuing}
                                disabled={hasCert || !isReachable}
                            >
                                {hasCert ? 'Certificate Already Saved' : 'Request Certificate'}
                            </Button>
                            <Button
                                variant="light"
                                leftSection={<IconRefresh size={16} />}
                                onClick={handleCheckReachability}
                                loading={checkingReachability}
                            >
                                Check Reachability
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
                                    Save Certificate
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
                            Generate a self-signed certificate using OpenSSL. The certificate will be saved via acme.sh
                            and automatically renewed every month before expiration. Click Enable SSL to activate HTTPS.
                        </Text>
                        <Group>
                            <Button
                                leftSection={<IconLock size={16} />}
                                onClick={handleGenerateSelfSigned}
                                loading={generatingSelfSigned}
                                disabled={hasCert}
                                color="yellow"
                            >
                                {hasCert ? 'Certificate Already Saved' : 'Generate Self-Signed Certificate'}
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
