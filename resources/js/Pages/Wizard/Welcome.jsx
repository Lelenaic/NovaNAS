import {
    Box,
    Button,
    Container,
    Group,
    Paper,
    Stack,
    Text,
    Title,
    rem,
} from '@mantine/core';
import {
    IconArrowRight,
    IconCheck,
    IconDroplet,
    IconContainer,
    IconActivity,
    IconFolder,
} from '@tabler/icons-react';
import { Link } from '@inertiajs/react';

const STEPS = [
    { id: 1, title: 'Welcome', description: 'Get started' },
    { id: 2, title: 'Account', description: 'Create admin account' },
    { id: 3, title: 'Bind User', description: 'Finish setup' },
];

const FEATURES = [
    { icon: IconFolder, title: 'File Manager', description: 'Manage your files with a powerful file manager' },
    { icon: IconContainer, title: 'Docker', description: 'Deploy and manage Docker containers' },
    { icon: IconActivity, title: 'Monitoring', description: 'Monitor system performance in real-time' },
    { icon: IconDroplet, title: 'Storage', description: 'Control your storage with ZFS or EXT4' },
];

export default function WizardWelcome() {
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
                        <Title order={1} ta="center" fw={700} c="white" style={{ fontSize: rem(28), letterSpacing: '-0.5px' }}>
                            Welcome to NovaNAS
                        </Title>
                        <Text c="dimmed" size="md" ta="center" maw={380}>
                            Let's get your system set up in just a few steps.
                        </Text>

                        {/* Steps Indicator */}
                        <Group gap="xl" mt="sm">
                            {STEPS.map((step, index) => (
                                <Group key={step.id} gap="sm">
                                    <Box
                                        style={{
                                            width: rem(28),
                                            height: rem(28),
                                            borderRadius: '50%',
                                            background: index === 0
                                                ? 'linear-gradient(135deg, #2099f0 0%, #1976d2 100%)'
                                                : 'rgba(255, 255, 255, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 600,
                                            fontSize: rem(13),
                                            color: index === 0 ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                            boxShadow: index === 0 ? '0 4px 12px rgba(32, 153, 240, 0.4)' : 'none',
                                        }}
                                    >
                                        {index + 1}
                                    </Box>
                                    {index < STEPS.length - 1 && (
                                        <Box
                                            style={{
                                                width: rem(36),
                                                height: rem(2),
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                borderRadius: rem(1),
                                            }}
                                        />
                                    )}
                                </Group>
                            ))}
                        </Group>

                        {/* Feature Highlights */}
                        <Stack gap="sm" mt="md" w="100%">
                            {FEATURES.map(({ icon: Icon, title, description }) => (
                                <Group key={title} gap="md" align="center" wrap="nowrap">
                                    <Box
                                        style={{
                                            width: rem(36),
                                            height: rem(36),
                                            borderRadius: '10px',
                                            background: 'rgba(32, 153, 240, 0.15)',
                                            border: '1px solid rgba(32, 153, 240, 0.25)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon size={18} color="#2099f0" stroke={1.5} />
                                    </Box>
                                    <Stack gap={0}>
                                        <Text size="sm" fw={600} c="white">
                                            {title}
                                        </Text>
                                        <Text size="xs" c="rgba(255, 255, 255, 0.6)">
                                            {description}
                                        </Text>
                                    </Stack>
                                </Group>
                            ))}
                        </Stack>

                        {/* Navigation Button */}
                        <Button
                            component={Link}
                            href="/wizard/account"
                            size="md"
                            fullWidth
                            mt="md"
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
                            Get Started
                        </Button>

                        <Group gap="xs" justify="center">
                            <IconCheck size={14} color="rgba(255, 255, 255, 0.4)" stroke={1.5} />
                            <Text size="xs" c="dimmed" ta="center">
                                Setup takes less than a minute
                            </Text>
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