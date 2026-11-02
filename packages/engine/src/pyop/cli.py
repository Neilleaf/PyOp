"""JSON CLI for explicitly registered benchmarks."""

import argparse
import json

from pyop.runner import BenchmarkResult, run_benchmark
from pyop.workloads import REGISTRY


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="PyOp curated benchmark engine")
    parser.add_argument("benchmark", help=f"Registered ID: {', '.join(REGISTRY)}")
    parser.add_argument("--size", type=int, default=None)
    parser.add_argument("--repetitions", type=int, default=7)
    parser.add_argument("--warmups", type=int, default=1)
    args = parser.parse_args(argv)
    try:
        result = run_benchmark(args.benchmark, args.size, args.repetitions, args.warmups)
    except ValueError as error:
        result = BenchmarkResult(args.benchmark, args.size, args.repetitions, args.warmups)
        result.errors.append(
            {
                "phase": "configuration",
                "variant": "",
                "type": "ValueError",
                "message": str(error),
            }
        )
    print(json.dumps(result.to_dict(), indent=2, allow_nan=False))
    return 0 if result.status == "ok" else 1
