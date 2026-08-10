import { useEffect, useState } from 'react';
import {
    Modal,
    TextInput,
    Button,
    Stack,
    Box,
    Group,
    Text,
    Loader,
    ActionIcon,
    Breadcrumbs,
    Anchor,
    UnstyledButton,
    ScrollArea,
    Tooltip,
    useMantineTheme,
} from '@mantine/core';
import {
    IconFolder,
    IconFolderOpen,
    IconFile,
    IconFolderPlus,
    IconCheck,
    IconX,
    IconChevronRight,
    IconArrowRight,
} from '@tabler/icons-react';

export function FileSelector({
    opened,
    onClose,
    onSelect,
    title = 'Select File or Folder',
    selectLabel = 'Select',
    initialPath = '/',
    allowFiles = true,
    filters,
    showFiles = true,
    useSudo = false,
}) {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [contents, setContents] = useState([]);
    const [customPath, setCustomPath] = useState(initialPath);
    const [selectedPath, setSelectedPath] = useState(null);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderError, setNewFolderError] = useState(null);
    const [hoveredPath, setHoveredPath] = useState(null);

    const theme = useMantineTheme();

    const COMMON_PATHS = [
        { label: '/media', icon: '💾' },
        { label: '/mnt', icon: '💿' },
        { label: '/home', icon: '🏠' },
        { label: '/storage', icon: '📦' },
        { label: '/var', icon: '⚙️' },
        { label: '/opt', icon: '🔧' },
        { label: '/root', icon: '👑' },
    ];

    useEffect(() => {
        if (opened) {
            setCurrentPath(initialPath);
            setCustomPath(initialPath);
            setSelectedPath(null);
            setShowNewFolderInput(false);
            setNewFolderName('');
            setNewFolderError(null);
            setHoveredPath(null);
            fetchDirectory(initialPath);
        }
    }, [opened, initialPath]);

    const fetchDirectory = async (path) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ path });
            if (useSudo) {
                params.set('use_sudo', 'true');
            }
            const response = await fetch(`/api/storage/directories?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                let filtered = data || [];
                if (filters && filters.length > 0) {
                    filtered = data.filter(item =>
                        item.type === 'directory' ||
                        (allowFiles && filters.some(ext => item.name.endsWith(ext)))
                    );
                }
                setContents(filtered);
            } else {
                setError('Failed to load directory');
                setContents([]);
            }
        } catch (err) {
            setError('Failed to load directory');
            setContents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (path) => {
        setCurrentPath(path);
        setCustomPath(path);
        setSelectedPath(null);
        fetchDirectory(path);
    };

    const handleCustomPathSubmit = () => {
        if (customPath) {
            handleNavigate(customPath);
        }
    };

    const handleSelect = (path) => {
        setSelectedPath(path);
    };

    const handleConfirm = () => {
        const pathToUse = selectedPath || currentPath;
        onSelect(pathToUse);
        onClose();
    };

    const handleCreateFolder = async () => {
        const name = newFolderName.trim();
        if (!name) return;

        setCreatingFolder(true);
        setNewFolderError(null);

        const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;

        try {
            const body = { path: newPath };
            if (useSudo) {
                body.use_sudo = 'true';
            }
            const response = await fetch('/api/storage/directories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                setNewFolderError(data.error || 'Failed to create folder');
                return;
            }

            setShowNewFolderInput(false);
            setNewFolderName('');
            setSelectedPath(newPath);
            fetchDirectory(currentPath);
        } catch {
            setNewFolderError('An unexpected error occurred');
        } finally {
            setCreatingFolder(false);
        }
    };

    const pathParts = currentPath.split('/').filter(Boolean);
    const directories = contents.filter(c => c.type === 'directory');
    const files = showFiles ? contents.filter(c => c.type === 'file') : [];

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={<Text fw={600} size="lg">{title}</Text>}
            size="lg"
            centered
        >
            <Stack gap="md">
                {/* Quick Path Buttons */}
                <Box
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                    }}
                >
                    {COMMON_PATHS.map(({ label, icon }) => {
                        const isActive = currentPath.startsWith(label);
                        return (
                            <UnstyledButton
                                key={label}
                                onClick={() => handleNavigate(label)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    fontFamily: 'inherit',
                                    transition: 'all 150ms ease',
                                    backgroundColor: isActive
                                        ? theme.colors.blue[6]
                                        : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${isActive
                                        ? theme.colors.blue[5]
                                        : 'rgba(255, 255, 255, 0.08)'}`,
                                    color: isActive ? 'white' : theme.colors.gray[3],
                                    cursor: 'pointer',
                                }}
                            >
                                <span style={{ fontSize: '13px' }}>{icon}</span>
                                {label}
                            </UnstyledButton>
                        );
                    })}
                </Box>

                {/* Path Input */}
                <Group gap="xs">
                    <TextInput
                        placeholder="Enter path..."
                        value={customPath}
                        onChange={(e) => setCustomPath(e.target.value)}
                        style={{ flex: 1 }}
                        leftSection={<IconFolder size={16} style={{ opacity: 0.5 }} />}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleCustomPathSubmit();
                            }
                        }}
                        size="sm"
                    />
                    <Tooltip label="Go to path">
                        <ActionIcon
                            variant="light"
                            color="blue"
                            size="lg"
                            onClick={handleCustomPathSubmit}
                        >
                            <IconArrowRight size={16} />
                        </ActionIcon>
                    </Tooltip>
                </Group>

                {/* Breadcrumbs */}
                <Box
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${theme.colors.dark[4]}`,
                        overflow: 'hidden',
                    }}
                >
                    <Anchor
                        component="button"
                        type="button"
                        onClick={() => handleNavigate('/')}
                        size="sm"
                        style={{ flexShrink: 0 }}
                    >
                        /
                    </Anchor>
                    {pathParts.map((part, index) => {
                        const path = '/' + pathParts.slice(0, index + 1).join('/');
                        const isLast = index === pathParts.length - 1;
                        return (
                            <Group key={path} gap={4} style={{ flexShrink: 0 }}>
                                <IconChevronRight size={12} style={{ opacity: 0.3 }} />
                                <Anchor
                                    component="button"
                                    type="button"
                                    onClick={() => handleNavigate(path)}
                                    size="sm"
                                    fw={isLast ? 600 : 400}
                                >
                                    {part}
                                </Anchor>
                            </Group>
                        );
                    })}
                </Box>

                {/* File/Folder List */}
                <Box
                    style={{
                        borderRadius: '10px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                        backgroundColor: 'rgba(0, 0, 0, 0.15)',
                        overflow: 'hidden',
                    }}
                >
                    <ScrollArea h={300} scrollbarSize={6}>
                        {loading ? (
                            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
                                <Loader size="sm" />
                            </Box>
                        ) : error ? (
                            <Box style={{ padding: '32px', textAlign: 'center' }}>
                                <Text c="red" size="sm">{error}</Text>
                            </Box>
                        ) : contents.length === 0 ? (
                            <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                                <IconFolder size={32} style={{ opacity: 0.2, marginBottom: '8px' }} />
                                <Text c="dimmed" size="sm">This folder is empty</Text>
                            </Box>
                        ) : (
                            <Stack gap={0}>
                                {directories.map(dir => {
                                    const isSelected = selectedPath === dir.path;
                                    const isHovered = hoveredPath === dir.path;
                                    return (
                                        <UnstyledButton
                                            key={dir.path}
                                            onClick={() => handleSelect(dir.path)}
                                            onDoubleClick={() => handleNavigate(dir.path)}
                                            onMouseEnter={() => setHoveredPath(dir.path)}
                                            onMouseLeave={() => setHoveredPath(null)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '9px 14px',
                                                width: '100%',
                                                textAlign: 'left',
                                                fontFamily: 'inherit',
                                                fontSize: '13px',
                                                transition: 'all 120ms ease',
                                                backgroundColor: isSelected
                                                    ? theme.colors.blue[6]
                                                    : isHovered
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'transparent',
                                                borderBottom: `1px solid ${theme.colors.dark[4]}`,
                                                color: isSelected ? 'white' : theme.colors.gray[2],
                                            }}
                                        >
                                            {isSelected || isHovered ? (
                                                <IconFolderOpen
                                                    size={18}
                                                    color={isSelected ? 'white' : theme.colors.blue[4]}
                                                />
                                            ) : (
                                                <IconFolder
                                                    size={18}
                                                    color={theme.colors.blue[4]}
                                                    style={{ opacity: 0.7 }}
                                                />
                                            )}
                                            <Text
                                                size="sm"
                                                fw={isSelected ? 500 : 400}
                                                style={{
                                                    color: isSelected ? 'white' : undefined,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {dir.name}
                                            </Text>
                                        </UnstyledButton>
                                    );
                                })}
                                {files.map(file => {
                                    const isSelected = selectedPath === file.path;
                                    const isHovered = hoveredPath === file.path;
                                    return (
                                        <UnstyledButton
                                            key={file.path}
                                            onClick={() => handleSelect(file.path)}
                                            onMouseEnter={() => setHoveredPath(file.path)}
                                            onMouseLeave={() => setHoveredPath(null)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '9px 14px',
                                                width: '100%',
                                                textAlign: 'left',
                                                fontFamily: 'inherit',
                                                fontSize: '13px',
                                                transition: 'all 120ms ease',
                                                backgroundColor: isSelected
                                                    ? theme.colors.blue[6]
                                                    : isHovered
                                                        ? 'rgba(255, 255, 255, 0.05)'
                                                        : 'transparent',
                                                borderBottom: `1px solid ${theme.colors.dark[4]}`,
                                                color: isSelected ? 'white' : theme.colors.gray[2],
                                            }}
                                        >
                                            <IconFile
                                                size={18}
                                                color={isSelected ? 'white' : theme.colors.gray[5]}
                                                style={{ opacity: isSelected ? 1 : 0.7 }}
                                            />
                                            <Text
                                                size="sm"
                                                fw={isSelected ? 500 : 400}
                                                style={{
                                                    color: isSelected ? 'white' : undefined,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {file.name}
                                            </Text>
                                        </UnstyledButton>
                                    );
                                })}
                            </Stack>
                        )}
                    </ScrollArea>
                </Box>

                {/* New Folder Input / Selection Info */}
                <Box>
                    {showNewFolderInput ? (
                        <Stack
                            gap="xs"
                        style={{
                            padding: '12px',
                            borderRadius: '10px',
                            border: `1px solid ${theme.colors.dark[4]}`,
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        }}
                        >
                            <Text size="xs" c="dimmed" fw={500} tt="uppercase" lh={1}>
                                Create new folder in {currentPath}
                            </Text>
                            <Group gap="xs">
                                <TextInput
                                    placeholder="Folder name"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    style={{ flex: 1 }}
                                    size="sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCreateFolder();
                                        } else if (e.key === 'Escape') {
                                            setShowNewFolderInput(false);
                                            setNewFolderName('');
                                            setNewFolderError(null);
                                        }
                                    }}
                                    disabled={creatingFolder}
                                />
                                <Tooltip label="Create folder">
                                    <ActionIcon
                                        variant="light"
                                        color="green"
                                        size="lg"
                                        onClick={handleCreateFolder}
                                        loading={creatingFolder}
                                    >
                                        <IconCheck size={16} />
                                    </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Cancel">
                                    <ActionIcon
                                        variant="light"
                                        color="gray"
                                        size="lg"
                                        onClick={() => {
                                            setShowNewFolderInput(false);
                                            setNewFolderName('');
                                            setNewFolderError(null);
                                        }}
                                    >
                                        <IconX size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                            {newFolderError && (
                                <Text size="xs" c="red">{newFolderError}</Text>
                            )}
                        </Stack>
                    ) : (
                        <Group
                            justify="space-between"
                            style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: `1px solid ${theme.colors.dark[4]}`,
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            }}
                        >
                            <Tooltip label="Create a new folder in the current directory">
                                <Button
                                    variant="subtle"
                                    size="xs"
                                    leftSection={<IconFolderPlus size={14} />}
                                    onClick={() => setShowNewFolderInput(true)}
                                >
                                    New folder
                                </Button>
                            </Tooltip>
                            <Text size="xs" c="dimmed">
                                Selected:{' '}
                                <Text span fw={500} c="gray.3">
                                    {selectedPath || currentPath}
                                </Text>
                            </Text>
                        </Group>
                    )}
                </Box>

                {/* Footer Actions */}
                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onClose} color="gray">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedPath && !currentPath}
                    >
                        {selectLabel}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
