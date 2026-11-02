import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fibonacci from '../../../docs/examples/fibonacci.json';
import { App } from './App';
import { demoBenchmarkService, parseBenchmarkResult } from './data/benchmarkService';
import { samplePrograms } from './data/samplePrograms';
import type { BenchmarkResult } from './types/benchmark';

function editorView() {
  const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Python code' }));
  if (!view) throw new Error('Editor not mounted');
  return view;
}

function replaceCode(code: string) {
  const view = editorView();
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Python input workspace', () => {
  it('starts with an accessible editor, disabled analysis and no workload-size controls', () => {
    render(<App service={demoBenchmarkService} />);
    expect(screen.getByRole('textbox', { name: 'Python code' })).toHaveAttribute(
      'aria-multiline',
      'true',
    );
    expect(screen.getByText(/Paste your Python code here/)).toBeInTheDocument();
    expect(screen.getByLabelText('Code character count')).toHaveTextContent('0 / 7,000');
    expect(screen.getByRole('button', { name: /Run Analysis/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /View Demo Results/ })).toBeDisabled();
    expect(screen.queryByLabelText('Input size')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fibonacci index')).not.toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });

  it('accepts multiline paste, keeps indentation and updates the live count', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    const code = 'def greet():\n    return "hello"\n';
    await user.click(screen.getByRole('textbox', { name: 'Python code' }));
    await user.paste(code);
    expect(editorView().state.doc.toString()).toBe(code);
    expect(screen.getByLabelText('Code character count')).toHaveTextContent(
      `${code.length} / 7,000`,
    );
    await user.keyboard('{End}{Enter}');
    expect(editorView().state.doc.lines).toBeGreaterThan(2);
  });

  it('accepts 7,000 characters and rejects oversized edits without truncation', () => {
    render(<App service={demoBenchmarkService} />);
    replaceCode('x'.repeat(7000));
    expect(screen.getByLabelText('Code character count')).toHaveTextContent('7,000 / 7,000');
    const view = editorView();
    act(() => view.dispatch({ changes: { from: 7000, insert: 'x' } }));
    expect(view.state.doc.length).toBe(7000);
    expect(screen.getByText(/Edit rejected/)).toBeInTheDocument();
    replaceCode('print(1)');
    replaceCode('y'.repeat(7001));
    expect(view.state.doc.toString()).toBe('print(1)');
    expect(screen.getByLabelText('Code character count')).toHaveTextContent('8 / 7,000');
  });

  it('supports indentation and releases Tab after Escape for normal focus navigation', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    await user.click(screen.getByRole('textbox', { name: 'Python code' }));
    await user.keyboard('{Tab}');
    expect(editorView().state.doc.toString()).toBe('    ');
    const input = screen.getByRole('textbox', { name: 'Python code' });
    // CodeMirror's escape hatch reads legacy keyCode, which user-event leaves at 0.
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape', keyCode: 27 });
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(input, tab);
    expect(tab.defaultPrevented).toBe(false);
    expect(editorView().state.doc.toString()).toBe('    ');
  });

  it('rejects an oversized paste and preserves the existing text and count', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    replaceCode('# Keep me');
    await user.click(screen.getByRole('textbox', { name: 'Python code' }));
    await user.paste('x'.repeat(7001));
    expect(editorView().state.doc.toString()).toBe('# Keep me');
    expect(screen.getByLabelText('Code character count')).toHaveTextContent('9 / 7,000');
    expect(screen.getByText(/Edit rejected/)).toBeInTheDocument();
  });

  it('populates optional samples and updates the counter without loading a report', async () => {
    const user = userEvent.setup();
    const load = vi.fn(demoBenchmarkService.load);
    render(<App service={{ load }} />);
    for (const id of ['duplicates', 'fibonacci'] as const) {
      await user.selectOptions(screen.getByLabelText('Example program (optional)'), id);
      expect(editorView().state.doc.toString()).toBe(samplePrograms[id]);
      expect(screen.getByLabelText('Code character count')).toHaveTextContent(
        `${samplePrograms[id].length} / 7,000`,
      );
    }
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByText('Demo Results')).not.toBeInTheDocument();
  });

  it('does not execute, submit or persist editor text, even when viewing a demo', async () => {
    const user = userEvent.setup();
    const load = vi.fn(demoBenchmarkService.load);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const save = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = render(<App service={{ load }} />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    const code = 'raise RuntimeError("This text must never execute")';
    replaceCode(code);
    await user.click(screen.getByRole('button', { name: /Run Analysis/ }));
    expect(load).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(await screen.findByText('Demo Results')).toBeInTheDocument();
    expect(load).toHaveBeenCalledExactlyOnceWith({
      benchmarkId: 'duplicates',
      inputSize: 1000,
      repetitions: 7,
    });
    expect(editorView().state.doc.toString()).toBe(code);
    expect(
      screen.getByText(/Reports are never generated from your editor text/),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    unmount();
    render(<App service={demoBenchmarkService} />);
    expect(editorView().state.doc.length).toBe(0);
  });
});

describe('recorded demo reports', () => {
  it('preserves chart and profile interactions', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(await screen.findByRole('heading', { name: 'Duplicate Detection' })).toBeInTheDocument();
    expect(screen.getByText('Demo Results')).toBeInTheDocument();
    expect(screen.getByText('33.08×')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All samples' }));
    fireEvent.change(screen.getByRole('slider', { name: /Inspect repetition/ }), {
      target: { value: '1' },
    });
    expect(screen.getByLabelText('Inspect repetition 2')).toHaveValue('1');
    await user.click(screen.getByText('View chart data as a table'));
    expect(
      within(screen.getByRole('region', { name: 'Chart data' })).getAllByRole('row'),
    ).toHaveLength(8);
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Implementation to profile/ }),
      '1',
    );
    expect(screen.getByText('duplicates_set')).toBeInTheDocument();
    const sort = screen.getByRole('button', { name: /Self time/ });
    await user.click(sort);
    expect(sort.closest('th')).toHaveAttribute('aria-sort', 'descending');
    await user.click(sort);
    expect(sort.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('switches samples and clears the previous report', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    await screen.findByText('Demo Results');
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'fibonacci');
    expect(screen.queryByText('Demo Results')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(await screen.findByRole('heading', { name: 'Fibonacci' })).toBeInTheDocument();
    expect(screen.getByText('124.52×')).toBeInTheDocument();
  });

  it('shows no matching report for an unrecorded repetition count', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    await user.clear(screen.getByLabelText('Demo repetitions'));
    await user.type(screen.getByLabelText('Demo repetitions'), '3');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(
      await screen.findByRole('heading', { name: 'No demo for this configuration.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Demo Results')).not.toBeInTheDocument();
  });

  it('keeps demo repetition input validation', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    const repetitions = screen.getByLabelText('Demo repetitions');
    await user.clear(repetitions);
    expect(repetitions).toBeInvalid();
    await user.type(repetitions, '31');
    expect(repetitions).toBeInvalid();
  });

  it('shows loading, disables demo controls and leaves the editor available', async () => {
    const user = userEvent.setup();
    let resolve!: (value: BenchmarkResult | null) => void;
    render(
      <App
        service={{
          load: () =>
            new Promise((done) => {
              resolve = done;
            }),
        }}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(screen.getByRole('button', { name: /Loading demo/ })).toBeDisabled();
    expect(screen.getByLabelText('Example program (optional)')).toBeDisabled();
    replaceCode('# Still editable while a recording loads');
    await act(async () => resolve(null));
    expect(
      await screen.findByRole('heading', { name: 'No demo for this configuration.' }),
    ).toBeInTheDocument();
  });

  it('reports load errors and allows retrying', async () => {
    const user = userEvent.setup();
    let calls = 0;
    render(
      <App
        service={{
          load: async () => {
            if (++calls === 1) throw new Error('Could not load the example file.');
            return parseBenchmarkResult(fibonacci);
          },
        }}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'fibonacci');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the example file.');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('Demo Results')).toBeInTheDocument();
  });

  it('supports launching a demo report from the keyboard', async () => {
    const user = userEvent.setup();
    render(<App service={demoBenchmarkService} />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    screen.getByRole('button', { name: /View Demo Results/ }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Demo Results')).toBeInTheDocument();
  });

  it('renders structured engine errors without a comparison', async () => {
    const user = userEvent.setup();
    const failed = parseBenchmarkResult({
      ...fibonacci,
      status: 'error',
      variants: [],
      errors: [
        { phase: 'validation', variant: 'naive', type: 'ValueError', message: 'Output mismatch' },
      ],
    });
    render(<App service={{ load: async () => failed }} />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'fibonacci');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('validation: Output mismatch');
    expect(screen.queryByText('Demo Results')).not.toBeInTheDocument();
  });
});
