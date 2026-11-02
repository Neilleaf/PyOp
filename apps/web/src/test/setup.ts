import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no layout engine. CodeMirror measures ranges during cursor updates.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => Object.assign([] as DOMRect[], { item: () => null });
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
