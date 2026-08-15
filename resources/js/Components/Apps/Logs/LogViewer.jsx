import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Box,
    Group,
    Button,
    Text,
    Loader,
    ScrollArea,
    Alert,
    Badge,
    useMantineTheme,
} from '@mantine/core';
import { IconRefresh, IconArrowDown, IconInfoCircle, IconX } from '@tabler/icons-react';
import { LogLine } from './LogLine';

export function LogViewer({
    file,
    levelFilter = 'all',
    pageSize = 100,
    searchResults = null,
    showFile = false,
    onClearSearch = null,
}) {
    const theme = useMantineTheme();
    const [lines, setLines] = useState([]);
    const [loadedFromEnd, setLoadedFromEnd] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [atBottom, setAtBottom] = useState(true);
    const viewportRef = useRef(null);
    const readyRef = useRef(false);
    const loadMoreRef = useRef(null);

    const isSearchMode = searchResults !== null;

    useEffect(() => {
        loadMoreRef.current = loadMore;
    });

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            const vp = viewportRef.current;

            if (vp) {
                vp.scrollTop = vp.scrollHeight;
            }

            readyRef.current = true;
            setAtBottom(true);
        });
    }, []);

    const loadInitial = useCallback(async () => {
        if (!file || isSearchMode) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/logs/view?file=${encodeURIComponent(file)}&take=${pageSize}&skip_from_end=0`,
            );
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to load log');
            }

            setLines(data.lines);
            setLoadedFromEnd(data.loaded_from_end);
            setHasMore(data.has_more);
            scrollToBottom();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [file, pageSize, isSearchMode, scrollToBottom]);

    const loadMore = useCallback(async () => {
        if (isSearchMode || !hasMore || loadingMore || !file) {
            return;
        }

        setLoadingMore(true);

        const vp = viewportRef.current;
        const prevHeight = vp ? vp.scrollHeight : 0;
        const prevTop = vp ? vp.scrollTop : 0;

        try {
            const res = await fetch(
                `/api/logs/view?file=${encodeURIComponent(file)}&take=${pageSize}&skip_from_end=${loadedFromEnd}`,
            );
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to load more');
            }

            setLines((prev) => [...data.lines, ...prev]);
            setLoadedFromEnd(data.loaded_from_end);
            setHasMore(data.has_more);

            // Preserve the visual position after prepending older lines.
            requestAnimationFrame(() => {
                const vp2 = viewportRef.current;

                if (vp2) {
                    vp2.scrollTop = vp2.scrollHeight - prevHeight + prevTop;
                }
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingMore(false);
        }
    }, [file, isSearchMode, hasMore, loadingMore, loadedFromEnd, pageSize]);

    useEffect(() => {
        if (isSearchMode) {
            return;
        }

        loadInitial();
    }, [loadInitial, isSearchMode]);

    const handleScroll = () => {
        const vp = viewportRef.current;

        if (!vp || !readyRef.current || isSearchMode) {
            return;
        }

        if (vp.scrollTop < 60) {
            loadMoreRef.current?.();
        }

        const distanceFromBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
        setAtBottom(distanceFromBottom < 60);
    };

    // Mantine's ScrollArea does not forward a native scroll event to the
    // viewport, so we attach our own listener once the viewport is mounted.
    useEffect(() => {
        const vp = viewportRef.current;

        if (!vp) {
            return;
        }

        vp.addEventListener('scroll', handleScroll);

        return () => vp.removeEventListener('scroll', handleScroll);
    }, []);

    const filtered = useMemo(() => {
        if (isSearchMode || levelFilter === 'all') {
            return lines;
        }

        const re = new RegExp(`\\b${levelFilter}\\b`, 'i');

        return lines.filter((line) => re.test(line));
    }, [lines, levelFilter, isSearchMode]);

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <Group justify="space-between" mb="sm">
                {isSearchMode ? (
                    <Group gap="xs">
                        <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconX size={14} />}
                            onClick={onClearSearch}
                        >
                            Clear search
                        </Button>
                        <Badge variant="light" color="yellow">
                            {searchResults.count} result{searchResults.count === 1 ? '' : 's'}
                            {searchResults.truncated ? '+' : ''} for “{searchResults.query}”
                        </Badge>
                    </Group>
                ) : (
                    <Group gap="xs">
                        <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconRefresh size={14} />}
                            onClick={loadInitial}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                        <Badge variant="light" color="gray">
                            {filtered.length} line{filtered.length === 1 ? '' : 's'} shown
                            {levelFilter !== 'all' ? ` (${levelFilter})` : ''}
                        </Badge>
                    </Group>
                )}
                {!isSearchMode && hasMore && (
                    <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconArrowDown size={14} />}
                        onClick={scrollToBottom}
                    >
                        Jump to latest
                    </Button>
                )}
            </Group>

            {error && (
                <Alert color="red" variant="light" mb="sm" onClose={() => setError(null)} withCloseButton>
                    {error}
                </Alert>
            )}

            <ScrollArea
                viewportRef={viewportRef}
                style={{
                    flex: 1,
                    minHeight: 0,
                    backgroundColor: theme.colors.dark[8],
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                    padding: '12px 14px',
                }}
            >
                {isSearchMode ? (
                    searchResults.count === 0 ? (
                        <Text size="sm" c="dimmed" py="md">
                            No matches found for “{searchResults.query}”.
                        </Text>
                    ) : (
                        <>
                            {searchResults.matches.map((m, i) => (
                                <Box
                                    key={i}
                                    style={{
                                        borderBottom: `1px solid ${theme.colors.dark[6]}`,
                                        paddingBottom: '2px',
                                        marginBottom: '2px',
                                    }}
                                >
                                    {showFile && (
                                        <Group gap="xs" mb="2px">
                                            <Badge size="xs" variant="light" color="blue">
                                                {m.file}
                                            </Badge>
                                            <Text size="xs" c="dimmed">
                                                line {m.line}
                                            </Text>
                                        </Group>
                                    )}
                                    <LogLine text={m.content} highlight={searchResults.query} />
                                </Box>
                            ))}
                            {searchResults.truncated && (
                                <Group gap="xs" mt="sm" c="dimmed">
                                    <IconAlertTriangle size={14} />
                                    <Text size="xs">
                                        Only the first {searchResults.limit} matches are shown.
                                    </Text>
                                </Group>
                            )}
                        </>
                    )
                ) : (
                    <>
                        {loadingMore && (
                            <Group gap="xs" mb="xs" c="dimmed">
                                <Loader size="xs" />
                                <Text size="xs">Loading older lines…</Text>
                            </Group>
                        )}

                        {!hasMore && lines.length > 0 && (
                            <Group gap="xs" mb="xs" c="dimmed">
                                <IconInfoCircle size={14} />
                                <Text size="xs">Beginning of file reached.</Text>
                            </Group>
                        )}

                        {loading && lines.length === 0 ? (
                            <Group justify="center" py="xl">
                                <Loader size="sm" />
                            </Group>
                        ) : filtered.length === 0 ? (
                            <Text size="sm" c="dimmed" py="md">
                                {loading ? 'Loading…' : 'No log lines to display.'}
                            </Text>
                        ) : (
                            filtered.map((line, i) => (
                                <LogLine key={`${loadedFromEnd}-${i}`} text={line} />
                            ))
                        )}

                        {atBottom && lines.length > 0 && (
                            <Group gap="xs" mt="sm" c="dimmed">
                                <IconInfoCircle size={14} />
                                <Text size="xs">End of file reached.</Text>
                            </Group>
                        )}
                    </>
                )}
            </ScrollArea>
        </Box>
    );
}
