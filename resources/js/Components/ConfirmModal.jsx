import { useCallback, useRef, useState } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';

export function ConfirmModal({
    opened,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    color = 'red',
    loading = false,
    ...rest
}) {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={<Text fw={600}>{title}</Text>}
            size="sm"
            centered
            {...rest}
        >
            {message && (
                <Text c="dimmed" mb="lg">
                    {message}
                </Text>
            )}
            <Group justify="flex-end">
                <Button variant="subtle" onClick={onClose}>
                    {cancelLabel}
                </Button>
                <Button color={color} onClick={onConfirm} loading={loading}>
                    {confirmLabel}
                </Button>
            </Group>
        </Modal>
    );
}

export function useConfirmModal() {
    const [state, setState] = useState(null);
    const resolverRef = useRef(null);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setState(options);
        });
    }, []);

    const close = useCallback((result) => {
        setState(null);
        if (resolverRef.current) {
            resolverRef.current(result);
            resolverRef.current = null;
        }
    }, []);

    const confirmModal = state ? (
        <ConfirmModal
            {...state}
            onClose={() => close(false)}
            onConfirm={() => close(true)}
        />
    ) : null;

    return [confirm, confirmModal];
}