"""OpenAI trace capture adapter."""

from __future__ import annotations

from typing import Any

from attest.adapters._base import BaseProviderAdapter


class OpenAIAdapter(BaseProviderAdapter):
    """Captures OpenAI ChatCompletion calls into Attest traces."""

    def _extract_completion(self, response: Any) -> str:
        return response.choices[0].message.content or ""

    def _extract_model(self, response: Any, **metadata: Any) -> str | None:
        return getattr(response, "model", None)

    def _extract_total_tokens(self, response: Any) -> int | None:
        if hasattr(response, "usage") and response.usage:
            return response.usage.total_tokens  # type: ignore[no-any-return]
        return None

    def _extract_tool_calls(self, response: Any) -> list[dict[str, Any]]:
        message = response.choices[0].message
        if not hasattr(message, "tool_calls") or not message.tool_calls:
            return []
        return [
            {"name": tc.function.name, "args": {"arguments": tc.function.arguments}}
            for tc in message.tool_calls
        ]

    def _build_output(
        self,
        response: Any,
        completion_text: str,
        **metadata: Any,
    ) -> dict[str, Any]:
        return {
            "message": completion_text,
            "structured": metadata.get("structured_output", {}),
        }
