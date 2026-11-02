import json
from dataclasses import replace
from pathlib import Path
from types import MappingProxyType

import pytest
from jsonschema import Draft202012Validator, ValidationError
from pyop import runner
from pyop.cli import main
from pyop.workloads import REGISTRY

SCHEMA = json.loads(
    (Path(__file__).resolve().parents[3] / "schemas/benchmark-result.schema.json").read_text()
)
VALIDATOR = Draft202012Validator(SCHEMA)


@pytest.mark.parametrize(
    "benchmark_id, size",
    [("duplicates", 0), ("duplicates", 31), ("fibonacci", 0), ("fibonacci", 10)],
)
def test_result_schema_and_measurements(benchmark_id, size):
    result = runner.run_benchmark(benchmark_id, size, repetitions=3).to_dict()
    VALIDATOR.validate(result)
    assert result["status"] == "ok"
    assert result["errors"] == []
    for variant in result["variants"]:
        timing = variant["timing"]
        assert len(timing["samples_ns"]) == 3
        assert timing["min_ns"] <= timing["median_ns"] <= timing["max_ns"]
        assert any(row["total_calls"] > 0 for row in variant["profile"])
    assert json.loads(json.dumps(result, allow_nan=False)) == result


@pytest.mark.parametrize(
    "kwargs",
    [
        {"benchmark_id": "unknown"},
        {"benchmark_id": []},
        {"input_size": -1},
        {"input_size": True},
        {"input_size": 1.5},
        {"input_size": "10"},
        {"input_size": 5001},
        {"repetitions": 0},
        {"repetitions": 31},
        {"repetitions": True},
        {"warmups": -1},
        {"warmups": 6},
        {"warmups": False},
    ],
)
def test_invalid_configuration(kwargs):
    arguments = {"benchmark_id": "duplicates", **kwargs}
    with pytest.raises(ValueError):
        runner.run_benchmark(**arguments)


def test_fibonacci_limit():
    with pytest.raises(ValueError):
        runner.run_benchmark("fibonacci", 29)


def test_known_statistics():
    stats = runner.timing_statistics([10, 20, 30])
    assert stats["median_ns"] == stats["mean_ns"] == 20
    assert stats["mad_ns"] == 10
    assert stats["stdev_ns"] == pytest.approx((200 / 3) ** 0.5)
    assert runner.timing_statistics([42])["stdev_ns"] == 0


def test_timing_and_profiling_are_separate(monkeypatch):
    calls = []

    def function(value):
        calls.append(value)
        return value

    workload = replace(
        REGISTRY["fibonacci"],
        prepare=int,
        expected=int,
        variants=(("first", function), ("second", function)),
    )
    monkeypatch.setattr(runner, "REGISTRY", {"fibonacci": workload})
    ticks = iter([100, 110, 200, 230, 300, 320, 400, 440])
    monkeypatch.setattr(runner.time, "perf_counter_ns", lambda: next(ticks))
    profile_calls = []

    def profile(function, argument):
        profile_calls.append(len(calls))
        function(argument)
        return []

    monkeypatch.setattr(runner, "profile_call", profile)
    result = runner.run_benchmark("fibonacci", 3, repetitions=2, warmups=1)
    assert result.status == "ok"
    assert len(calls) == 10  # 2 validation + 2 warmup + 4 timing + 2 profile
    assert profile_calls == [8, 9]
    assert result.variants[0]["timing"]["samples_ns"] == [10, 40]
    assert result.variants[1]["timing"]["samples_ns"] == [30, 20]


@pytest.mark.parametrize("failure", ["wrong", "exception"])
def test_correctness_failure_prevents_measurement(monkeypatch, failure):
    def broken(_):
        if failure == "exception":
            raise RuntimeError("workload failed")
        return -1

    workload = replace(REGISTRY["fibonacci"], variants=(("broken", broken),))
    monkeypatch.setattr(runner, "REGISTRY", {"fibonacci": workload})

    def forbidden_clock():
        pytest.fail("Timing must not start before correctness passes")

    monkeypatch.setattr(runner.time, "perf_counter_ns", forbidden_clock)
    result = runner.run_benchmark("fibonacci", 3).to_dict()
    VALIDATOR.validate(result)
    assert result["status"] == "error"
    assert result["variants"] == []
    assert result["errors"][0]["phase"] == "validation"


def test_profile_failure_discards_partial_results(monkeypatch):
    def broken(*_):
        raise RuntimeError("profile failed")

    monkeypatch.setattr(runner, "profile_call", broken)
    result = runner.run_benchmark("fibonacci", 3, repetitions=1).to_dict()
    VALIDATOR.validate(result)
    assert result["errors"][0]["phase"] == "profiling"
    assert result["variants"] == []


@pytest.mark.parametrize("phase, failure_call", [("warmup", 3), ("timing", 5)])
def test_execution_failure_reports_phase(monkeypatch, phase, failure_call):
    calls = 0

    def sometimes_broken(value):
        nonlocal calls
        calls += 1
        if calls == failure_call:
            raise RuntimeError("execution failed")
        return value

    workload = replace(
        REGISTRY["fibonacci"],
        prepare=int,
        expected=int,
        variants=(("first", sometimes_broken), ("second", sometimes_broken)),
    )
    monkeypatch.setattr(runner, "REGISTRY", {"fibonacci": workload})
    result = runner.run_benchmark("fibonacci", 3, repetitions=1).to_dict()
    VALIDATOR.validate(result)
    assert result["errors"][0]["phase"] == phase
    assert result["errors"][0]["variant"] == "first"
    assert result["variants"] == []


def test_memoization_cache_is_fresh():
    profiles = [
        runner.run_benchmark("fibonacci", 10, repetitions=1).variants[1]["profile"]
        for _ in range(2)
    ]
    for profile in profiles:
        row = next(row for row in profile if row["function"] == "calculate")
        assert row["total_calls"] == 11


@pytest.mark.parametrize(
    "arguments, exit_code",
    [
        (["fibonacci", "--size", "5", "--repetitions", "1"], 0),
        (["unknown"], 1),
        (["fibonacci", "--size", "-1"], 1),
        (["duplicates", "--repetitions", "0"], 1),
    ],
)
def test_cli_json(arguments, exit_code, capsys):
    assert main(arguments) == exit_code
    VALIDATOR.validate(json.loads(capsys.readouterr().out))


def test_cli_syntax_error(capsys):
    with pytest.raises(SystemExit) as error:
        main(["fibonacci", "--size", "not-an-integer"])
    assert error.value.code == 2
    assert "invalid int value" in capsys.readouterr().err


def test_schema_rejects_missing_and_malformed_metrics():
    Draft202012Validator.check_schema(SCHEMA)
    result = runner.run_benchmark("fibonacci", 3, repetitions=1).to_dict()
    del result["variants"][0]["timing"]["median_ns"]
    with pytest.raises(ValidationError):
        VALIDATOR.validate(result)


def test_registry_is_read_only():
    assert isinstance(REGISTRY, MappingProxyType)
    with pytest.raises(TypeError):
        REGISTRY["custom"] = REGISTRY["fibonacci"]
