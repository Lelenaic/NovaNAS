import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';

const darkTheme = createTheme({
    theme: 'dark',
    settings: {
        background: '#25262b',
        foreground: '#c1c2c5',
        caret: '#ffd43b',
        selection: '#339af050',
        selectionMatch: '#339af030',
        lineHighlight: '#ffffff08',
        gutterBackground: '#25262b',
        gutterForeground: '#5c5f66',
        gutterBorder: '#373a40',
    },
    styles: [
        { tag: t.comment, color: '#5c5f66', fontStyle: 'italic' },
        { tag: t.lineComment, color: '#5c5f66', fontStyle: 'italic' },
        { tag: t.blockComment, color: '#5c5f66', fontStyle: 'italic' },
        { tag: t.string, color: '#69db7c' },
        { tag: t.special(t.string), color: '#69db7c' },
        { tag: t.number, color: '#ffa94d' },
        { tag: t.integer, color: '#ffa94d' },
        { tag: t.float, color: '#ffa94d' },
        { tag: t.bool, color: '#748ffc' },
        { tag: t.null, color: '#748ffc' },
        { tag: t.keyword, color: '#748ffc' },
        { tag: t.operator, color: '#c1c2c5' },
        { tag: t.className, color: '#ffa94d' },
        { tag: t.typeName, color: '#ffa94d' },
        { tag: t.definition(t.variableName), color: '#74c0fc' },
        { tag: t.variableName, color: '#74c0fc' },
        { tag: t.propertyName, color: '#74c0fc' },
        { tag: t.function(t.variableName), color: '#74c0fc' },
        { tag: t.tagName, color: '#ff6b6b' },
        { tag: t.angleBracket, color: '#5c5f66' },
        { tag: t.attributeName, color: '#ffa94d' },
        { tag: t.regexp, color: '#ff6b6b' },
        { tag: t.self, color: '#ff6b6b' },
        { tag: t.meta, color: '#5c5f66' },
        { tag: t.annotation, color: '#5c5f66' },
    ],
});

const baseExtensions = [
    EditorView.lineWrapping,
    yaml(),
];

export function CodeEditor({
    value = '',
    onChange,
    readOnly = false,
    height = '400px',
    className,
    placeholder,
}) {
    const extensions = useMemo(() => {
        const ext = [...baseExtensions];

        if (readOnly) {
            ext.push(EditorView.editable.of(false));
        }

        return ext;
    }, [readOnly]);

    return (
        <div className={className} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #373a40' }}>
            <CodeMirror
                value={value}
                height={height}
                theme={darkTheme}
                extensions={extensions}
                onChange={onChange}
                readOnly={readOnly}
                placeholder={placeholder}
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    foldGutter: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    syntaxHighlighting: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: false,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    searchKeymap: true,
                    foldKeymap: true,
                    completionKeymap: true,
                    lintKeymap: true,
                }}
            />
        </div>
    );
}
