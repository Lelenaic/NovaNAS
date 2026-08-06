import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Text,
    Group,
    Button,
    TextInput,
    Textarea,
    Loader,
    Alert,
    Badge,
    ScrollArea,
    ActionIcon,
    Divider,
    Stack,
    FileInput,
    useMantineTheme,
} from '@mantine/core';
import {
    IconPlus,
    IconSend,
    IconChevronDown,
    IconChevronRight,
    IconInfoCircle,
    IconAlertTriangle,
    IconRefresh,
    IconEdit,
    IconCheck,
    IconX,
    IconLifebuoy,
} from '@tabler/icons-react';

const STORAGE_KEY = 'novanas_support_tickets';

function getStoredTickets(nasUuid) {
    try {
        const raw = localStorage.getItem(`${STORAGE_KEY}_${nasUuid}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function storeTicket(nasUuid, ticket) {
    const tickets = getStoredTickets(nasUuid);
    tickets.unshift(ticket);
    localStorage.setItem(`${STORAGE_KEY}_${nasUuid}`, JSON.stringify(tickets));
}

function updateStoredTicket(nasUuid, ticketId, updates) {
    const tickets = getStoredTickets(nasUuid);
    const idx = tickets.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
        tickets[idx] = { ...tickets[idx], ...updates };
        localStorage.setItem(`${STORAGE_KEY}_${nasUuid}`, JSON.stringify(tickets));
    }
}

const STATUS_COLORS = {
    open: 'green',
    closed: 'gray',
    'waiting for customer\'s response': 'yellow',
    'waiting for staff response': 'blue',
    waiting_for_agent: 'blue',
    waiting_for_customer: 'yellow',
};

function formatStatus(status) {
    if (!status) return '';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatError(data) {
    if (data.errors) {
        return Object.values(data.errors).flat().join('\n');
    }
    return data.message || data.error || 'An error occurred';
}

function MessageBubble({ message, theme, onEdit, isOwn }) {
    const [editing, setEditing] = useState(false);
    const [editBody, setEditBody] = useState(message.body);

    const handleSave = () => {
        if (editBody.trim() && editBody !== message.body) {
            onEdit(message.id, editBody.trim());
        }
        setEditing(false);
    };

    return (
        <Box
            style={{
                alignSelf: isOwn ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                backgroundColor: message.is_staff ? theme.colors.dark[5] : theme.colors.blue[7],
                borderRadius: '12px',
                padding: '12px 16px',
                border: `1px solid ${message.is_staff ? theme.colors.dark[4] : theme.colors.blue[6]}`,
            }}
        >
            <Group gap="xs" mb={4}>
                <Badge size="xs" color={message.is_staff ? 'gray' : 'blue'} variant="light">
                    {message.is_staff ? 'Staff' : 'You'}
                </Badge>
                <Text size="xs" c="rgba(255,255,255,0.6)">
                    {new Date(message.created_at).toLocaleString()}
                </Text>
                {!message.is_staff && !editing && (
                    <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => setEditing(true)}
                    >
                        <IconEdit size={12} />
                    </ActionIcon>
                )}
            </Group>
            {editing ? (
                <Box>
                    <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        autosize
                        minRows={2}
                        size="sm"
                    />
                    <Group gap="xs" mt={4}>
                        <ActionIcon size="sm" color="green" variant="subtle" onClick={handleSave}>
                            <IconCheck size={14} />
                        </ActionIcon>
                        <ActionIcon size="sm" color="gray" variant="subtle" onClick={() => { setEditing(false); setEditBody(message.body); }}>
                            <IconX size={14} />
                        </ActionIcon>
                    </Group>
                </Box>
            ) : (
                <Text size="sm" c="white" style={{ whiteSpace: 'pre-wrap' }}>
                    {message.body}
                </Text>
            )}
        </Box>
    );
}

function NewTicketView({ systemInfo, nasUuid, onSubmit, onCancel, loading, error }) {
    const theme = useMantineTheme();
    const [email, setEmail] = useState(systemInfo?.email || '');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [infoExpanded, setInfoExpanded] = useState(true);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            email,
            nas_uuid: nasUuid,
            subject,
            body,
            debian_version: systemInfo?.debian_version,
            novanas_version: systemInfo?.novanas_version,
            storage_info: systemInfo?.storage_info,
            installed_software: systemInfo?.installed_software,
            apt_updates_count: systemInfo?.apt_updates_count,
            attachments,
        });
    };

    return (
        <Box component="form" onSubmit={handleSubmit} style={{ maxWidth: '700px' }}>
            <Group justify="space-between" mb="lg">
                <div>
                    <Text size="xl" fw={700} c="white">New Support Ticket</Text>
                    <Text size="sm" c="dimmed">Describe your issue and we'll help you out</Text>
                </div>
            </Group>

            {error && (
                <Alert color="red" variant="light" mb="md" icon={<IconAlertTriangle size={16} />}>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{error}</Text>
                </Alert>
            )}

            <Stack gap="md">
                <TextInput
                    label="Email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <TextInput
                    label="Subject"
                    placeholder="Brief description of your issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                />
                <Textarea
                    label="Message"
                    placeholder="Describe your issue in detail..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    autosize
                    minRows={5}
                    required
                />
                <FileInput
                    label="Attachments"
                    placeholder="Images, .log, .txt (max 10 files, 10MB each)"
                    multiple
                    maxFiles={10}
                    value={attachments}
                    onChange={setAttachments}
                    accept=".jpg,.jpeg,.png,.log,.txt"
                />

                {/* System Info Preview */}
                <Box
                    style={{
                        backgroundColor: theme.colors.dark[6],
                        borderRadius: '8px',
                        border: `1px solid ${theme.colors.dark[4]}`,
                    }}
                >
                    <Group
                        p="sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setInfoExpanded(!infoExpanded)}
                    >
                        <IconInfoCircle size={18} color={theme.colors.blue[4]} />
                        <Text size="sm" fw={600} c="white" style={{ flex: 1 }}>
                            System Information Preview
                        </Text>
                        <Badge size="sm" color="blue" variant="light">
                            Auto-attached
                        </Badge>
                        <ActionIcon size="sm" variant="subtle" color="gray">
                            {infoExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                        </ActionIcon>
                    </Group>
                    {infoExpanded && (
                        <Box p="sm" pt={0}>
                            <Alert color="blue" variant="light" mb="sm" icon={<IconInfoCircle size={16} />}>
                                The following information will be sent with your ticket to help us diagnose your issue.
                            </Alert>
                            <Stack gap={4}>
                                <InfoRow label="Email" value={email || '(not provided)'} />
                                <InfoRow label="NAS UID" value={nasUuid} />
                                <InfoRow label="NovaNAS Version" value={systemInfo?.novanas_version || 'unknown'} />
                                <InfoRow label="Debian Version" value={systemInfo?.debian_version || 'unknown'} />
                                <InfoRow label="Apt Updates Available" value={systemInfo?.apt_updates_count?.toString() ?? 'unknown'} />
                                {systemInfo?.storage_info?.length > 0 && (
                                    <Box>
                                        <Text size="xs" c="dimmed" fw={600}>Storage Pools</Text>
                                        {systemInfo.storage_info.map((info, i) => (
                                            <Text key={i} size="xs" c="gray.3" ml="sm">{info}</Text>
                                        ))}
                                    </Box>
                                )}
                                {systemInfo?.installed_software?.length > 0 && (
                                    <Box>
                                        <Text size="xs" c="dimmed" fw={600}>Installed Software</Text>
                                        <Text size="xs" c="gray.3" ml="sm">
                                            {systemInfo.installed_software.join(', ')}
                                        </Text>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    )}
                </Box>

                <Group justify="flex-end">
                    <Button variant="subtle" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading} leftSection={<IconSend size={16} />}>
                        Submit Ticket
                    </Button>
                </Group>
            </Stack>
        </Box>
    );
}

function InfoRow({ label, value }) {
    return (
        <Group gap="sm">
            <Text size="xs" c="dimmed" fw={600} style={{ minWidth: '140px' }}>
                {label}
            </Text>
            <Text size="xs" c="gray.3">
                {value}
            </Text>
        </Group>
    );
}

function ConversationView({ ticket, messages, loading, error, onSendMessage, onEditMessage, sending }) {
    const theme = useMantineTheme();
    const [replyBody, setReplyBody] = useState('');
    const [replyAttachments, setReplyAttachments] = useState([]);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!replyBody.trim()) return;
        onSendMessage(ticket.security_key, replyBody.trim(), replyAttachments);
        setReplyBody('');
        setReplyAttachments([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSend();
        }
    };

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Group justify="space-between" mb="md">
                <div>
                    <Text size="xl" fw={700} c="white">{ticket.subject}</Text>
                    <Group gap="xs">
                        <Badge color={STATUS_COLORS[ticket.status] || 'gray'} variant="light">
                            {formatStatus(ticket.status)}
                        </Badge>
                        <Text size="xs" c="rgba(255,255,255,0.6)">
                            Ticket #{ticket.id}
                        </Text>
                    </Group>
                </div>
            </Group>

            {error && (
                <Alert color="red" variant="light" mb="md">
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{error}</Text>
                </Alert>
            )}

            {/* Messages */}
            <ScrollArea style={{ flex: 1, marginBottom: '16px' }}>
                <Stack gap="md" p="sm">
                    {loading ? (
                        <Box style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                            <Loader size="md" />
                        </Box>
                    ) : messages.length === 0 ? (
                        <Text c="dimmed" ta="center" p="xl">No messages yet.</Text>
                    ) : (
                        messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                theme={theme}
                                onEdit={(msgId, newBody) => onEditMessage(ticket.id, msgId, ticket.security_key, newBody)}
                                isOwn={!msg.is_staff}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </Stack>
            </ScrollArea>

            {/* Reply Box */}
            <Box
                style={{
                    backgroundColor: theme.colors.dark[6],
                    borderRadius: '8px',
                    padding: '12px',
                    border: `1px solid ${theme.colors.dark[4]}`,
                }}
            >
                <Textarea
                    placeholder="Type your reply... (Ctrl+Enter to send)"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autosize
                    minRows={2}
                    maxRows={6}
                    mb="sm"
                />
                <FileInput
                    placeholder="Attach files (images, .log, .txt — max 10 files, 10MB)"
                    multiple
                    maxFiles={10}
                    value={replyAttachments}
                    onChange={setReplyAttachments}
                    size="xs"
                    accept=".jpg,.jpeg,.png,.log,.txt"
                    mb="sm"
                />
                <Group justify="flex-end">
                    <Button
                        leftSection={<IconSend size={16} />}
                        onClick={handleSend}
                        loading={sending}
                        disabled={!replyBody.trim()}
                    >
                        Send Reply
                    </Button>
                </Group>
            </Box>
        </Box>
    );
}

export function SupportAppContent() {
    const theme = useMantineTheme();
    const [view, setView] = useState('list');
    const [tickets, setTickets] = useState([]);
    const [activeTicket, setActiveTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [systemInfo, setSystemInfo] = useState(null);
    const [nasUuid, setNasUuid] = useState('');
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    // Load system info and stored tickets on mount
    useEffect(() => {
        initApp();
    }, []);

    const initApp = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/support/system-info');
            const data = await response.json();
            setSystemInfo(data);
            setNasUuid(data.nas_uuid);

            const stored = getStoredTickets(data.nas_uuid);
            setTickets(stored);
        } catch (err) {
            setError('Failed to load system information');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleNewTicket = useCallback(() => {
        setView('new');
        setActiveTicket(null);
        setMessages([]);
    }, []);

    const handleSelectTicket = useCallback(async (ticket) => {
        setView('ticket');
        setActiveTicket(ticket);
        setMessagesLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/support/tickets/${ticket.id}/messages`,
                {
                    headers: {
                        'X-Support-Key': ticket.security_key,
                    },
                }
            );
            const data = await response.json();

            if (response.ok) {
                setMessages(data.data?.messages || []);
                // Update status if it changed
                if (data.data?.ticket?.status) {
                    updateStoredTicket(nasUuid, ticket.id, { status: data.data.ticket.status });
                    setActiveTicket((prev) => ({ ...prev, status: data.data.ticket.status }));
                    setTickets((prev) =>
                        prev.map((t) =>
                            t.id === ticket.id ? { ...t, status: data.data.ticket.status } : t
                        )
                    );
                }
            } else {
                setError(formatError(data));
            }
        } catch (err) {
            setError('Failed to load messages');
            console.error(err);
        } finally {
            setMessagesLoading(false);
        }
    }, [nasUuid]);

    const handleSubmitTicket = useCallback(async (formData) => {
        setSubmitting(true);
        setError(null);

        try {
            const body = new FormData();
            body.append('email', formData.email);
            body.append('nas_uuid', formData.nas_uuid);
            body.append('subject', formData.subject);
            body.append('body', formData.body);

            if (formData.debian_version) body.append('debian_version', formData.debian_version);
            if (formData.novanas_version) body.append('novanas_version', formData.novanas_version);
            if (formData.apt_updates_count != null) body.append('apt_updates_count', String(formData.apt_updates_count));

            if (formData.storage_info) {
                formData.storage_info.forEach((info, i) => body.append(`storage_info[${i}]`, info));
            }
            if (formData.installed_software) {
                formData.installed_software.forEach((sw, i) => body.append(`installed_software[${i}]`, sw));
            }
            if (formData.attachments) {
                formData.attachments.forEach((file) => body.append('attachments[]', file));
            }

            const response = await fetch('/api/support/tickets', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                    'Accept': 'application/json',
                },
                body,
            });

            const data = await response.json();

            if (response.ok) {
                const ticket = data.data;
                storeTicket(nasUuid, ticket);
                setTickets((prev) => [ticket, ...prev]);
                setActiveTicket(ticket);
                setView('ticket');
                setMessages([]);

                try {
                    const msgResponse = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
                        headers: {
                            'X-Support-Key': ticket.security_key,
                        },
                    });
                    const msgData = await msgResponse.json();
                    if (msgResponse.ok) {
                        setMessages(msgData.data?.messages || []);
                    }
                } catch {
                    // Messages may not be available yet on a freshly created ticket
                }
            } else {
                if (data.errors) {
                    const allErrors = Object.values(data.errors).flat().join('\n');
                    setError(allErrors);
                } else {
                    setError(formatError(data));
                }
            }
        } catch (err) {
            setError('Failed to create ticket');
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    }, [nasUuid]);

    const handleSendMessage = useCallback(async (securityKey, body, attachments = []) => {
        if (!activeTicket) return;

        setSending(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('body', body);

            attachments.forEach((file) => formData.append('attachments[]', file));

            const response = await fetch(`/api/support/tickets/${activeTicket.id}/messages`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                    'X-Support-Key': securityKey,
                },
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setMessages((prev) => [...prev, data.data]);
            } else {
                setError(formatError(data));
            }
        } catch (err) {
            setError('Failed to send message');
            console.error(err);
        } finally {
            setSending(false);
        }
    }, [activeTicket]);

    const handleEditMessage = useCallback(async (ticketId, messageId, securityKey, newBody) => {
        try {
            const response = await fetch(
                `/api/support/tickets/${ticketId}/messages/${messageId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
                        'X-Support-Key': securityKey,
                    },
                    body: JSON.stringify({ body: newBody }),
                }
            );

            const data = await response.json();

            if (response.ok) {
                setMessages((prev) =>
                    prev.map((m) => (m.id === messageId ? { ...m, body: newBody } : m))
                );
            } else {
                setError(formatError(data));
            }
        } catch (err) {
            setError('Failed to edit message');
            console.error(err);
        }
    }, []);

    const handleBack = useCallback(() => {
        setView('list');
        setActiveTicket(null);
        setMessages([]);
        setError(null);
    }, []);

    if (loading) {
        return (
            <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader size="lg" />
            </Box>
        );
    }

    return (
        <Box style={{ display: 'flex', height: '100%' }}>
            {/* Sidebar */}
            <Box
                style={{
                    width: '260px',
                    minWidth: '260px',
                    backgroundColor: theme.colors.dark[5],
                    borderRight: `1px solid ${theme.colors.dark[4]}`,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box p="sm">
                    <Group justify="space-between" mb="sm">
                        <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Support
                        </Text>
                        <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="blue"
                            onClick={handleNewTicket}
                            title="New Ticket"
                        >
                            <IconPlus size={16} />
                        </ActionIcon>
                    </Group>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        fullWidth
                        size="sm"
                        onClick={handleNewTicket}
                    >
                        New Ticket
                    </Button>
                </Box>

                <Divider />

                <ScrollArea style={{ flex: 1 }}>
                    <Stack gap={2} p="xs">
                        {tickets.length === 0 ? (
                            <Text size="xs" c="dimmed" ta="center" p="md">
                                No tickets yet
                            </Text>
                        ) : (
                            tickets.map((ticket) => (
                                <Box
                                    key={ticket.id}
                                    onClick={() => handleSelectTicket(ticket)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        backgroundColor: activeTicket?.id === ticket.id
                                            ? theme.colors.blue[7]
                                            : 'transparent',
                                        transition: 'background-color 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (activeTicket?.id !== ticket.id) {
                                            e.currentTarget.style.backgroundColor = theme.colors.dark[4];
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (activeTicket?.id !== ticket.id) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    <Text size="sm" fw={600} c="white" truncate>
                                        {ticket.subject}
                                    </Text>
                                    <Group gap="xs" mt={2}>
                                        <Badge
                                            size="xs"
                                            color={STATUS_COLORS[ticket.status] || 'gray'}
                                            variant="light"
                                        >
                                            {formatStatus(ticket.status)?.length > 20
                                                ? formatStatus(ticket.status).substring(0, 20) + '...'
                                                : formatStatus(ticket.status)}
                                        </Badge>
                                        <Text size="xs" c="rgba(255,255,255,0.6)">
                                            #{ticket.id}
                                        </Text>
                                        {ticket.created_at && (
                                            <Text size="xs" c="rgba(255,255,255,0.4)">
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                            </Text>
                                        )}
                                    </Group>
                                </Box>
                            ))
                        )}
                    </Stack>
                </ScrollArea>
            </Box>

            {/* Main Content */}
            <Box style={{ flex: 1, padding: '20px', overflow: 'auto', backgroundColor: theme.colors.dark[7] }}>
                {view === 'list' && (
                    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <IconLifebuoy size={48} color="gray" />
                        <Text size="lg" fw={600} c="white" mt="md">
                            NovaNAS Support
                        </Text>
                        <Text c="dimmed" ta="center" mb="md">
                            Select a ticket or create a new one
                        </Text>
                        <Button leftSection={<IconPlus size={16} />} onClick={handleNewTicket}>
                            New Support Ticket
                        </Button>
                    </Box>
                )}

                {view === 'new' && (
                    <NewTicketView
                        systemInfo={systemInfo}
                        nasUuid={nasUuid}
                        onSubmit={handleSubmitTicket}
                        onCancel={handleBack}
                        loading={submitting}
                        error={error}
                    />
                )}

                {view === 'ticket' && activeTicket && (
                    <ConversationView
                        ticket={activeTicket}
                        messages={messages}
                        loading={messagesLoading}
                        error={error}
                        onSendMessage={handleSendMessage}
                        onEditMessage={handleEditMessage}
                        sending={sending}
                    />
                )}
            </Box>
        </Box>
    );
}
