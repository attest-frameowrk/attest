"""Manual trace adapter using TraceBuilder."""

from __future__ import annotations

from collections.abc import Callable

from attest._proto.types import Trace
from attest.adapters._base import BaseAdapter
from attest.trace import TraceBuilder


class ManualAdapter(BaseAdapter):
    """Adapter for manually constructing traces via TraceBuilder."""

    def capture(self, builder_fn: Callable[[TraceBuilder], None]) -> Trace:
        """Execute builder_fn with a TraceBuilder and return the built Trace.

        builder_fn receives a TraceBuilder and should call methods on it
        to construct the trace. It does not need to call build().
        """
        builder = self._create_builder()
        builder_fn(builder)
        return builder.build()

    def create_builder(self) -> TraceBuilder:
        """Create a new TraceBuilder for manual construction."""
        return self._create_builder()
