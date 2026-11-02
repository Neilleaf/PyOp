import { useEffect, useRef, useState } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import {
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { codeLengthLimit, limitRejected } from '../utils/editor';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const pythonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c9a4f2' },
  { tag: tags.string, color: '#b4db8e' },
  { tag: [tags.number, tags.bool, tags.null], color: '#f0be86' },
  { tag: tags.comment, color: '#98a6bb' },
  { tag: tags.function(tags.variableName), color: '#91c3f0' },
  { tag: tags.definition(tags.variableName), color: '#91c3f0' },
  { tag: [tags.operator, tags.punctuation], color: '#c8d1e0' },
]);

export function PythonEditor({ value, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const [limitError, setLimitError] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        extensions: [
          lineNumbers(),
          python(),
          history(),
          indentOnInput(),
          indentUnit.of('    '),
          syntaxHighlighting(pythonHighlightStyle),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          placeholder('# Paste your Python code here, or choose an optional sample…'),
          codeLengthLimit,
          EditorView.contentAttributes.of({
            role: 'textbox',
            'aria-multiline': 'true',
            'aria-labelledby': 'python-code-label',
            'aria-describedby': 'editor-help code-count editor-limit-message',
            spellcheck: 'false',
            autocapitalize: 'off',
            autocorrect: 'off',
          }),
          EditorView.theme(
            {
              '&': { backgroundColor: '#101318', color: '#e6e8ec' },
              '.cm-content': {
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                fontSize: '13px',
                minHeight: '330px',
                padding: '18px 0',
                caretColor: '#b4eb7c',
              },
              '.cm-line': { padding: '0 18px' },
              '.cm-gutters': {
                backgroundColor: '#101318',
                color: '#7f8999',
                borderRight: '1px solid #2a2e36',
                paddingTop: '18px',
              },
              '.cm-placeholder': { color: '#9ca3ae' },
              '.cm-cursor': { borderLeftColor: '#b4eb7c' },
              '.cm-scroller': { overflow: 'auto', maxHeight: '550px' },
              '&.cm-focused': { outline: 'none' },
              '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
                backgroundColor: '#3a4b59',
              },
            },
            { dark: true },
          ),
          EditorView.updateListener.of((update) => {
            if (
              update.transactions.some((transaction) =>
                transaction.effects.some((effect) => effect.is(limitRejected)),
              )
            ) {
              setLimitError(true);
            } else if (update.docChanged) {
              setLimitError(false);
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    editor.current = view;
    return () => {
      editor.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = editor.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <section className="panel editor-panel" aria-labelledby="python-code-label">
      <div className="editor-heading">
        <div className="section-heading">
          <span className="step">01</span>
          <h2 id="python-code-label">Python code</h2>
        </div>
        <span className="eyebrow">INPUT ONLY</span>
      </div>
      <div className="editor-file">
        <span className="dot series-1" /> scratch.py<span>Python · stays in this tab</span>
      </div>
      <div className="editor-host" ref={host} />
      <div className="editor-status">
        <span>Python</span>
        <output id="code-count" aria-label="Code character count">
          {value.length.toLocaleString('en-US')} / 7,000 characters
        </output>
      </div>
      <div className="editor-actions">
        <button type="button" className="run-button" disabled aria-describedby="execution-help">
          Run Analysis <span aria-hidden="true">↗</span>
        </button>
        <p id="execution-help">
          Custom-code execution is not available yet. Your code is never sent or executed.
        </p>
      </div>
      <p id="editor-help" className="editor-help">
        Tab indents; press Escape then Tab to leave the editor. Code is kept in memory only and is
        lost on reload.
      </p>
      <p id="editor-limit-message" className="editor-limit" role="status">
        {limitError
          ? 'Edit rejected: the maximum is 7,000 characters. Your previous code was kept.'
          : 'Maximum 7,000 characters. Larger edits are rejected in full.'}
      </p>
    </section>
  );
}
