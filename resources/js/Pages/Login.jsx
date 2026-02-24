import {
    Box,
    Button,
    Center,
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
} from '@mantine/core';
import { IconCloudComputing, IconLock, IconMail } from '@tabler/icons-react';
import { useForm } from '@inertiajs/react';

export default function Login({ version, errors }) {
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
                        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
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
                        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)',
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
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
                        transform: 'translate(-50%, -50%)',
                        animation: 'pulse 15s ease-in-out infinite',
                    }}
                />
            </Box>

            {/* Login Form */}
            <Container size={420} style={{ position: 'relative', zIndex: 1 }}>
                <Paper
                    shadow="xl"
                    radius="lg"
                    p={rem(40)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                >
                    <Stack align="center" gap="xs">
                        {/* Logo/Icon */}
                        <Box
                            style={{
                                width: rem(80),
                                height: rem(80),
                                borderRadius: '20px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
                            }}
                        >
                            <IconCloudComputing size={40} color="white" stroke={1.5} />
                        </Box>

                        <Title order={1} ta="center" fw={700} c="white" style={{ fontSize: rem(28), letterSpacing: '-0.5px' }}>
                            NovaNAS
                        </Title>
                        <Text c="dimmed" size="sm" ta="center" maw={280}>
                            Your personal cloud storage solution
                        </Text>
                    </Stack>

                    <form onSubmit={handleSubmit}>
                        <Stack mt={rem(32)} gap="md">
                            <TextInput
                                size="md"
                                placeholder="Email"
                                name="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                leftSection={<IconMail size={18} stroke={1.5} />}
                                error={errors?.email}
                                styles={{
                                    input: {
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        '&::placeholder': {
                                            color: 'rgba(255, 255, 255, 0.4)',
                                        },
                                        '&:focus': {
                                            borderColor: '#6366f1',
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
                                styles={{
                                    input: {
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        '&::placeholder': {
                                            color: 'rgba(255, 255, 255, 0.4)',
                                        },
                                        '&:focus': {
                                            borderColor: '#6366f1',
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
                                    c="cyan"
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
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    border: 'none',
                                    fontWeight: 600,
                                    height: rem(44),
                                }}
                                styles={{
                                    root: {
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
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
