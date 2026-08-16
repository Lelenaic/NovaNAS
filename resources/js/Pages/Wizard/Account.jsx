import {
    Box,
    Button,
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
import { IconArrowLeft, IconArrowRight, IconUser, IconMail, IconLock } from '@tabler/icons-react';
import { Link, useForm } from '@inertiajs/react';

const STEPS = [
    { id: 1, title: 'Welcome', description: 'Get started' },
    { id: 2, title: 'Account', description: 'Create admin account' },
    { id: 3, title: 'Bind User', description: 'Finish setup' },
];

const inputStyles = {
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
};

export default function WizardAccount({ errors }) {
    const { data, setData, post, processing } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post('/wizard/account');
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

            {/* Wizard Content */}
            <Container size={500} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '500px', padding: '0 16px' }}>
                <Paper
                    shadow="xl"
                    radius="lg"
                    p={{ base: 24, sm: rem(48) }}
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        width: '100%',
                        maxWidth: '500px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                    }}
                >
                    <Stack align="center" gap="xs">
                        {/* Logo */}
                        <img src="/images/logo.png" alt="NovaNAS" style={{ height: '50px', maxWidth: '60%' }} />
                        <Text c="dimmed" size="sm" ta="center" maw={300}>
                            Your personal cloud storage solution
                        </Text>
                    </Stack>

                    <Stack align="center" gap="md" mt={rem(28)}>
                        <Title order={2} ta="center" fw={700} c="white" style={{ fontSize: rem(24), letterSpacing: '-0.5px' }}>
                            Create Admin Account
                        </Title>
                        <Text c="dimmed" size="sm" ta="center" maw={320}>
                            This account will have full administrative privileges.
                        </Text>

                        {/* Steps Indicator */}
                        <Group gap="xl" mt="xs">
                            {STEPS.map((step, index) => (
                                <Group key={step.id} gap="sm">
                                    <Box
                                        style={{
                                            width: rem(26),
                                            height: rem(26),
                                            borderRadius: '50%',
                                            background: index <= 1
                                                ? 'linear-gradient(135deg, #2099f0 0%, #1976d2 100%)'
                                                : 'rgba(255, 255, 255, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 600,
                                            fontSize: rem(12),
                                            color: index <= 1 ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                            boxShadow: index <= 1 ? '0 4px 12px rgba(32, 153, 240, 0.4)' : 'none',
                                        }}
                                    >
                                        {index + 1}
                                    </Box>
                                    {index < STEPS.length - 1 && (
                                        <Box
                                            style={{
                                                width: rem(30),
                                                height: rem(2),
                                                borderRadius: rem(1),
                                                background: index < 1
                                                    ? 'linear-gradient(90deg, rgba(32, 153, 240, 0.8) 0%, rgba(32, 153, 240, 0.3) 100%)'
                                                    : 'rgba(255, 255, 255, 0.1)',
                                            }}
                                        />
                                    )}
                                </Group>
                            ))}
                        </Group>

                        {/* Account Creation Form */}
                        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                            <Stack gap="md" w="100%">
                                <TextInput
                                    size="md"
                                    placeholder="Full Name"
                                    name="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    leftSection={<IconUser size={18} stroke={1.5} />}
                                    error={errors?.name}
                                    required
                                    styles={inputStyles}
                                />

                                <TextInput
                                    size="md"
                                    placeholder="Email Address"
                                    name="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    leftSection={<IconMail size={18} stroke={1.5} />}
                                    error={errors?.email}
                                    required
                                    styles={inputStyles}
                                />

                                <PasswordInput
                                    size="md"
                                    placeholder="Password"
                                    name="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    leftSection={<IconLock size={18} stroke={1.5} />}
                                    error={errors?.password}
                                    required
                                    styles={inputStyles}
                                />

                                <PasswordInput
                                    size="md"
                                    placeholder="Confirm Password"
                                    name="password_confirmation"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    leftSection={<IconLock size={18} stroke={1.5} />}
                                    error={errors?.password_confirmation}
                                    required
                                    styles={inputStyles}
                                />

                                <Button
                                    type="submit"
                                    size="md"
                                    fullWidth
                                    mt="md"
                                    loading={processing}
                                    rightSection={<IconArrowRight size={18} />}
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
                                    Create Account
                                </Button>
                            </Stack>
                        </form>

                        {/* Navigation Buttons */}
                        <Group w="100%" mt="sm">
                            <Button
                                component={Link}
                                href="/wizard"
                                variant="subtle"
                                size="sm"
                                leftSection={<IconArrowLeft size={16} />}
                                style={{
                                    color: 'rgba(255, 255, 255, 0.6)',
                                }}
                            >
                                Back
                            </Button>
                        </Group>
                    </Stack>
                </Paper>
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