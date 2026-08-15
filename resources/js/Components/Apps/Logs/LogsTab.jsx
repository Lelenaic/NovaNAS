import { useState, useEffect } from 'react';
import {
    Box,
    Group,
    Select,
    TextInput,
    Button,
    Modal,
    Text,
    ThemeIcon,
    useMantineTheme,
} from '@mantine/core';
import { IconSearch, IconAlertTriangle } from '@tabler/icons-react';
import { LogViewer } from './LogViewer';

const BIG_FILE_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const LEVEL_OPTIONS = [
    { value: 'all', label: 'All levels' },
    { value: 'ERROR', label: 'Error' },
    { value: 'WARNING', label: 'Warning' },
    { value: 'INFO', label: 'Info' },
    { value: 'DEBUG', label: 'Debug' },
];

export function LogsTab() {
    const theme = useMantineTheme();
    const [levelFilter, setLevelFilter] = useState('all');

    const [fileSize, setFileSize] = useState(0);
    const [fileLines, setFileLines] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [searchError, setSearchError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/logs/files');
                const data = await res.json();
                const file = (data.files || []).find((f) => f.name === 'laravel.log');
                setFileSize(file ? file.size : 0);
                setFileLines(file ? file.lines : 0);
            } catch {
                // ignore
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
                file: 'laravel.log',
            });

            const res = await fetch(`/api/logs/search?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Search failed');
            }

            setSearchResults({ ...data, query: searchQuery });
        } catch (err) {
            setSearchError(err.message);
        } finally {
            setSearching(false);
            setConfirmOpen(false);
        }
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) {
            return;
        }

        if (fileSize >= BIG_FILE_BYTES) {
            setConfirmOpen(true);
        } else {
            runSearch();
        }
    };

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <Group mb="sm" gap="xs">
                <Text size="sm" fw={600} c="white">
                    laravel.log
                </Text>
                <Text size="sm" c="dimmed">
                    {fileLines.toLocaleString()} lines · {formatBytes(fileSize)}
                </Text>
            </Group>

            <Group mb="md" gap="md">
                <Select
                    label="Filter level"
                    data={LEVEL_OPTIONS}
                    value={levelFilter}
                    onChange={(value) => setLevelFilter(value || 'all')}
                    allowDeselect={false}
                    style={{ minWidth: '180px' }}
                />
                <TextInput
                    label="Search laravel.log"
                    placeholder="Search within this log…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSearch();
                        }
                    }}
                    leftSection={<IconSearch size={16} />}
                    style={{ flex: 1 }}
                    error={searchError}
                />
                <Button
                    onClick={handleSearch}
                    loading={searching}
                    leftSection={<IconSearch size={16} />}
                    style={{ marginTop: 'auto' }}
                >
                    Search
                </Button>
            </Group>

            <Box style={{ flex: 1, minHeight: 0 }}>
                <LogViewer
                    file="laravel.log"
                    levelFilter={levelFilter}
                    searchResults={searchResults}
                    onClearSearch={() => setSearchResults(null)}
                />
            </Box>

            {/* Confirmation when searching a large file */}
            <Modal
                opened={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title={
                    <Group gap="xs">
                        <ThemeIcon color="orange" variant="light" size="md">
                            <IconAlertTriangle size={16} />
                        </ThemeIcon>
                        <Text fw={600}>Search a large log file?</Text>
                    </Group>
                }
                centered
            >
                <Text size="sm" mb="md">
                    laravel.log is very large (≥ {(BIG_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB).
                    Searching it may take a long time and could slow down or crash the system.
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
