import { Box, Button, Loader, Text } from '@mantine/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindow } from '../Desktop/WindowContext';

export function MonitorAppContent({ windowId }) {
    const [sessionUrl, setSessionUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const sessionIdRef = useRef(null);
    const iframeLoadedRef = useRef(false);
    const iframeRef = useRef(null);
    const { closeWindow } = useWindow();

    useEffect(() => {
        createSession();

        return () => {
            if (sessionIdRef.current) {
                fetch(`/api/monitor/session/${sessionIdRef.current}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                    },
                }).catch(() => {});
            }
        };
    }, []);

    const createSession = async () => {
        try {
            const response = await fetch('/api/monitor/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (response.ok) {
                sessionIdRef.current = data.session_id;
                setSessionUrl(data.url);
            } else {
                setError(data.error || 'Failed to create monitor session');
            }
        } catch (err) {
            setError('Failed to create monitor session');
        } finally {
            setLoading(false);
        }
    };

    const handleIframeLoad = useCallback(() => {
        if (iframeLoadedRef.current) {
            if (sessionIdRef.current) {
                fetch(`/api/monitor/session/${sessionIdRef.current}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                    },
                }).catch(() => {});
                sessionIdRef.current = null;
            }
            if (windowId) {
                closeWindow(windowId);
            }
        }
        iframeLoadedRef.current = true;

        setTimeout(() => {
            try {
                iframeRef.current?.contentWindow?.dispatchEvent(new Event('resize'));
            } catch {}
        }, 100);
    }, [windowId, closeWindow]);

    if (loading) {
        return (
            <Box
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Loader size="lg" />
                <Text mt="md">Starting system monitor...</Text>
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Text c="red" mb="md">{error}</Text>
                <Button onClick={createSession}>Retry</Button>
            </Box>
        );
    }

    return (
        <iframe
            ref={iframeRef}
            src={sessionUrl}
            onLoad={handleIframeLoad}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
            }}
            title="System Monitor"
        />
    );
}
