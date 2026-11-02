import { EditorState, StateEffect } from '@codemirror/state';

export const MAX_CODE_LENGTH = 7000;
export const limitRejected = StateEffect.define<boolean>();

/** Reject an entire oversized edit, preserving the previous document and selection. */
export const codeLengthLimit = EditorState.transactionFilter.of((transaction) =>
  transaction.docChanged && transaction.newDoc.length > MAX_CODE_LENGTH
    ? { effects: limitRejected.of(true) }
    : transaction,
);
