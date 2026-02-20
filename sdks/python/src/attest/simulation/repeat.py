from __future__ import annotations

import functools
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from attest.result import AgentResult


@dataclass
class RepeatResult:
    results: list[AgentResult] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.results)

    @property
    def pass_rate(self) -> float:
        if not self.results:
            return 0.0
        passed = sum(1 for r in self.results if r.passed)
        return passed / len(self.results)

    @property
    def all_passed(self) -> bool:
        return all(r.passed for r in self.results)


def repeat(n: int) -> Callable[[Callable[..., AgentResult]], Callable[..., RepeatResult]]:
    def decorator(fn: Callable[..., AgentResult]) -> Callable[..., RepeatResult]:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> RepeatResult:
            results: list[AgentResult] = []
            for _ in range(n):
                result = fn(*args, **kwargs)
                results.append(result)
            return RepeatResult(results=results)

        return wrapper

    return decorator
