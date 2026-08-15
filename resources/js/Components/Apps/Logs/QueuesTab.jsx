import { useState, useEffect } from 'react';
import {
    Box,
    Group,
    Text,
    Loader,
    ScrollArea,
    TextInput,
    Button,
    Modal,
    Badge,
    ThemeIcon,
    useMantineTheme,
} from '@mantine/core';
import {
    IconSearch,
    IconAlertTriangle,
    IconFileText,
} from '@tabler/icons-react';
import { LogViewer } from './LogViewer';

const BIG_FILE_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function QueuesTab() {
    const theme = useMantineTheme();
    const [files, setFiles] = useState([]);
    const [queueFiles, setQueueFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [searchError, setSearchError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/logs/files');
                const data = await res.json();

                const all = data.files || [];
                setFiles(all);

                const queues = all.filter((f) => /queue/i.test(f.name));
                setQueueFiles(queues);

                if (queues.length > 0) {
                    setSelectedFile(queues[0].name);
                }
            } catch {
                // ignore
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const runSearch = async () => {
        if (!searchQuery.trim()) {
            return;
        }

        setSearching(true);
        setSearchError(null);

        try {
            const params = new URLSearchParams({
                query: searchQuery,
            });

            const res = await fetch(`/api/logs/search?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Search failed');
            }

            setResults({ ...data, query: searchQuery });
        } catch (err) {
            setSearchError(err.message);
        } finally {
            setSearching(false);
            setConfirmOpen(false);
        }
    };

    const handleSearchClick = () => {
        if (!searchQuery.trim()) {
            return;
        }

        const oversized = files.find((f) => f.size >= BIG_FILE_BYTES);

        if (oversized) {
            setConfirmOpen(true);
        } else {
            runSearch();
        }
    };

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* Global search */}
            <Group mb="md" gap="sm">
                <TextInput
                    placeholder="Search across all log files…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSearchClick();
                        }
                    }}
                    leftSection={<IconSearch size={16} />}
                    style={{ flex: 1 }}
                    error={searchError}
                />
                <Button
                    onClick={handleSearchClick}
                    loading={searching}
                    leftSection={<IconSearch size={16} />}
                >
                    Search all logs
                </Button>
            </Group>

            {/* File list + viewer */}
            <Box style={{ flex: 1, minHeight: 0, display: 'flex', gap: '12px' }}>
                <Box
                    style={{
                        width: '220px',
                        minWidth: '220px',
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '8px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Text
                        size="xs"
                        fw={700}
                        c="dimmed"
                        px="sm"
                        py="xs"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${theme.colors.dark[4]}` }}
                    >
                        Queue Log Files
                    </Text>
                    <ScrollArea style={{ flex: 1 }}>
                        {queueFiles.length === 0 ? (
                            <Text size="sm" c="dimmed" p="sm">
                                No queue log files found.
                            </Text>
                        ) : (
                            queueFiles.map((f) => (
                                <Box
                                    key={f.name}
                                    onClick={() => setSelectedFile(f.name)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        backgroundColor: selectedFile === f.name ? theme.colors.blue[6] : 'transparent',
                                        color: selectedFile === f.name ? 'white' : theme.colors.gray[4],
                                        borderBottom: `1px solid ${theme.colors.dark[5]}`,
                                    }}
                                >
                                    <Group gap="xs">
                                        <IconFileText size={14} />
                                        <Text size="sm" fw={selectedFile === f.name ? 600 : 400} style={{ wordBreak: 'break-all' }}>
                                            {f.name}
                                        </Text>
                                    </Group>
                                    <Text
                                        size="xs"
                                        style={{ color: selectedFile === f.name ? 'rgba(255,255,255,0.85)' : theme.colors.gray[5] }}
                                    >
                                        {formatBytes(f.size)} · {(f.lines || 0).toLocaleString()} lines
                                    </Text>
                                </Box>
                            ))
                        )}
                    </ScrollArea>
                </Box>

                <Box style={{ flex: 1, minHeight: 0 }}>
                    <LogViewer
                        key={selectedFile}
                        file={selectedFile}
                        searchResults={results}
                        showFile
                        onClearSearch={() => setResults(null)}
                    />
                </Box>
            </Box>

            {/* Confirmation when searching large files */}
            <Modal
                opened={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title={
                    <Group gap="xs">
                        <ThemeIcon color="orange" variant="light" size="md">
                            <IconAlertTriangle size={16} />
                        </ThemeIcon>
                        <Text fw={600}>Search large log files?</Text>
                    </Group>
                }
                centered
            >
                <Text size="sm" mb="md">
                    One or more log files are very large (≥ {formatBytes(BIG_FILE_BYTES)}). Searching
                    across all of them may take a long time and could slow down or crash the system.
                    Are you sure you want to continue?
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => setConfirmOpen(false)}>
                        Cancel
                    </Button>
                    <Button color="orange" onClick={runSearch} loading={searching}>
                        Search anyway
                    </Button>
                </Group>
            </Modal>
        </Box>
    );
}
