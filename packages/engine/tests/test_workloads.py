import pytest
from pyop.workloads import (
    REGISTRY,
    duplicates_naive,
    duplicates_set,
    fibonacci_memoized,
    fibonacci_naive,
)


@pytest.mark.parametrize(
    "values, expected",
    [
        ([], set()),
        ([1], set()),
        ([1, 2, 3], set()),
        ([3, 1, 3, 1, 3], {1, 3}),
        ([-1, 0, -1, 0], {-1, 0}),
    ],
)
def test_duplicates(values, expected):
    for function in (duplicates_naive, duplicates_set):
        original = values.copy()
        result = function(values)
        assert set(result) == expected
        assert len(result) == len(expected)
        assert values == original


@pytest.mark.parametrize("n, expected", [(0, 0), (1, 1), (2, 1), (10, 55), (20, 6765)])
def test_fibonacci(n, expected):
    assert fibonacci_naive(n) == fibonacci_memoized(n) == expected


@pytest.mark.parametrize("size", range(15))
def test_generated_duplicate_reference(size):
    workload = REGISTRY["duplicates"]
    for _, function in workload.variants:
        assert set(function(workload.prepare(size))) == workload.expected(size)
