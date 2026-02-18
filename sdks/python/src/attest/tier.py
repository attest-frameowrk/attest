"""Tier constants and decorator for Attest test prioritization."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar

TIER_1: int = 1
TIER_2: int = 2
TIER_3: int = 3

_F = TypeVar("_F", bound=Callable[..., Any])


def tier(level: int) -> Callable[[_F], _F]:
    """Decorator that tags a test function with an Attest tier level.

    Usage:
        @tier(TIER_1)
        def test_critical_path(result):
            expect(result).output_contains("success")
    """

    def decorator(fn: _F) -> _F:
        fn._attest_tier = level  # type: ignore[attr-defined]
        return fn

    return decorator
