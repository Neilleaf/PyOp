import { EditorState, type Transaction } from '@codemirror/state';
import { undo, redo, history } from '@codemirror/commands';
import { describe, expect, it } from 'vitest';
import { codeLengthLimit, limitRejected, MAX_CODE_LENGTH } from './editor';

describe('editor transaction limit', () => {
  it('allows the boundary and rejects whole oversized insertions and replacements', () => {
    const state = EditorState.create({
      doc: 'x'.repeat(MAX_CODE_LENGTH),
      extensions: [codeLengthLimit],
    });
    const rejected = state.update({ changes: { from: 1, insert: 'y' } });
    expect(rejected.newDoc.toString()).toBe(state.doc.toString());
    expect(rejected.effects.some((effect) => effect.is(limitRejected))).toBe(true);
    expect(
      state.update({
        changes: { from: 0, to: MAX_CODE_LENGTH, insert: 'y'.repeat(MAX_CODE_LENGTH + 1) },
      }).newDoc.length,
    ).toBe(MAX_CODE_LENGTH);
    expect(state.update({ changes: { from: 0, to: 1 } }).newDoc.length).toBe(MAX_CODE_LENGTH - 1);
  });

  it('preserves undo and redo for accepted edits', () => {
    let state = EditorState.create({ extensions: [codeLengthLimit, history()] });
    state = state.update({ changes: { from: 0, insert: 'print(1)\n' } }).state;
    const target = {
      get state() {
        return state;
      },
      dispatch: (transaction: Transaction) => {
        state = transaction.state;
      },
    };
    expect(undo(target)).toBe(true);
    expect(state.doc.length).toBe(0);
    expect(redo(target)).toBe(true);
    expect(state.doc.toString()).toBe('print(1)\n');
  });
});
