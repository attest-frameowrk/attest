from __future__ import annotations

import functools
from collections.abc import Callable
from contextvars import Token
from typing import Any

from attest.simulation._context import _active_mock_registry


class MockToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Callable[..., Any]] = {}
        self._token: Token[dict[str, Callable[..., Any]] | None] | None = None

    def register(self, name: str, fn: Callable[..., Any]) -> None:
        self._tools[name] = fn

    def __enter__(self) -> MockToolRegistry:
        self._token = _active_mock_registry.set(dict(self._tools))
        return self

    def __exit__(self, *args: Any) -> None:
        if self._token is not None:
            _active_mock_registry.reset(self._token)


def mock_tool(name: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn._mock_tool_name = name  # type: ignore[attr-defined]

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            return fn(*args, **kwargs)

        wrapper._mock_tool_name = name  # type: ignore[attr-defined]
        return wrapper

    return decorator
