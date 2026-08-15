import { useMantineTheme } from '@mantine/core';

const TS_RE = /^\s*\[?(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]?/;
const LEVEL_RE = /(EMERGENCY|CRITICAL|ALERT|ERROR|WARNING|NOTICE|INFO|DEBUG|RUNNING|DONE|FAIL|FAILURE)/g;

function levelColor(word) {
    switch (word) {
        case 'EMERGENCY':
        case 'CRITICAL':
        case 'ALERT':
        case 'ERROR':
        case 'FAIL':
        case 'FAILURE':
            return '#ff6b6b';
        case 'WARNING':
        case 'NOTICE':
            return '#ffd43b';
        case 'INFO':
            return '#a5d8ff';
        case 'DEBUG':
            return '#868e96';
        case 'RUNNING':
            return '#51cf66';
        case 'DONE':
            return '#22b8cf';
        default:
            return '#d0d0d0';
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, term }) {
    if (!term) {
        return text;
    }

    const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, 'ig'));

    return parts.map((part, i) => {
        if (part === '') {
            return null;
        }

        // Odd indices are the captured matches (case preserved).
        if (i % 2 === 1) {
            return (
                <span
                    key={i}
                    style={{
                        backgroundColor: '#facc15',
                        color: '#1a1a1a',
                        borderRadius: '3px',
                        padding: '0 2px',
                    }}
                >
                    {part}
                </span>
            );
        }

        return part;
    });
}

export function LogLine({ text, highlight }) {
    const theme = useMantineTheme();

    const tsMatch = text.match(TS_RE);
    let body = text;
    let prefix = null;

    if (tsMatch) {
        prefix = tsMatch[0];
        body = text.slice(prefix.length);
    }

    const segments = [];
    let lastIndex = 0;
    let match;

    LEVEL_RE.lastIndex = 0;

    while ((match = LEVEL_RE.exec(body)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ level: false, text: body.slice(lastIndex, match.index) });
        }

        segments.push({ level: true, text: match[0], color: levelColor(match[0]) });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < body.length) {
        segments.push({ level: false, text: body.slice(lastIndex) });
    }

    return (
        <div
            style={{
                fontFamily: 'monospace',
                fontSize: '12.5px',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: '1px 0',
            }}
        >
            {prefix && <span style={{ color: '#74c0fc', fontWeight: 600 }}>{prefix}</span>}
            <span style={{ color: theme.colors.gray[4] }}>
                {segments.map((seg, i) => {
                    if (seg.level) {
                        return (
                            <span key={i} style={{ color: seg.color, fontWeight: 600 }}>
                                {seg.text}
                            </span>
                        );
                    }

                    return <HighlightedText key={i} text={seg.text} term={highlight} />;
                })}
            </span>
        </div>
    );
}
