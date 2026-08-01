import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Box,
    Text,
    Group,
    LoadingOverlay,
    ActionIcon,
    Button,
    TextInput,
    Tooltip,
    Alert,
    UnstyledButton,
    Breadcrumbs,
    Anchor,
    ThemeIcon,
    Divider,
} from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import {
    IconFolder,
    IconFile,
    IconHome,
    IconFolderShare,
    IconFolderPlus,
    IconCheck,
    IconX,
    IconRefresh,
    IconAlertCircle,
    IconArrowLeft,
    IconCopy,
    IconCut,
    IconClipboard,
    IconTrash,
    IconZip,
    IconFileZip,
    IconSelectAll,
    IconCornerDownRight,
    IconLayoutGrid,
    IconList,
    IconDownload,
    IconEye,
    IconEyeOff,
} from '@tabler/icons-react';

function formatFileSize(bytes) {
    if (bytes === 0 || bytes === undefined) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function isValidLinuxFilename(name) {
    if (!name || name.length === 0) return false;
    if (name === '.' || name === '..') return false;
    if (name.includes('/')) return false;
    if (name.includes('\0')) return false;
    if (name.startsWith('-')) return false;
    if (new Blob([name]).size > 255) return false;
    return true;
}

function ShareItem({ share, isActive, onClick }) {
    const theme = useMantineTheme();

    return (
        <UnstyledButton
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: isActive ? theme.colors.blue[6] : 'transparent',
                color: isActive ? 'white' : theme.colors.gray[4],
                transition: 'all 0.15s ease',
                marginBottom: '2px',
                width: '100%',
                textAlign: 'left',
            }}
        >
            {share.type === 'home' ? (
                <IconHome size={18} />
            ) : (
                <IconFolderShare size={18} />
            )}
            <Text size="sm" fw={isActive ? 600 : 400} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {share.name}
            </Text>
        </UnstyledButton>
    );
}

function FileItem({ item, isSelected, isCut, isDragging, isDragOver, onClick, onDoubleClick, onContextMenu, onMouseDown, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onDownload }) {
    const theme = useMantineTheme();
    const isDir = item.type === 'directory';
    const [hovered, setHovered] = useState(false);

    const bgColor = isDragOver
        ? theme.colors.blue[6]
        : isSelected
            ? theme.colors.blue[8]
            : 'transparent';

    return (
        <UnstyledButton
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onMouseDown={onMouseDown}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={isDir ? onDragOver : undefined}
            onDragLeave={isDir ? onDragLeave : undefined}
            onDrop={isDir ? onDrop : undefined}
            data-path={item.path}
            style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '1px 4px',
                borderRadius: '6px',
                userSelect: 'none',
                backgroundColor: bgColor,
                opacity: isCut ? 0.5 : 1,
                transition: 'background-color 0.1s ease',
                border: isDragOver ? `2px solid ${theme.colors.blue[4]}` : '2px solid transparent',
            }}
        >
            <Group gap="12px" style={{ padding: '7px 8px' }}>
                <ThemeIcon
                    size="lg"
                    radius="md"
                    variant="light"
                    color={isDir ? 'yellow' : 'gray'}
                    style={{ flexShrink: 0 }}
                >
                    {isDir ? <IconFolder size={18} /> : <IconFile size={18} />}
                </ThemeIcon>
                <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                    </Text>
                    {item.modified && (
                        <Text size="xs" c="dimmed">
                            {item.modified}
                        </Text>
                    )}
                </Box>
                {!isDir && item.size !== undefined && (
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                        {formatFileSize(item.size)}
                    </Text>
                )}
                {!isDir && hovered && (
                    <Tooltip label="Download">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDownload?.(item);
                            }}
                            style={{ flexShrink: 0 }}
                        >
                            <IconDownload size={16} />
                        </ActionIcon>
                    </Tooltip>
                )}
            </Group>
        </UnstyledButton>
    );
}

function FileItemGrid({ item, isSelected, isCut, isDragging, isDragOver, onClick, onDoubleClick, onContextMenu, onMouseDown, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onDownload }) {
    const theme = useMantineTheme();
    const isDir = item.type === 'directory';
    const [hovered, setHovered] = useState(false);

    const bgColor = isDragOver
        ? theme.colors.blue[6]
        : isSelected
            ? theme.colors.blue[8]
            : 'transparent';

    return (
        <UnstyledButton
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onMouseDown={onMouseDown}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={isDir ? onDragOver : undefined}
            onDragLeave={isDir ? onDragLeave : undefined}
            onDrop={isDir ? onDrop : undefined}
            data-path={item.path}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '110px',
                padding: '12px 8px',
                borderRadius: '8px',
                userSelect: 'none',
                backgroundColor: bgColor,
                opacity: isCut ? 0.5 : 1,
                transition: 'background-color 0.1s ease',
                cursor: 'pointer',
                border: isDragOver ? `2px solid ${theme.colors.blue[4]}` : '2px solid transparent',
                position: 'relative',
            }}
        >
            {!isDir && hovered && (
                <Tooltip label="Download">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload?.(item);
                        }}
                        style={{ position: 'absolute', top: '4px', right: '4px', zIndex: 1 }}
                    >
                        <IconDownload size={14} />
                    </ActionIcon>
                </Tooltip>
            )}
            <ThemeIcon
                size="xl"
                radius="md"
                variant="light"
                color={isDir ? 'yellow' : 'gray'}
                style={{ marginBottom: '8px', flexShrink: 0 }}
            >
                {isDir ? <IconFolder size={28} /> : <IconFile size={28} />}
            </ThemeIcon>
            <Text
                size="xs"
                fw={500}
                ta="center"
                style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    maxWidth: '100px',
                }}
            >
                {item.name}
            </Text>
            {!isDir && item.size !== undefined && (
                <Text size="xs" c="dimmed" ta="center">
                    {formatFileSize(item.size)}
                </Text>
            )}
        </UnstyledButton>
    );
}

function ContextMenu({ x, y, items, onClose }) {
    const theme = useMantineTheme();
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position to keep menu in viewport
    const menuStyle = {
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000,
        minWidth: '180px',
        backgroundColor: theme.colors.dark[6],
        border: `1px solid ${theme.colors.dark[4]}`,
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        padding: '4px',
        overflow: 'hidden',
    };

    return (
        <Box ref={menuRef} style={menuStyle}>
            {items.map((item, index) => {
                if (item.separator) {
                    return <Divider key={index} my={4} color="dark.4" />;
                }
                return (
                    <UnstyledButton
                        key={index}
                        onClick={() => {
                            item.onClick();
                            onClose();
                        }}
                        disabled={item.disabled}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: item.disabled ? 'not-allowed' : 'pointer',
                            width: '100%',
                            textAlign: 'left',
                            opacity: item.disabled ? 0.4 : 1,
                            color: item.danger ? theme.colors.red[4] : theme.colors.gray[2],
                        }}
                        onMouseEnter={(e) => {
                            if (!item.disabled) {
                                e.currentTarget.style.backgroundColor = item.danger ? theme.colors.red[8] : theme.colors.dark[5];
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        {item.icon}
                        <Text size="sm">{item.label}</Text>
                        {item.shortcut && (
                            <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                                {item.shortcut}
                            </Text>
                        )}
                    </UnstyledButton>
                );
            })}
        </Box>
    );
}

function SelectionBox({ startX, startY, currentX, currentY }) {
    const theme = useMantineTheme();
    if (startX === null) return null;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    if (width < 3 && height < 3) return null;

    return (
        <Box
            style={{
                position: 'fixed',
                left,
                top,
                width,
                height,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '2px',
                pointerEvents: 'none',
                zIndex: 9999,
            }}
        />
    );
}

export function FileManagerAppContent() {
    const theme = useMantineTheme();
    const fileListRef = useRef(null);

    // Shares state
    const [shares, setShares] = useState([]);
    const [loadingShares, setLoadingShares] = useState(true);
    const [activeShare, setActiveShare] = useState(null);

    // File browsing state
    const [currentPath, setCurrentPath] = useState(null);
    const [items, setItems] = useState([]);

    // Hidden files preference
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);

    const visibleItems = useMemo(() => {
        if (showHiddenFiles) return items;
        return items.filter((item) => !item.name.startsWith('.'));
    }, [items, showHiddenFiles]);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [error, setError] = useState(null);

    // New folder state
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderError, setNewFolderError] = useState(null);

    // Zip state
    const [showZipInput, setShowZipInput] = useState(false);
    const [zipName, setZipName] = useState('');
    const [creatingZip, setCreatingZip] = useState(false);
    const [zipError, setZipError] = useState(null);
    const zipPathsRef = useRef([]);

    // Selection state
    const [selectedPaths, setSelectedPaths] = useState(new Set());
    const lastClickedPath = useRef(null);

    // Rubber band selection
    const [selectionBox, setSelectionBox] = useState({ startX: null, startY: null, currentX: 0, currentY: 0 });
    const isSelecting = useRef(false);
    const selectionStart = useRef({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const didDragRef = useRef(false);
    const isDraggingItemRef = useRef(false);
    const [isItemDragging, setIsItemDragging] = useState(false);

    // Clipboard state
    const [clipboard, setClipboard] = useState(null); // { paths: [], mode: 'copy'|'cut' }

    // Layout preference
    const [layout, setLayout] = useState('list');

    // Drag and drop state
    const [dragOverPath, setDragOverPath] = useState(null);
    const [dragOverCrumbPath, setDragOverCrumbPath] = useState(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);

    // ---- Data fetching ----

    const fetchShares = useCallback(async () => {
        setLoadingShares(true);
        try {
            const response = await fetch('/api/filemanager/shares', {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') },
            });
            if (response.ok) {
                const data = await response.json();
                setShares(data.shares || []);
            } else {
                setError('Failed to load shares');
            }
        } catch {
            setError('Failed to load shares');
        } finally {
            setLoadingShares(false);
        }
    }, []);

    const fetchLayout = useCallback(async () => {
        try {
            const response = await fetch('/api/filemanager/layout', {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') },
            });
            if (response.ok) {
                const data = await response.json();
                setLayout(data.layout || 'list');
            }
        } catch {
            // Use default 'list' layout on error
        }
    }, []);

    const toggleLayout = useCallback(async () => {
        const newLayout = layout === 'list' ? 'grid' : 'list';
        setLayout(newLayout);
        try {
            await fetch('/api/filemanager/layout', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify({ layout: newLayout }),
            });
        } catch {
            // Revert on error
            setLayout(layout);
        }
    }, [layout]);

    const fetchHiddenFiles = useCallback(async () => {
        try {
            const response = await fetch('/api/filemanager/hidden-files', {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') },
            });
            if (response.ok) {
                const data = await response.json();
                setShowHiddenFiles(data.show_hidden_files ?? false);
            }
        } catch {
            // Use default false on error
        }
    }, []);

    const toggleHiddenFiles = useCallback(async () => {
        const newValue = !showHiddenFiles;
        setShowHiddenFiles(newValue);
        try {
            await fetch('/api/filemanager/hidden-files', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
                body: JSON.stringify({ show_hidden_files: newValue }),
            });
        } catch {
            setShowHiddenFiles(showHiddenFiles);
        }
    }, [showHiddenFiles]);

    const fetchFiles = useCallback(async (path, share = activeShare) => {
        setLoadingFiles(true);
        setError(null);
        try {
            const response = await fetch(`/api/filemanager/files?path=${encodeURIComponent(path)}`, {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') },
            });
            if (response.ok) {
                const data = await response.json();
                setItems(data.items || []);
                setCurrentPath(data.path || path);
                setSelectedPaths(new Set());

                if (share) {
                    const sharePath = share.path.replace(/\/+$/, '');
                    const fullPath = (data.path || path).replace(/\/+$/, '');

                    if (fullPath === sharePath) {
                        setBreadcrumbs([{ name: share.name, path: sharePath }]);
                    } else {
                        const relativePath = fullPath.substring(sharePath.length + 1);
                        const parts = relativePath.split('/').filter(Boolean);
                        const crumbs = [{ name: share.name, path: sharePath }];
                        let cumPath = sharePath;
                        for (const part of parts) {
                            cumPath += '/' + part;
                            crumbs.push({ name: part, path: cumPath });
                        }
                        setBreadcrumbs(crumbs);
                    }
                }
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to load files');
                setItems([]);
            }
        } catch {
            setError('Failed to load files');
            setItems([]);
        } finally {
            setLoadingFiles(false);
        }
    }, [activeShare]);

    useEffect(() => { fetchShares(); fetchLayout(); fetchHiddenFiles(); }, [fetchShares, fetchLayout, fetchHiddenFiles]);

    useEffect(() => {
        if (shares.length > 0 && !activeShare) {
            handleShareClick(shares[0]);
        }
    }, [shares]);

    // ---- Navigation ----

    const handleShareClick = (share) => {
        setActiveShare(share);
        setNewFolderName('');
        setShowNewFolderInput(false);
        setNewFolderError(null);
        setClipboard(null);
        fetchFiles(share.path, share);
    };

    const handleBreadcrumbClick = (path) => {
        fetchFiles(path);
    };

    const handleBack = () => {
        if (breadcrumbs.length > 1) {
            fetchFiles(breadcrumbs[breadcrumbs.length - 2].path, activeShare);
        }
    };

    const handleRefresh = () => {
        if (currentPath) fetchFiles(currentPath, activeShare);
    };

    const handleItemDoubleClick = (item) => {
        if (item.type === 'directory') {
            fetchFiles(item.path);
        }
    };

    // ---- Drag and drop ----

    const handleItemDragStart = (e, item) => {
        // If the dragged item is not in the selection, select only it
        if (!selectedPaths.has(item.path)) {
            setSelectedPaths(new Set([item.path]));
        }

        // Determine which paths will be dragged (all selected, or just this item)
        const pathsToDrag = selectedPaths.has(item.path) ? [...selectedPaths] : [item.path];

        // Don't allow dragging non-writable items
        if (activeShare?.permission !== 'readwrite') {
            e.preventDefault();
            return;
        }

        // Don't allow dragging items into themselves
        // (will be validated more on drop, but prevent drag cursor here)
        isDraggingItemRef.current = true;
        setIsItemDragging(true);

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(pathsToDrag));

        // Create a custom drag image showing count of items
        if (pathsToDrag.length > 1) {
            const dragImage = document.createElement('div');
            dragImage.textContent = `${pathsToDrag.length} items`;
            dragImage.style.cssText = 'position: absolute; top: -1000px; left: -1000px; background: #3b82f6; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;';
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 0, 0);
            setTimeout(() => document.body.removeChild(dragImage), 0);
        }
    };

    const handleItemDragEnd = () => {
        isDraggingItemRef.current = false;
        setIsItemDragging(false);
        setDragOverPath(null);
        setDragOverCrumbPath(null);
    };

    const isPathChildOf = (path, parentPath) => {
        const normalizedPath = path.replace(/\/+$/, '');
        const normalizedParent = parentPath.replace(/\/+$/, '');
        return normalizedPath.startsWith(normalizedParent + '/') && normalizedPath !== normalizedParent;
    };

    const handleFolderDragOver = (e, item) => {
        e.preventDefault();

        // Don't allow dropping on non-directories
        if (item.type !== 'directory') {
            e.dataTransfer.dropEffect = 'none';
            return;
        }

        // Don't allow dropping a folder onto itself or its children
        let pathsToDrag = [];
        try {
            pathsToDrag = JSON.parse(e.dataTransfer.getData('text/plain') || '[]');
        } catch {
            // ignore
        }

        for (const dragPath of pathsToDrag) {
            if (dragPath === item.path || isPathChildOf(item.path, dragPath)) {
                e.dataTransfer.dropEffect = 'none';
                return;
            }
        }

        e.dataTransfer.dropEffect = 'move';
        setDragOverPath(item.path);
    };

    const handleFolderDragLeave = () => {
        setDragOverPath(null);
    };

    const handleFolderDrop = async (e, targetItem) => {
        e.preventDefault();
        setDragOverPath(null);

        if (targetItem.type !== 'directory') return;

        let pathsToMove = [];
        try {
            pathsToMove = JSON.parse(e.dataTransfer.getData('text/plain') || '[]');
        } catch {
            return;
        }

        if (pathsToMove.length === 0) return;

        // Validate: no path should be the target itself or a child of it
        const validPaths = pathsToMove.filter((p) => {
            if (p === targetItem.path) return false;
            if (isPathChildOf(targetItem.path, p)) return false;
            return true;
        });

        if (validPaths.length === 0) return;

        try {
            await apiRequest('/api/filemanager/move', 'POST', {
                paths: validPaths,
                destination: targetItem.path,
            });
            setSelectedPaths(new Set());
            fetchFiles(currentPath, activeShare);
        } catch (err) {
            setError(err.message);
        }
    };

    // ---- Breadcrumb drag and drop ----

    const handleCrumbDragOver = (e, crumb) => {
        e.preventDefault();

        // Don't allow dropping on the current directory breadcrumb
        if (crumb.path === currentPath) {
            e.dataTransfer.dropEffect = 'none';
            return;
        }

        let pathsToDrag = [];
        try {
            pathsToDrag = JSON.parse(e.dataTransfer.getData('text/plain') || '[]');
        } catch {
            // ignore
        }

        for (const dragPath of pathsToDrag) {
            if (dragPath === crumb.path || isPathChildOf(crumb.path, dragPath)) {
                e.dataTransfer.dropEffect = 'none';
                return;
            }
        }

        e.dataTransfer.dropEffect = 'move';
        setDragOverCrumbPath(crumb.path);
    };

    const handleCrumbDragLeave = () => {
        setDragOverCrumbPath(null);
    };

    const handleCrumbDrop = async (e, crumb) => {
        e.preventDefault();
        setDragOverCrumbPath(null);

        if (crumb.path === currentPath) return;

        let pathsToMove = [];
        try {
            pathsToMove = JSON.parse(e.dataTransfer.getData('text/plain') || '[]');
        } catch {
            return;
        }

        if (pathsToMove.length === 0) return;

        const validPaths = pathsToMove.filter((p) => {
            if (p === crumb.path) return false;
            if (isPathChildOf(crumb.path, p)) return false;
            return true;
        });

        if (validPaths.length === 0) return;

        try {
            await apiRequest('/api/filemanager/move', 'POST', {
                paths: validPaths,
                destination: crumb.path,
            });
            setSelectedPaths(new Set());
            fetchFiles(currentPath, activeShare);
        } catch (err) {
            setError(err.message);
        }
    };

    // ---- Selection ----

    const clearSelection = () => setSelectedPaths(new Set());

    const handleItemClick = (item, e) => {
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            setSelectedPaths((prev) => {
                const next = new Set(prev);
                if (next.has(item.path)) {
                    next.delete(item.path);
                } else {
                    next.add(item.path);
                }
                return next;
            });
        } else if (e.shiftKey && lastClickedPath.current) {
            // Range select
            const itemIndex = items.findIndex((i) => i.path === item.path);
            const lastIndex = items.findIndex((i) => i.path === lastClickedPath.current);
            if (itemIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(itemIndex, lastIndex);
                const end = Math.max(itemIndex, lastIndex);
                setSelectedPaths((prev) => {
                    const next = new Set(prev);
                    for (let i = start; i <= end; i++) {
                        next.add(items[i].path);
                    }
                    return next;
                });
            }
        } else {
            setSelectedPaths(new Set([item.path]));
        }
        lastClickedPath.current = item.path;
    };

    // Rubber band selection
    const handleFileListMouseDown = (e) => {
        // Only start selection on the file list background, not on items
        if (e.button !== 0) return;
        if (e.target.closest('[data-path]')) return;

        isDraggingItemRef.current = false;

        clearSelection();
        isSelecting.current = true;
        setIsDragging(true);
        selectionStart.current = { x: e.clientX, y: e.clientY };
        setSelectionBox({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });

        const handleMouseMove = (moveEvent) => {
            if (!isSelecting.current) return;

            // Mark that we've dragged (used to suppress background click)
            const dx = Math.abs(moveEvent.clientX - selectionStart.current.x);
            const dy = Math.abs(moveEvent.clientY - selectionStart.current.y);
            if (dx > 3 || dy > 3) {
                didDragRef.current = true;
            }

            setSelectionBox((prev) => ({ ...prev, currentX: moveEvent.clientX, currentY: moveEvent.clientY }));

            // Determine which items are inside the selection box
            const startX = selectionStart.current.x;
            const startY = selectionStart.current.y;
            const selLeft = Math.min(startX, moveEvent.clientX);
            const selRight = Math.max(startX, moveEvent.clientX);
            const selTop = Math.min(startY, moveEvent.clientY);
            const selBottom = Math.max(startY, moveEvent.clientY);

            const selected = new Set();
            const fileItems = fileListRef.current?.querySelectorAll('[data-path]');
            fileItems?.forEach((el) => {
                const rect = el.getBoundingClientRect();
                const overlaps =
                    rect.left < selRight &&
                    rect.right > selLeft &&
                    rect.top < selBottom &&
                    rect.bottom > selTop;
                if (overlaps) {
                    selected.add(el.getAttribute('data-path'));
                }
            });
            setSelectedPaths(selected);
        };

        const handleMouseUp = () => {
            isSelecting.current = false;
            setIsDragging(false);
            setSelectionBox({ startX: null, startY: null, currentX: 0, currentY: 0 });
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Click on empty space clears selection
    const handleBackgroundClick = (e) => {
        // Skip if we just finished a drag selection
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }
        if (!e.target.closest('[data-path]')) {
            clearSelection();
        }
    };

    // ---- Context menu ----

    const handleContextMenu = (e, item = null) => {
        e.preventDefault();
        e.stopPropagation();

        if (item && !selectedPaths.has(item.path)) {
            if (!e.ctrlKey && !e.metaKey) {
                setSelectedPaths(new Set([item.path]));
            } else {
                setSelectedPaths((prev) => {
                    const next = new Set(prev);
                    next.add(item.path);
                    return next;
                });
            }
        }

        const pathsToShow = item
            ? (selectedPaths.has(item.path) ? [...selectedPaths] : [item.path])
            : [...selectedPaths];

        setContextMenu({ x: e.clientX, y: e.clientY, paths: pathsToShow, isBackground: !item });
    };

    const closeContextMenu = () => setContextMenu(null);

    // ---- File actions ----

    const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    const apiRequest = async (url, method = 'GET', body = null) => {
        const opts = {
            method,
            headers: { 'X-CSRF-TOKEN': csrfToken(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        };
        const res = await fetch(url, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Operation failed');
        return data;
    };

    const handleNewFolder = () => {
        setShowNewFolderInput(true);
        setNewFolderName('');
        setNewFolderError(null);
    };

    const handleCreateFolder = async () => {
        const name = newFolderName.trim();
        if (!name || !currentPath) return;
        if (!isValidLinuxFilename(name)) {
            setNewFolderError('Invalid name: cannot be empty, contain /, be . or .., start with -, or exceed 255 bytes');
            return;
        }
        setCreatingFolder(true);
        setNewFolderError(null);
        try {
            await apiRequest('/api/filemanager/directories', 'POST', { path: currentPath, name });
            setShowNewFolderInput(false);
            setNewFolderName('');
            fetchFiles(currentPath, activeShare);
        } catch (err) {
            setNewFolderError(err.message);
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleCopy = () => {
        const paths = selectedPaths.size > 0 ? [...selectedPaths] : contextMenu?.paths || [];
        if (paths.length === 0) return;
        setClipboard({ paths, mode: 'copy' });
        closeContextMenu();
    };

    const handleCut = () => {
        const paths = selectedPaths.size > 0 ? [...selectedPaths] : contextMenu?.paths || [];
        if (paths.length === 0) return;
        setClipboard({ paths, mode: 'cut' });
        closeContextMenu();
    };

    const handlePaste = async () => {
        if (!clipboard || !currentPath) return;
        closeContextMenu();
        try {
            if (clipboard.mode === 'copy') {
                await apiRequest('/api/filemanager/copy', 'POST', { paths: clipboard.paths, destination: currentPath });
            } else {
                await apiRequest('/api/filemanager/move', 'POST', { paths: clipboard.paths, destination: currentPath });
                setClipboard(null);
            }
            fetchFiles(currentPath, activeShare);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async () => {
        const paths = selectedPaths.size > 0 ? [...selectedPaths] : contextMenu?.paths || [];
        if (paths.length === 0) return;
        closeContextMenu();
        try {
            await apiRequest('/api/filemanager/delete', 'DELETE', { paths });
            setSelectedPaths(new Set());
            fetchFiles(currentPath, activeShare);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleZip = () => {
        const paths = selectedPaths.size > 0 ? [...selectedPaths] : contextMenu?.paths || [];
        if (paths.length === 0 || !currentPath) return;
        closeContextMenu();
        const defaultName = paths.length === 1
            ? paths[0].split('/').pop().replace(/\.zip$/, '') + '.zip'
            : 'archive.zip';
        zipPathsRef.current = paths;
        setZipName(defaultName);
        setShowZipInput(true);
        setZipError(null);
    };

    const handleCreateZip = async () => {
        const name = zipName.trim();
        if (!name || !currentPath) return;
        const nameToCheck = name.endsWith('.zip') ? name.slice(0, -4) : name;
        if (!isValidLinuxFilename(nameToCheck)) {
            setZipError('Invalid name: cannot be empty, contain /, be . or .., start with -, or exceed 255 bytes');
            return;
        }
        setCreatingZip(true);
        setZipError(null);
        try {
            await apiRequest('/api/filemanager/zip', 'POST', {
                paths: zipPathsRef.current,
                destination: currentPath,
                name,
            });
            setShowZipInput(false);
            setZipName('');
            zipPathsRef.current = [];
            fetchFiles(currentPath, activeShare);
        } catch (err) {
            setZipError(err.message);
        } finally {
            setCreatingZip(false);
        }
    };

    const handleUnzip = async (path) => {
        closeContextMenu();
        try {
            await apiRequest('/api/filemanager/unzip', 'POST', { path, destination: currentPath });
            fetchFiles(currentPath, activeShare);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSelectAll = () => {
        setSelectedPaths(new Set(visibleItems.map((i) => i.path)));
        closeContextMenu();
    };

    const handleDownload = (item) => {
        const url = `/api/filemanager/download?path=${encodeURIComponent(item.path)}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // ---- Context menu items ----

    const getContextMenuItems = () => {
        const paths = contextMenu?.paths || [];
        const hasSelection = paths.length > 0;
        const isZipFile = hasSelection && paths.length === 1 && paths[0].endsWith('.zip');
        const isSingleFile = hasSelection && paths.length === 1 && items.find((i) => i.path === paths[0])?.type === 'file';
        const canWrite = activeShare?.permission === 'readwrite';

        const menuItems = [];

        if (contextMenu?.isBackground) {
            // Background context menu
            menuItems.push({
                label: 'New Folder',
                icon: <IconFolderPlus size={16} />,
                onClick: handleNewFolder,
                disabled: !canWrite,
            });
            if (clipboard) {
                menuItems.push({
                    label: 'Paste',
                    icon: <IconClipboard size={16} />,
                    onClick: handlePaste,
                    disabled: !canWrite,
                    shortcut: 'Ctrl+V',
                });
            }
            menuItems.push({ separator: true });
            menuItems.push({
                label: 'Select All',
                icon: <IconSelectAll size={16} />,
                onClick: handleSelectAll,
                shortcut: 'Ctrl+A',
            });
            menuItems.push({
                label: 'Refresh',
                icon: <IconRefresh size={16} />,
                onClick: handleRefresh,
            });
        } else {
            // Item context menu
            const isSingleFolder = paths.length === 1 && items.find((i) => paths.includes(i.path))?.type === 'directory';
            const hasTopItems = isSingleFolder || isSingleFile;
            if (isSingleFolder) {
                menuItems.push({
                    label: 'Open',
                    icon: <IconCornerDownRight size={16} />,
                    onClick: () => {
                        const clickedItem = items.find((i) => paths.includes(i.path));
                        if (clickedItem?.type === 'directory') fetchFiles(clickedItem.path);
                        closeContextMenu();
                    },
                });
            }
            if (isSingleFile) {
                menuItems.push({
                    label: 'Download',
                    icon: <IconDownload size={16} />,
                    onClick: () => {
                        const file = items.find((i) => i.path === paths[0]);
                        if (file) handleDownload(file);
                        closeContextMenu();
                    },
                });
            }
            if (hasTopItems) {
                menuItems.push({ separator: true });
            }
            menuItems.push({
                label: 'Copy',
                icon: <IconCopy size={16} />,
                onClick: handleCopy,
                shortcut: 'Ctrl+C',
            });
            menuItems.push({
                label: 'Cut',
                icon: <IconCut size={16} />,
                onClick: handleCut,
                shortcut: 'Ctrl+X',
            });
            if (clipboard) {
                menuItems.push({
                    label: 'Paste',
                    icon: <IconClipboard size={16} />,
                    onClick: handlePaste,
                    disabled: !canWrite,
                    shortcut: 'Ctrl+V',
                });
            }
            menuItems.push({ separator: true });
            menuItems.push({
                label: 'Zip',
                icon: <IconZip size={16} />,
                onClick: handleZip,
                disabled: !canWrite,
            });
            if (isZipFile) {
                menuItems.push({
                    label: 'Extract Here',
                    icon: <IconFileZip size={16} />,
                    onClick: () => handleUnzip(paths[0]),
                    disabled: !canWrite,
                });
            }
            menuItems.push({ separator: true });
            menuItems.push({
                label: 'Delete',
                icon: <IconTrash size={16} />,
                onClick: handleDelete,
                disabled: !canWrite,
                danger: true,
                shortcut: 'Del',
            });
        }

        return menuItems;
    };

    // ---- Keyboard shortcuts ----
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (showNewFolderInput || showZipInput) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                handleCopy();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                e.preventDefault();
                handleCut();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                handlePaste();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                handleSelectAll();
            } else if (e.key === 'Delete') {
                handleDelete();
            } else if (e.key === 'Backspace' && !showNewFolderInput && !showZipInput) {
                handleBack();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedPaths, clipboard, currentPath, showNewFolderInput, showZipInput]);

    return (
        <Box style={{ display: 'flex', height: '100%' }}>
            {/* Sidebar */}
            <Box
                style={{
                    width: '220px',
                    minWidth: '220px',
                    backgroundColor: theme.colors.dark[5],
                    borderRight: `1px solid ${theme.colors.dark[4]}`,
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                }}
            >
                <Text size="xs" fw={700} c="dimmed" mb="xs" px="sm" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Shares
                </Text>
                <LoadingOverlay visible={loadingShares} zIndex={1} />
                {shares.length === 0 && !loadingShares && (
                    <Text size="xs" c="dimmed" px="sm">No shares available</Text>
                )}
                {shares.map((share) => (
                    <ShareItem
                        key={share.path}
                        share={share}
                        isActive={activeShare?.path === share.path}
                        onClick={() => handleShareClick(share)}
                    />
                ))}
            </Box>

            {/* Main content */}
            <Box
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: theme.colors.dark[7],
                    overflow: 'hidden',
                }}
            >
                {/* Toolbar */}
                <Box
                    style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${theme.colors.dark[4]}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <Tooltip label="Go back">
                        <ActionIcon variant="subtle" color="gray" onClick={handleBack} disabled={breadcrumbs.length <= 1}>
                            <IconArrowLeft size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Refresh">
                        <ActionIcon variant="subtle" color="gray" onClick={handleRefresh} disabled={!currentPath}>
                            <IconRefresh size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="New folder">
                        <ActionIcon variant="subtle" color="gray" onClick={handleNewFolder} disabled={!currentPath || activeShare?.permission !== 'readwrite'}>
                            <IconFolderPlus size={18} />
                        </ActionIcon>
                    </Tooltip>
                    {clipboard && (
                        <Tooltip label="Paste">
                            <ActionIcon variant="subtle" color="blue" onClick={handlePaste}>
                                <IconClipboard size={18} />
                            </ActionIcon>
                        </Tooltip>
                    )}

                    <Tooltip label={layout === 'list' ? 'Switch to grid view' : 'Switch to list view'}>
                        <ActionIcon variant="subtle" color="gray" onClick={toggleLayout}>
                            {layout === 'list' ? <IconLayoutGrid size={18} /> : <IconList size={18} />}
                        </ActionIcon>
                    </Tooltip>

                    <Tooltip label={showHiddenFiles ? 'Hide hidden files' : 'Show hidden files'}>
                        <ActionIcon variant="subtle" color={showHiddenFiles ? 'blue' : 'gray'} onClick={toggleHiddenFiles}>
                            {showHiddenFiles ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                        </ActionIcon>
                    </Tooltip>

                    <Box style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
                        <Breadcrumbs separator="/" size="sm">
                            {breadcrumbs.map((crumb) => (
                                <Anchor
                                    key={crumb.path}
                                    component="button"
                                    type="button"
                                    onClick={() => handleBreadcrumbClick(crumb.path)}
                                    size="sm"
                                    fw={crumb.path === currentPath ? 600 : 400}
                                >
                                    {crumb.name}
                                </Anchor>
                            ))}
                        </Breadcrumbs>
                    </Box>
                </Box>

                {/* Drop targets for parent folders */}
                {isItemDragging && breadcrumbs.length > 1 && (
                    <Box
                        style={{
                            padding: '4px 16px',
                            borderBottom: `1px solid ${theme.colors.dark[4]}`,
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                        }}
                    >
                        {breadcrumbs.map((crumb, index) => {
                            if (index === breadcrumbs.length - 1) return null;
                            const isDragOver = dragOverCrumbPath === crumb.path;
                            return (
                                <Box
                                    key={crumb.path}
                                    onDragOver={(e) => handleCrumbDragOver(e, crumb)}
                                    onDragLeave={handleCrumbDragLeave}
                                    onDrop={(e) => handleCrumbDrop(e, crumb)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        border: `1px dashed ${isDragOver ? theme.colors.blue[4] : theme.colors.dark[3]}`,
                                        backgroundColor: isDragOver ? theme.colors.blue[8] : theme.colors.dark[6],
                                        color: isDragOver ? 'white' : theme.colors.gray[3],
                                        fontSize: '12px',
                                        cursor: 'default',
                                        transition: 'all 0.15s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                    }}
                                >
                                    <IconFolder size={14} />
                                    {crumb.name}
                                </Box>
                            );
                        })}
                    </Box>
                )}

                {/* New folder input */}
                {showNewFolderInput && (
                    <Box style={{ padding: '8px 16px', borderBottom: `1px solid ${theme.colors.dark[4]}` }}>
                        <Group gap="xs">
                            <TextInput
                                placeholder="Folder name"
                                value={newFolderName}
                                onChange={(e) => { setNewFolderName(e.target.value); setNewFolderError(null); }}
                                size="sm"
                                style={{ flex: 1 }}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateFolder();
                                    else if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); setNewFolderError(null); }
                                }}
                                disabled={creatingFolder}
                                error={newFolderError && !creatingFolder ? ' ' : null}
                            />
                            <ActionIcon
                                variant="light"
                                color="green"
                                size="md"
                                onClick={handleCreateFolder}
                                loading={creatingFolder}
                                disabled={!newFolderName.trim() || creatingFolder}
                            >
                                <IconCheck size={16} />
                            </ActionIcon>
                            <ActionIcon variant="light" color="gray" size="md" onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); setNewFolderError(null); }}>
                                <IconX size={16} />
                            </ActionIcon>
                        </Group>
                        {newFolderError && <Text size="xs" c="red" mt="xs">{newFolderError}</Text>}
                    </Box>
                )}

                {/* Zip name input */}
                {showZipInput && (
                    <Box style={{ padding: '8px 16px', borderBottom: `1px solid ${theme.colors.dark[4]}` }}>
                        <Group gap="xs">
                            <TextInput
                                placeholder="Archive name"
                                value={zipName}
                                onChange={(e) => { setZipName(e.target.value); setZipError(null); }}
                                size="sm"
                                style={{ flex: 1 }}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateZip();
                                    else if (e.key === 'Escape') { setShowZipInput(false); setZipName(''); setZipError(null); zipPathsRef.current = []; }
                                }}
                                disabled={creatingZip}
                                error={zipError && !creatingZip ? ' ' : null}
                            />
                            <ActionIcon
                                variant="light"
                                color="green"
                                size="md"
                                onClick={handleCreateZip}
                                loading={creatingZip}
                                disabled={!zipName.trim() || creatingZip}
                            >
                                <IconCheck size={16} />
                            </ActionIcon>
                            <ActionIcon variant="light" color="gray" size="md" onClick={() => { setShowZipInput(false); setZipName(''); setZipError(null); zipPathsRef.current = []; }}>
                                <IconX size={16} />
                            </ActionIcon>
                        </Group>
                        {zipError && <Text size="xs" c="red" mt="xs">{zipError}</Text>}
                    </Box>
                )}

                {/* Error */}
                {error && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" m="sm" withCloseButton onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {/* File list */}
                <Box
                    ref={fileListRef}
                    style={{ flex: 1, overflow: 'auto', padding: '8px', position: 'relative', userSelect: 'none' }}
                    onMouseDown={handleFileListMouseDown}
                    onClick={handleBackgroundClick}
                    onContextMenu={(e) => handleContextMenu(e, null)}
                >
                    <LoadingOverlay visible={loadingFiles} zIndex={1} />

                    {!currentPath && !loadingFiles && (
                        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                            <Text size="4rem">📁</Text>
                            <Text size="lg" fw={600} c="white">File Manager</Text>
                            <Text c="dimmed" ta="center">Select a share from the sidebar to browse files</Text>
                        </Box>
                    )}

                    {currentPath && visibleItems.length === 0 && !loadingFiles && !error && (
                        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
                            <IconFolder size={48} color={theme.colors.dark[3]} />
                            <Text c="dimmed">This folder is empty</Text>
                        </Box>
                    )}

                    {layout === 'list' ? (
                        visibleItems.map((item) => (
                            <FileItem
                                key={item.path}
                                item={item}
                                isSelected={selectedPaths.has(item.path)}
                                isCut={clipboard?.mode === 'cut' && clipboard.paths.includes(item.path)}
                                isDragging={isDragging}
                                isDragOver={dragOverPath === item.path}
                                onClick={(e) => handleItemClick(item, e)}
                                onDoubleClick={() => handleItemDoubleClick(item)}
                                onContextMenu={(e) => handleContextMenu(e, item)}
                                onMouseDown={() => {}}
                                onDragStart={(e) => handleItemDragStart(e, item)}
                                onDragEnd={handleItemDragEnd}
                                onDragOver={(e) => handleFolderDragOver(e, item)}
                                onDragLeave={handleFolderDragLeave}
                                onDrop={(e) => handleFolderDrop(e, item)}
                                onDownload={handleDownload}
                            />
                        ))
                    ) : (
                        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '4px' }}>
                            {visibleItems.map((item) => (
                                <FileItemGrid
                                    key={item.path}
                                    item={item}
                                    isSelected={selectedPaths.has(item.path)}
                                    isCut={clipboard?.mode === 'cut' && clipboard.paths.includes(item.path)}
                                    isDragging={isDragging}
                                    isDragOver={dragOverPath === item.path}
                                    onClick={(e) => handleItemClick(item, e)}
                                    onDoubleClick={() => handleItemDoubleClick(item)}
                                    onContextMenu={(e) => handleContextMenu(e, item)}
                                    onMouseDown={() => {}}
                                    onDragStart={(e) => handleItemDragStart(e, item)}
                                    onDragEnd={handleItemDragEnd}
                                    onDragOver={(e) => handleFolderDragOver(e, item)}
                                    onDragLeave={handleFolderDragLeave}
                                    onDrop={(e) => handleFolderDrop(e, item)}
                                    onDownload={handleDownload}
                                />
                            ))}
                        </Box>
                    )}
                </Box>

                {/* Status bar */}
                <Box
                    style={{
                        padding: '6px 16px',
                        borderTop: `1px solid ${theme.colors.dark[4]}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                    }}
                >
                    <Text size="xs" c="dimmed">
                        {selectedPaths.size > 0
                            ? `${selectedPaths.size} selected`
                            : `${visibleItems.length} item${visibleItems.length !== 1 ? 's' : ''}`}
                    </Text>
                    {activeShare && (
                        <Text size="xs" c="dimmed">
                            {activeShare.permission === 'readwrite' ? 'Read/Write' : 'Read Only'}
                        </Text>
                    )}
                </Box>
            </Box>

            {/* Context menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={getContextMenuItems()}
                    onClose={closeContextMenu}
                />
            )}

            {/* Rubber band selection */}
            <SelectionBox
                startX={selectionBox.startX}
                startY={selectionBox.startY}
                currentX={selectionBox.currentX}
                currentY={selectionBox.currentY}
            />
        </Box>
    );
}
