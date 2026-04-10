import { Box, Button, Loader, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

export function TerminalAppContent() {
    const [sessionUrl, setSessionUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        createSession();
    }, []);

    const createSession = async () => {
        try {
            const response = await fetch('/api/terminal/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                },
            });

            const data = await response.json();

            if (response.ok) {
                setSessionUrl(data.url);
            } else {
                setError(data.error || 'Failed to create terminal session');
            }
        } catch (err) {
            setError('Failed to create terminal session');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box
                style={{
                    padding: '24px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Loader size="lg" />
                <Text mt="md">Starting terminal session...</Text>
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                style={{
                    padding: '24px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Text color="red" mb="md">{error}</Text>
                <Button onClick={createSession}>Retry</Button>
            </Box>
        );
    }

    return (
        <Box style={{ height: '100%', width: '100%' }}>
            <iframe
                src={sessionUrl}
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                }}
                title="Terminal"
            />
        </Box>
    );
}