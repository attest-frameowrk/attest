from __future__ import annotations

import functools
import random
import time
from collections.abc import Callable
from typing import Any


def fault_inject(
    error_rate: float = 0.0,
    latency_jitter_ms: int = 0,
    seed: int | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        rng = random.Random(seed)

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if error_rate > 0 and rng.random() < error_rate:
                raise RuntimeError(f"Injected fault in {fn.__name__}")
            if latency_jitter_ms > 0:
                jitter = rng.uniform(0, latency_jitter_ms / 1000.0)
                time.sleep(jitter)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
