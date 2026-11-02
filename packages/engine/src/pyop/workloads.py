"""Explicitly registered workloads with bounded, deterministic inputs."""

from collections.abc import Callable
from dataclasses import dataclass
from functools import cache
from types import MappingProxyType
from typing import Any


def duplicates_naive(values: list[int]) -> list[int]:
    """Return each duplicated value once, in first-occurrence order."""
    result = []
    for index, value in enumerate(values):
        if value in values[index + 1 :] and value not in result:
            result.append(value)
    return result


def duplicates_set(values: list[int]) -> list[int]:
    seen: set[int] = set()
    duplicates: set[int] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return list(duplicates)


def fibonacci_naive(n: int) -> int:
    if n < 2:
        return n
    return fibonacci_naive(n - 1) + fibonacci_naive(n - 2)


def fibonacci_memoized(n: int) -> int:
    """Use a fresh per-invocation cache, including for warmups and profiling."""

    @cache
    def calculate(value: int) -> int:
        if value < 2:
            return value
        return calculate(value - 1) + calculate(value - 2)

    return calculate(n)


def duplicate_input(size: int) -> list[int]:
    return [index // 2 for index in range(size)]


def duplicate_expected(size: int) -> set[int]:
    return set(range(size // 2))


def fibonacci_expected(n: int) -> int:
    previous, current = 0, 1
    for _ in range(n):
        previous, current = current, previous + current
    return previous


@dataclass(frozen=True)
class Workload:
    benchmark_id: str
    default_size: int
    max_size: int
    prepare: Callable[[int], Any]
    expected: Callable[[int], Any]
    normalize: Callable[[Any], Any]
    variants: tuple[tuple[str, Callable[..., Any]], ...]


REGISTRY = MappingProxyType(
    {
        "duplicates": Workload(
            "duplicates",
            1000,
            5000,
            duplicate_input,
            duplicate_expected,
            set,
            (("naive", duplicates_naive), ("set_based", duplicates_set)),
        ),
        "fibonacci": Workload(
            "fibonacci",
            20,
            28,
            int,
            fibonacci_expected,
            int,
            (("naive", fibonacci_naive), ("memoized", fibonacci_memoized)),
        ),
    }
)
