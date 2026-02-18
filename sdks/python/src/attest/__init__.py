"""Attest — Test framework for AI agents."""

from __future__ import annotations

from attest._proto.types import (
    Assertion,
    AssertionResult,
    Step,
    Trace,
    TraceMetadata,
)
from attest.adapters.anthropic import AnthropicAdapter
from attest.adapters.gemini import GeminiAdapter
from attest.adapters.manual import ManualAdapter
from attest.adapters.ollama import OllamaAdapter
from attest.adapters.openai import OpenAIAdapter
from attest.adapters.otel import OTelAdapter
from attest.agent import Agent, agent
from attest.expect import ExpectChain, expect
from attest.result import AgentResult
from attest.tier import TIER_1, TIER_2, TIER_3, tier
from attest.trace import TraceBuilder

__version__: str = "0.2.0"

__all__ = [
    # Core types
    "Assertion",
    "AssertionResult",
    "Step",
    "Trace",
    "TraceMetadata",
    # Agent
    "Agent",
    "agent",
    # Results
    "AgentResult",
    # Expect DSL
    "ExpectChain",
    "expect",
    # Trace building
    "TraceBuilder",
    # Tier
    "tier",
    "TIER_1",
    "TIER_2",
    "TIER_3",
    # Adapters
    "ManualAdapter",
    "OpenAIAdapter",
    "AnthropicAdapter",
    "GeminiAdapter",
    "OllamaAdapter",
    "OTelAdapter",
    # Version
    "__version__",
]
