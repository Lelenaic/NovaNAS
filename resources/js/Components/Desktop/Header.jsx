import { useState, useEffect } from 'react';
import { Box, Group, Text, ActionIcon, Menu, Avatar, Modal, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { usePage, router } from '@inertiajs/react';
import {
    IconBell,
    IconSettings,
    IconLogout,
    IconUser,
    IconPower,
    IconRefresh,
    IconMenu2,
} from '@tabler/icons-react';
import { ProfileModal } from './ProfileModal';
import { useSystemInfo } from './Sidebar';

export function Header({ sidebarOpened, onToggleSidebar, isMobile }) {
    const { systemInfo, loading } = useSystemInfo();
    const { auth } = usePage().props;
    const userName = auth?.user?.name;
    const userInitial = userName?.charAt(0).toUpperCase() || 'U';
    const [profileModalOpened, { open: openProfileModal, close: closeProfileModal }] = useDisclosure(false);
    const [shutdownModalOpened, { open: openShutdownModal, close: closeShutdownModal }] = useDisclosure(false);
    const [restartModalOpened, { open: openRestartModal, close: closeRestartModal }] = useDisclosure(false);

    const handleShutdown = () => {
        closeShutdownModal();
        fetch('/api/updates/shutdown', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    };

    const handleRestart = () => {
        closeRestartModal();
        fetch('/api/updates/restart', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    };

    const formatTime = (datetime) => {
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const formatDate = (datetime) => {
        const date = new Date(datetime);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const currentTime = systemInfo?.datetime;

    return (
        <Box
            style={{
                height: isMobile ? '48px' : '52px',
                position: 'fixed',
                top: isMobile ? '6px' : '12px',
                left: isMobile ? '6px' : '12px',
                right: isMobile ? '6px' : '12px',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? '0 12px' : '0 20px',
                borderRadius: isMobile ? '12px' : '16px',
                backgroundColor: 'rgba(30, 30, 35, 0.72)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
            }}
        >
            {/* Left Section - Hamburger + Logo */}
            <Group gap={isMobile ? 'xs' : 'sm'}>
                {isMobile && (
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="36px"
                        radius="12px"
                        onClick={onToggleSidebar}
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                        <IconMenu2 size={16} color="rgba(255, 255, 255, 0.7)" />
                    </ActionIcon>
                )}
                <img src={isMobile ? '/images/logo-tiny.png' : '/images/logo.png'} alt="Logo" style={{ height: isMobile ? '22px' : '28px' }} />
            </Group>

            {/* Center Section - Clock */}
            <Box
                style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    lineHeight: 1,
                }}
            >
                {loading || !currentTime ? (
                    <>
                        <Text size={isMobile ? 'sm' : 'lg'} c="white" fw={600} style={{ letterSpacing: '0.02em' }}>
                            --:--
                        </Text>
                        {!isMobile && (
                            <Text size="xs" c="dimmed" fw={400} style={{ marginTop: '1px' }}>
                                ---
                            </Text>
                        )}
                    </>
                ) : (
                    <>
                        <Text size={isMobile ? 'sm' : 'lg'} c="white" fw={600} style={{ letterSpacing: '0.02em' }}>
                            {formatTime(currentTime)}
                        </Text>
                        {!isMobile && (
                            <Text size="xs" c="dimmed" fw={400} style={{ marginTop: '1px' }}>
                                {formatDate(currentTime)}
                            </Text>
                        )}
                    </>
                )}
            </Box>

            {/* Right Section - System Tray */}
            <Group gap="md">
                {/* Notifications */}
                <Menu shadow="md" width={220} position="bottom-end" transitionProps={{ transition: 'pop', duration: 150 }}>
                    <Menu.Target>
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="36px"
                            radius="12px"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            }}
                        >
                            <IconBell size={16} color="rgba(255, 255, 255, 0.7)" />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Notifications</Menu.Label>
                        <Menu.Item>No new notifications</Menu.Item>
                    </Menu.Dropdown>
                </Menu>

                {/* Divider */}
                <Box style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />

                {/* User Menu */}
                <Menu shadow="md" width={220} position="bottom-end" transitionProps={{ transition: 'pop', duration: 150 }}>
                    <Menu.Target>
                        <Box
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '4px 10px 4px 4px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                transition: 'background-color 150ms ease',
                            }}
                        >
                            <Avatar
                                size={isMobile ? 28 : 32}
                                radius="10px"
                                color="blue"
                                style={{
                                    border: '2px solid rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                {userInitial}
                            </Avatar>
                            {!isMobile && (
                                <Text size="xs" c="rgba(255,255,255,0.7)" fw={500} style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {userName}
                                </Text>
                            )}
                        </Box>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>{userName}</Menu.Label>
                        <Menu.Item leftSection={<IconUser size={14} />} onClick={openProfileModal}>
                            Profile
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item leftSection={<IconRefresh size={14} />} onClick={openRestartModal}>
                            Restart
                        </Menu.Item>
                        <Menu.Item leftSection={<IconPower size={14} />} onClick={openShutdownModal}>
                            Shutdown
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            color="red"
                            leftSection={<IconLogout size={14} />}
                            onClick={() => router.post('/logout')}
                        >
                            Logout
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Group>

            <ProfileModal opened={profileModalOpened} onClose={closeProfileModal} />

            <Modal opened={shutdownModalOpened} onClose={closeShutdownModal} title="Shutdown" centered>
                <Text size="sm">Are you sure you want to shutdown the system?</Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={closeShutdownModal}>Cancel</Button>
                    <Button color="red" onClick={handleShutdown}>Shutdown</Button>
                </Group>
            </Modal>

            <Modal opened={restartModalOpened} onClose={closeRestartModal} title="Restart" centered>
                <Text size="sm">Are you sure you want to restart the system?</Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={closeRestartModal}>Cancel</Button>
                    <Button color="orange" onClick={handleRestart}>Restart</Button>
                </Group>
            </Modal>
        </Box>
    );
}
