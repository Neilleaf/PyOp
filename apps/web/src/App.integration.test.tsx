import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import run from '../../../api/benchmarks/run';
import { App } from './App';

afterEach(() => vi.unstubAllGlobals());

describe('frontend through HTTP adapter to the real API handler', () => {
  function connect() {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation((url, init) => run.fetch(new Request(`http://localhost${url}`, init)));
    vi.stubGlobal('fetch', transport);
    return transport;
  }
  it('labels actual API recordings as demos and never submits editor text', async () => {
    const user = userEvent.setup();
    const transport = connect();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Python code' }))!;
    act(() =>
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: 'raise Exception("never execute me")',
        },
      }),
    );
    expect(transport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Run Analysis/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(await screen.findByText('Demo Results')).toBeInTheDocument();
    expect(screen.getByText('33.08×')).toBeInTheDocument();
    expect(JSON.parse(transport.mock.calls[0][1]?.body as string)).toEqual({
      benchmarkId: 'duplicates',
      inputSize: 1000,
      repetitions: 7,
    });
    expect(view.state.doc.toString()).toContain('never execute me');
    expect(screen.getByLabelText('Code character count')).toHaveTextContent('/ 7,000');
  });
  it('renders unavailable recordings through the API as an empty state', async () => {
    const user = userEvent.setup();
    connect();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'fibonacci');
    await user.clear(screen.getByLabelText('Demo repetitions'));
    await user.type(screen.getByLabelText('Demo repetitions'), '3');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(
      await screen.findByRole('heading', { name: 'No demo for this configuration.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Demo Results')).not.toBeInTheDocument();
  });
  it('displays API failures with a retry action', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            demo: true,
            error: { code: 'INTERNAL_ERROR', message: 'The recorded service is unavailable.' },
          },
          { status: 500 },
        ),
      ),
    );
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Example program (optional)'), 'duplicates');
    await user.click(screen.getByRole('button', { name: /View Demo Results/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The recorded service is unavailable.',
    );
    expect(screen.getByRole('button', { name: /View Demo Results/ })).toBeEnabled();
  });
});
