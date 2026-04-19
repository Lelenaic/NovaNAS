import {
    Box,
    Button,
    Checkbox,
    Container,
    Group,
    Paper,
    PasswordInput,
    Stack,
    Text,
    TextInput,
    Title,
    rem,
    Alert,
} from '@mantine/core';
import { IconLock, IconMail, IconCheck } from '@tabler/icons-react';
import { useForm } from '@inertiajs/react';

export default function Login({ version, errors, passwordSet }) {
    const { data, setData, post, processing } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <Box
            style={{
                minHeight: '100vh',
                width: '100%',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {/* Background Image with Overlay */}
            <Box
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'url(/images/login-bg.jpeg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            />

            {/* Dark Overlay */}
            <Box
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(20, 25, 40, 0.9) 100%)',
                    backdropFilter: 'blur(8px)',
                }}
            />

            {/* Animated Background Elements */}
            <Box
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                }}
            >
                <Box
                    style={{
                        position: 'absolute',
                        top: '10%',
                        left: '10%',
                        width: '300px',
                        height: '300px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(32, 153, 240, 0.15) 0%, transparent 70%)',
                        animation: 'float 8s ease-in-out infinite',
                    }}
                />
                <Box
                    style={{
                        position: 'absolute',
                        bottom: '20%',
                        right: '15%',
                        width: '400px',
                        height: '400px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(21, 101, 192, 0.12) 0%, transparent 70%)',
                        animation: 'float 10s ease-in-out infinite reverse',
                    }}
                />
                <Box
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '500px',
                        height: '500px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(13, 71, 161, 0.08) 0%, transparent 70%)',
                        transform: 'translate(-50%, -50%)',
                        animation: 'pulse 15s ease-in-out infinite',
                    }}
                />
            </Box>

            {/* Login Form */}
            <Container size={500} style={{ position: 'relative', zIndex: 1, width: '500px', maxWidth: '500px' }}>
                <Paper
                    shadow="xl"
                    radius="lg"
                    p={rem(50)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        width: '100%',
                        maxWidth: '500px',
                        minHeight: '500px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                    }}
                >
                    <Stack align="center" gap="xs">
                        {/* Logo/Icon */}
                        <img src="/images/logo.png" alt="NovaNAS" style={{ height: '50px' }} />
                        <Text c="dimmed" size="sm" ta="center" maw={280}>
                            Your personal cloud storage solution
                        </Text>
                    </Stack>

                    <form onSubmit={handleSubmit}>
                        <Stack mt={rem(32)} gap="md">
                            {passwordSet && (
                                <Alert
                                    color="green"
                                    variant="light"
                                    icon={<IconCheck size={16} />}
                                >
                                    Password set successfully. You can now log in.
                                </Alert>
                            )}
                            <TextInput
                                size="md"
                                placeholder="Email"
                                name="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                leftSection={<IconMail size={18} stroke={1.5} />}
                                error={errors?.email}
                                style={{ width: '100%' }}
                                styles={{
                                    input: {
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        '&::placeholder': {
                                            color: 'rgba(255, 255, 255, 0.4)',
                                        },
                                        '&:focus': {
                                            borderColor: '#2099f0',
                                        },
                                    },
                                }}
                                required
                            />

                            <PasswordInput
                                size="md"
                                placeholder="Password"
                                name="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                leftSection={<IconLock size={18} stroke={1.5} />}
                                error={errors?.password}
                                style={{ width: '100%' }}
                                styles={{
                                    input: {
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        '&::placeholder': {
                                            color: 'rgba(255, 255, 255, 0.4)',
                                        },
                                        '&:focus': {
                                            borderColor: '#2099f0',
                                        },
                                    },
                                }}
                                required
                            />

                            <Group justify="space-between">
                                <Checkbox
                                    label="Remember me"
                                    size="xs"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    styles={{
                                        label: {
                                            color: 'rgba(255, 255, 255, 0.6)',
                                        },
                                    }}
                                />
                                <Text
                                    size="xs"
                                    c="blue"
                                    style={{ cursor: 'pointer' }}
                                >
                                    Forgot password?
                                </Text>
                            </Group>

                            <Button
                                type="submit"
                                size="md"
                                fullWidth
                                mt="md"
                                loading={processing}
                                style={{
                                    background: 'linear-gradient(135deg, #2099f0 0%, #1976d2 100%)',
                                    border: 'none',
                                    fontWeight: 600,
                                    height: rem(44),
                                }}
                                styles={{
                                    root: {
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: '0 8px 24px rgba(32, 153, 240, 0.4)',
                                        },
                                    },
                                }}
                            >
                                Sign In
                            </Button>
                        </Stack>
                    </form>

                    <Text size="xs" c="dimmed" ta="center" mt="xl">
                        Secure access to your NAS
                    </Text>
                </Paper>

                {/* Version Info */}
                <Text size="xs" c="rgba(255, 255, 255, 0.3)" ta="center" mt="md">
                    NovaNAS v{version}
                </Text>
            </Container>

            {/* Keyframe Animations */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(5deg); }
                }
                @keyframes pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
                }
            `}</style>
        </Box>
    );
}
