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
    Switch,
} from '@mantine/core';
import {
    IconFolder,
    IconFile,
    IconRefresh,
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
    showFiles: initialShowFiles = true,
}) {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [contents, setContents] = useState([]);
    const [customPath, setCustomPath] = useState(initialPath);
    const [selectedPath, setSelectedPath] = useState(null);
    const [showFiles, setShowFiles] = useState(initialShowFiles);

    const COMMON_PATHS = [
        '/media',
        '/mnt',
        '/home',
        '/storage',
        '/var',
        '/opt',
        '/root',
    ];

    useEffect(() => {
        if (opened) {
            setCurrentPath(initialPath);
            setCustomPath(initialPath);
            setSelectedPath(null);
            setShowFiles(initialShowFiles);
            fetchDirectory(initialPath);
        }
    }, [opened, initialPath, initialShowFiles]);

    const fetchDirectory = async (path) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/storage/directories?path=${encodeURIComponent(path)}`);
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

    const pathParts = currentPath.split('/').filter(Boolean);
    const directories = contents.filter(c => c.type === 'directory');
    const files = showFiles ? contents.filter(c => c.type === 'file') : [];

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={title}
            size="lg"
            centered
        >
            <Stack gap="md">
                <Group gap="xs" wrap="wrap">
                    {COMMON_PATHS.map(path => (
                        <Button
                            key={path}
                            variant={currentPath.startsWith(path) ? 'filled' : 'light'}
                            size="xs"
                            onClick={() => handleNavigate(path)}
                        >
                            {path}
                        </Button>
                    ))}
                </Group>

                <Group gap="xs">
                    <TextInput
                        placeholder="Enter custom path"
                        value={customPath}
                        onChange={(e) => setCustomPath(e.target.value)}
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleCustomPathSubmit();
                            }
                        }}
                    />
                    <ActionIcon variant="light" onClick={handleCustomPathSubmit}>
                        <IconFolder size={16} />
                    </ActionIcon>
                </Group>

                <Breadcrumbs>
                    <Anchor
                        component="button"
                        type="button"
                        onClick={() => handleNavigate('/')}
                        fz="sm"
                    >
                        /
                    </Anchor>
                    {pathParts.map((part, index) => {
                        const path = '/' + pathParts.slice(0, index + 1).join('/');
                        return (
                            <Anchor
                                key={path}
                                component="button"
                                type="button"
                                onClick={() => handleNavigate(path)}
                                fz="sm"
                            >
                                {part}
                            </Anchor>
                        );
                    })}
                </Breadcrumbs>

                <Box
                    style={{
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        minHeight: '250px',
                        maxHeight: '300px',
                        overflow: 'auto',
                    }}
                >
                    {loading ? (
                        <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
                            <Loader size="md" />
                        </Box>
                    ) : error ? (
                        <Box style={{ padding: '20px', textAlign: 'center' }}>
                            <Text c="red" size="sm">{error}</Text>
                        </Box>
                    ) : contents.length === 0 ? (
                        <Box style={{ padding: '20px', textAlign: 'center' }}>
                            <Text c="dimmed" size="sm">No items found</Text>
                        </Box>
                    ) : (
                        <Stack gap={0}>
                            {directories.map(dir => (
                                <UnstyledButton
                                    key={dir.path}
                                    onClick={() => handleSelect(dir.path)}
                                    onDoubleClick={() => handleNavigate(dir.path)}
                                    style={{
                                        padding: '10px 12px',
                                        borderBottom: '1px solid #f1f3f5',
                                        backgroundColor: selectedPath === dir.path ? '#e7f5ff' : 'transparent',
                                        cursor: 'pointer',
                                        width: '100%',
                                        textAlign: 'left',
                                    }}
                                >
                                    <Group gap="xs">
                                        <IconFolder size={18} color="#868e96" />
                                        <Text size="sm">{dir.name}</Text>
                                    </Group>
                                </UnstyledButton>
                            ))}
                            {files.map(file => (
                                <UnstyledButton
                                    key={file.path}
                                    onClick={() => handleSelect(file.path)}
                                    style={{
                                        padding: '10px 12px',
                                        borderBottom: '1px solid #f1f3f5',
                                        backgroundColor: selectedPath === file.path ? '#e7f5ff' : 'transparent',
                                        cursor: 'pointer',
                                        width: '100%',
                                        textAlign: 'left',
                                    }}
                                >
                                    <Group gap="xs">
                                        <IconFile size={18} color="#868e96" />
                                        <Text size="sm">{file.name}</Text>
                                    </Group>
                                </UnstyledButton>
                            ))}
                        </Stack>
                    )}
                </Box>

                <Box>
                    <Switch
                        label="Show files"
                        checked={showFiles}
                        onChange={(e) => setShowFiles(e.currentTarget.checked)}
                    />
                </Box>

                <Box>
                    <Text size="sm" c="dimmed">
                        Selected: <Text span fw={500}>{selectedPath || currentPath}</Text>
                    </Text>
                </Box>

                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>
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
