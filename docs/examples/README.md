# PyOp measured examples

These files are complete, unedited JSON stdout captured from actual CLI runs on
Windows with Python 3.12.1 during Step 1 validation:

```powershell
python -m pyop duplicates --size 1000 --repetitions 7
python -m pyop fibonacci --size 20 --repetitions 7
```

Both used the default one warmup per variant. Timings are host-dependent and do
not establish universal performance guarantees.

| Result file | Variant | Median (ns) |
| --- | --- | ---: |
| [duplicates.json](duplicates.json) | naive | 2917400 |
| [duplicates.json](duplicates.json) | set_based | 88200 |
| [fibonacci.json](fibonacci.json) | naive | 1058400 |
| [fibonacci.json](fibonacci.json) | memoized | 8500 |

Local verification used the installed development environment:

```text
python -m pytest                 58 passed in 0.24s
python -m ruff check .           All checks passed!
python -m ruff format --check .  11 files already formatted
```

The GitHub Actions matrix is configured for Python 3.11–3.14, but has not been
executed here. Local test results apply to Python 3.12.1 only.
