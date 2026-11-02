"""Correctness-gated timing and independent diagnostic profiling."""

import cProfile
import platform
import pstats
import statistics
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Any

from pyop.workloads import REGISTRY


@dataclass
class BenchmarkResult:
    benchmark_id: str
    input_size: int | None
    repetitions: int
    warmups: int
    python_version: str = field(default_factory=platform.python_version)
    schema_version: str = "1.0"
    status: str = "error"
    variants: list[dict[str, Any]] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def timing_statistics(samples: list[int]) -> dict[str, Any]:
    """Report population variability of observed samples, not a confidence interval."""
    median = statistics.median(samples)
    return {
        "unit": "ns",
        "samples_ns": samples,
        "median_ns": median,
        "min_ns": min(samples),
        "max_ns": max(samples),
        "mean_ns": statistics.mean(samples),
        "stdev_ns": statistics.pstdev(samples),
        "mad_ns": statistics.median([abs(sample - median) for sample in samples]),
    }


def profile_call(function: Callable[..., Any], argument: Any) -> list[dict[str, Any]]:
    profiler = cProfile.Profile()
    profiler.runcall(function, argument)
    stats = pstats.Stats(profiler)
    rows = []
    for (filename, line, name), (primitive, total, self_time, cumulative, _) in stats.stats.items():
        rows.append(
            {
                "filename": filename.replace("\\", "/").rsplit("/", 1)[-1],
                "line": line,
                "function": name,
                "primitive_calls": primitive,
                "total_calls": total,
                "self_time_seconds": self_time,
                "cumulative_time_seconds": cumulative,
            }
        )
    return sorted(rows, key=lambda row: (-row["cumulative_time_seconds"], row["function"]))


def _bounded_integer(name: str, value: int, minimum: int, maximum: int) -> None:
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError(f"{name} must be an integer between {minimum} and {maximum}")


def run_benchmark(
    benchmark_id: str, input_size: int | None = None, repetitions: int = 7, warmups: int = 1
) -> BenchmarkResult:
    """Run only a registered workload; invalid configuration raises ValueError.

    Workload failures return structured errors and discard partial measurements.
    Input preparation and correctness checks are outside measured regions.
    """
    if not isinstance(benchmark_id, str) or benchmark_id not in REGISTRY:
        raise ValueError(f"Unknown benchmark ID; choose from {', '.join(REGISTRY)}")
    workload = REGISTRY[benchmark_id]
    size = workload.default_size if input_size is None else input_size
    _bounded_integer("input_size", size, 0, workload.max_size)
    _bounded_integer("repetitions", repetitions, 1, 30)
    _bounded_integer("warmups", warmups, 0, 5)
    result = BenchmarkResult(benchmark_id, size, repetitions, warmups)
    phase, variant = "validation", ""
    try:
        expected = workload.expected(size)
        # Validate every variant before collecting any comparative measurements.
        for name, function in workload.variants:
            variant = name
            output = function(workload.prepare(size))
            if workload.normalize(output) != expected:
                raise ValueError("Output did not match the independent reference")

        phase = "warmup"
        for name, function in workload.variants:
            variant = name
            for _ in range(warmups):
                function(workload.prepare(size))

        phase = "timing"
        samples: dict[str, list[int]] = {name: [] for name, _ in workload.variants}
        # Alternate order to reduce systematic first/second variant bias.
        for repetition in range(repetitions):
            variants = workload.variants if repetition % 2 == 0 else workload.variants[::-1]
            for variant, function in variants:
                argument = workload.prepare(size)
                start = time.perf_counter_ns()
                function(argument)
                samples[variant].append(time.perf_counter_ns() - start)

        phase = "profiling"
        for variant, function in workload.variants:
            result.variants.append(
                {
                    "name": variant,
                    "correctness_verified": True,
                    "timing": timing_statistics(samples[variant]),
                    "profile": profile_call(function, workload.prepare(size)),
                }
            )
        result.status = "ok"
    except Exception as error:
        result.variants.clear()
        result.errors.append(
            {
                "phase": phase,
                "variant": variant,
                "type": type(error).__name__,
                "message": str(error),
            }
        )
    return result
