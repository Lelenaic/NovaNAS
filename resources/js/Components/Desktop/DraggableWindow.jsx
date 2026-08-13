import { useState, useRef, useEffect } from 'react';
import { Box, Text, Group, useMantineTheme } from '@mantine/core';
import { useWindow } from './WindowContext';
import { useIsMobile } from './useIsMobile';

const SNAP_THRESHOLD = 20;

function TrafficLightButton({ color, hoverColor, icon, onClick, onMouseEnter, onMouseLeave, isHovered }) {
    return (
        <Box
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 150ms ease, transform 100ms ease',
                boxShadow: isHovered ? `0 0 8px ${color}40` : 'none',
                transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                position: 'relative',
            }}
        >
            <Box
                style={{
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 150ms ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 0,
                }}
            >
                {icon}
            </Box>
        </Box>
    );
}

function MinimizeIcon() {
    return (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4h6" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function MaximizeIcon() {
    return (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 1.5h5v5h-5z" stroke="rgba(0,0,0,0.6)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function RestoreIcon() {
    return (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2 5.5V2.5h3" stroke="rgba(0,0,0,0.6)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 2.5v3h-3" stroke="rgba(0,0,0,0.6)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

export function DraggableWindow({ windowState, children }) {
    const {
        closeWindow,
        maximizeWindow,
        minimizeWindow,
        focusWindow,
        moveWindow,
        resizeWindow,
    } = useWindow();

    const isMobile = useIsMobile();
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState(null);
    const [hoveredButton, setHoveredButton] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const windowPos = useRef({ x: windowState.x, y: windowState.y });
    const windowSize = useRef({ width: windowState.width, height: windowState.height });
    const theme = useMantineTheme();

    // On mobile, force maximized
    const forceMaximized = isMobile || windowState.maximized;

    useEffect(() => {
        if (forceMaximized) {
            windowPos.current = { x: 0, y: 0 };
            windowSize.current = { width: windowState.width, height: windowState.height };
        }
    }, [forceMaximized, windowState.width, windowState.height]);

    const handleMouseDown = (e) => {
        if (forceMaximized) return;
        focusWindow(windowState.id);
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        windowPos.current = { x: windowState.x, y: windowState.y };
    };

    const handleResizeStart = (direction, e) => {
        if (forceMaximized) return;
        e.stopPropagation();
        focusWindow(windowState.id);
        setIsResizing(true);
        setResizeDirection(direction);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        windowPos.current = { x: windowState.x, y: windowState.y };
        windowSize.current = { width: windowState.width, height: windowState.height };
    };

    useEffect(() => {
        if (!isDragging && !isResizing) return;

        const handleMouseMove = (e) => {
            if (isDragging) {
                const deltaX = e.clientX - dragStartPos.current.x;
                const deltaY = e.clientY - dragStartPos.current.y;
                let newX = windowPos.current.x + deltaX;
                let newY = windowPos.current.y + deltaY;

                const screenWidth = globalThis.window.innerWidth;
                const screenHeight = globalThis.window.innerHeight;

                const snapLeft = newX <= SNAP_THRESHOLD;
                const snapRight = newX >= screenWidth - windowState.width - SNAP_THRESHOLD;
                const snapTop = newY <= SNAP_THRESHOLD;

                if (snapLeft) newX = 0;
                if (snapRight) newX = screenWidth - windowState.width;
                if (snapTop) newY = 0;

                moveWindow(windowState.id, newX, newY);
            }

            if (isResizing) {
                const deltaX = e.clientX - dragStartPos.current.x;
                const deltaY = e.clientY - dragStartPos.current.y;
                let newX = windowPos.current.x;
                let newY = windowPos.current.y;
                let newWidth = windowSize.current.width;
                let newHeight = windowSize.current.height;

                if (resizeDirection.includes('e')) {
                    newWidth = Math.max(300, windowSize.current.width + deltaX);
                }
                if (resizeDirection.includes('w')) {
                    newWidth = Math.max(300, windowSize.current.width - deltaX);
                    if (newWidth > 300) {
                        newX = windowPos.current.x + deltaX;
                    }
                }
                if (resizeDirection.includes('s')) {
                    newHeight = Math.max(200, windowSize.current.height + deltaY);
                }
                if (resizeDirection.includes('n')) {
                    newHeight = Math.max(200, windowSize.current.height - deltaY);
                    if (newHeight > 200) {
                        newY = windowPos.current.y + deltaY;
                    }
                }

                moveWindow(windowState.id, newX, newY);
                resizeWindow(windowState.id, newWidth, newHeight);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            setResizeDirection(null);
        };

        globalThis.window.addEventListener('mousemove', handleMouseMove);
        globalThis.window.addEventListener('mouseup', handleMouseUp);

        return () => {
            globalThis.window.removeEventListener('mousemove', handleMouseMove);
            globalThis.window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, resizeDirection, windowState.id, moveWindow, resizeWindow, windowState.width]);

    if (windowState.minimized) {
        return null;
    }

    return (
        <Box
            style={{
                position: 'absolute',
                left: forceMaximized ? 0 : windowState.x,
                top: forceMaximized ? 0 : windowState.y,
                width: forceMaximized ? '100%' : windowState.width,
                height: forceMaximized ? '100%' : windowState.height,
                zIndex: windowState.zIndex,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: forceMaximized ? 0 : '12px',
                overflow: 'hidden',
                boxShadow: forceMaximized
                    ? 'none'
                    : '0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                border: forceMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
            }}
            onMouseDown={() => focusWindow(windowState.id)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Window Title Bar */}
            <Box
                onMouseDown={handleMouseDown}
                style={{
                    height: '40px',
                    backgroundColor: 'rgba(38, 38, 45, 0.85)',
                    backdropFilter: 'blur(16px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: forceMaximized ? 'default' : 'move',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    userSelect: 'none',
                }}
            >
                {/* Traffic Light Buttons */}
                <Group gap={7} style={{ flexShrink: 0 }}>
                    <TrafficLightButton
                        color="#ff5f57"
                        hoverColor="#ff4040"
                        icon={<CloseIcon />}
                        isHovered={hoveredButton === 'close'}
                        onMouseEnter={() => setHoveredButton('close')}
                        onMouseLeave={() => setHoveredButton(null)}
                        onClick={() => closeWindow(windowState.id)}
                    />
                    {!isMobile && (
                        <TrafficLightButton
                            color="#28c840"
                            hoverColor="#20b838"
                            icon={forceMaximized ? <RestoreIcon /> : <MaximizeIcon />}
                            isHovered={hoveredButton === 'maximize'}
                            onMouseEnter={() => setHoveredButton('maximize')}
                            onMouseLeave={() => setHoveredButton(null)}
                            onClick={() => maximizeWindow(windowState.id)}
                        />
                    )}
                </Group>

                {/* Window Title */}
                <Box
                    style={{
                        flex: 1,
                        textAlign: 'center',
                        paddingRight: isMobile ? '40px' : '56px',
                    }}
                >
                    <Text
                        size="sm"
                        fw={500}
                        c="rgba(255, 255, 255, 0.85)"
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            letterSpacing: '0.01em',
                        }}
                    >
                        {windowState.title}
                    </Text>
                </Box>
            </Box>

            {/* Window Content */}
            <Box
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative',
                    backgroundColor: theme.colors.dark[8],
                    minHeight: 0,
                }}
            >
                {children}
            </Box>

            {/* Resize Handles */}
            {!forceMaximized && (
                <>
                    <Box
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '8px',
                            height: '100%',
                            cursor: 'ew-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('w', e)}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '8px',
                            height: '100%',
                            cursor: 'ew-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('e', e)}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '8px',
                            cursor: 'ns-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('n', e)}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            width: '100%',
                            height: '8px',
                            cursor: 'ns-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('s', e)}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '12px',
                            height: '12px',
                            cursor: 'nwse-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('nw', e)}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '12px',
                            height: '12px',
                            cursor: 'nesw-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('ne', e)}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            width: '12px',
                            height: '12px',
                            cursor: 'nesw-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('sw', e)}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '12px',
                            height: '12px',
                            cursor: 'nwse-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart('se', e)}
                    />
                </>
            )}
        </Box>
    );
}
