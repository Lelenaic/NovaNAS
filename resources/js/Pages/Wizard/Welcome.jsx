import {
    Box,
    Button,
    Center,
    Container,
    Group,
    Paper,
    Stack,
    Text,
    Title,
    rem,
} from '@mantine/core';
import { IconCloudComputing, IconArrowRight } from '@tabler/icons-react';
import { Link } from '@inertiajs/react';

const STEPS = [
    { id: 1, title: 'Welcome', description: 'Get started' },
    { id: 2, title: 'Account', description: 'Create admin account' },
    { id: 3, title: 'Complete', description: 'Finish setup' },
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

            {/* Wizard Content */}
            <Container size={560} style={{ position: 'relative', zIndex: 1 }}>
                <Paper
                    shadow="xl"
                    radius="lg"
                    p={rem(48)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                >
                    <Stack align="center" gap="lg">
                        {/* Logo/Icon */}
                        <Box
                            style={{
                                width: rem(100),
                                height: rem(100),
                                borderRadius: '24px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
                            }}
                        >
                            <IconCloudComputing size={50} color="white" stroke={1.5} />
                        </Box>

                        <Title order={1} ta="center" fw={700} c="white" style={{ fontSize: rem(32), letterSpacing: '-0.5px' }}>
                            Welcome to NovaNAS
                        </Title>
                        <Text c="dimmed" size="lg" ta="center" maw={400}>
                            Your personal cloud storage solution. Let's get your system set up in just a few steps.
                        </Text>

                        {/* Steps Indicator */}
                        <Group gap="xl" mt="md">
                            {STEPS.map((step, index) => (
                                <Group key={step.id} gap="sm">
                                    <Box
                                        style={{
                                            width: rem(32),
                                            height: rem(32),
                                            borderRadius: '50%',
                                            background: index === 0
                                                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                                : 'rgba(255, 255, 255, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 600,
                                            fontSize: rem(14),
                                            color: index === 0 ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                        }}
                                    >
                                        {index + 1}
                                    </Box>
                                    {index < STEPS.length - 1 && (
                                        <Box
                                            style={{
                                                width: rem(40),
                                                height: rem(2),
                                                background: 'rgba(255, 255, 255, 0.1)',
                                            }}
                                        />
                                    )}
                                </Group>
                            ))}
                        </Group>

                        {/* Feature Highlights */}
                        <Stack gap="md" mt="lg" w="100%">
                            <Group gap="md" align="flex-start">
                                <Box
                                    style={{
                                        width: rem(24),
                                        height: rem(24),
                                        borderRadius: '50%',
                                        background: 'rgba(99, 102, 241, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Text size="xs" c="indigo" fw={700}>✓</Text>
                                </Box>
                                <Text c="rgba(255, 255, 255, 0.7)" size="sm">
                                    Manage your files with a powerful file manager
                                </Text>
                            </Group>
                            <Group gap="md" align="flex-start">
                                <Box
                                    style={{
                                        width: rem(24),
                                        height: rem(24),
                                        borderRadius: '50%',
                                        background: 'rgba(99, 102, 241, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Text size="xs" c="indigo" fw={700}>✓</Text>
                                </Box>
                                <Text c="rgba(255, 255, 255, 0.7)" size="sm">
                                    Deploy and manage Docker containers
                                </Text>
                            </Group>
                            <Group gap="md" align="flex-start">
                                <Box
                                    style={{
                                        width: rem(24),
                                        height: rem(24),
                                        borderRadius: '50%',
                                        background: 'rgba(99, 102, 241, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Text size="xs" c="indigo" fw={700}>✓</Text>
                                </Box>
                                <Text c="rgba(255, 255, 255, 0.7)" size="sm">
                                    Monitor system performance in real-time
                                </Text>
                            </Group>
                            <Group gap="md" align="flex-start">
                                <Box
                                    style={{
                                        width: rem(24),
                                        height: rem(24),
                                        borderRadius: '50%',
                                        background: 'rgba(99, 102, 241, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Text size="xs" c="indigo" fw={700}>✓</Text>
                                </Box>
                                <Text c="rgba(255, 255, 255, 0.7)" size="sm">
                                    Control your storage with ZFS or EXT4
                                </Text>
                            </Group>
                        </Stack>

                        {/* Navigation Buttons */}
                        <Group justify="space-between" w="100%" mt="xl">
                            <Box />
                            <Button
                                component={Link}
                                href="/wizard/account"
                                size="lg"
                                rightSection={<IconArrowRight size={18} />}
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    border: 'none',
                                    fontWeight: 600,
                                    height: rem(48),
                                    paddingLeft: rem(24),
                                    paddingRight: rem(24),
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
                                Get Started
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
