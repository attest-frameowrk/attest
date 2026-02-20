# Framework Adapters Guide

Framework adapters bridge Attest with agent orchestration frameworks, enabling trace capture without manual `TraceBuilder` instrumentation.

## Provider Adapters vs Framework Adapters

Attest uses a two-tier adapter architecture:

**Provider adapters** capture single LLM call boundaries. They wrap one request/response cycle for a model provider — OpenAI, Anthropic, Gemini, or Ollama. Use them when you call a model directly and want a `Trace` for that single call.

**Framework adapters** capture agent orchestration. They consume the event stream or callback lifecycle produced by an orchestration framework — LangChain, Google ADK, LlamaIndex — and build a `Trace` that includes all LLM calls, tool calls, and sub-agent delegations that occurred during a complete agent run.

```
ProviderAdapter    — one LLM call → one Trace
FrameworkAdapter   — one agent run (N LLM calls, M tool calls) → one Trace
```

Both implement formal Protocols defined in `attest.adapters`:

```python
from attest.adapters import ProviderAdapter, FrameworkAdapter
```

## LangChain Adapter

The `LangChainAdapter` wraps LangChain's callback system. It attaches a `LangChainCallbackHandler` to your agent invocation and builds a `Trace` on exit.

### Installation

```bash
uv add 'attest-ai[langchain]'
```

### Basic Usage

```python
from attest.adapters.langchain import LangChainAdapter
from attest.result import AgentResult
from attest import expect

adapter = LangChainAdapter(agent_id="research-agent")

with adapter.capture() as handler:
    result = agent.invoke(
        {"input": "Summarize recent AI research"},
        config={"callbacks": [handler]},
    )

trace = adapter.trace
agent_result = AgentResult(trace=trace)

expect(agent_result).output_contains("summary")
expect(agent_result).tool_called("search_web")
```

### What Gets Captured

The handler intercepts these LangChain callbacks:

| Callback | Captured as |
|---|---|
| `on_chain_start` | Agent input |
| `on_chain_end` | Agent output |
| `on_chat_model_start` / `on_llm_end` | `llm_call` step with token counts |
| `on_tool_start` / `on_tool_end` | `tool_call` step with args and result |
| `on_tool_error` | `tool_call` step with error field |

### Direct Handler Usage

Use `LangChainCallbackHandler` directly when you need the handler reference before entering a context manager:

```python
from attest.adapters.langchain import LangChainCallbackHandler

handler = LangChainCallbackHandler(agent_id="my-agent")
result = agent.invoke(input_data, config={"callbacks": [handler]})
trace = handler.build_trace()
```

`build_trace()` raises `RuntimeError` if called more than once on the same handler instance.

## Google ADK Adapter

The `GoogleADKAdapter` consumes the async event stream from an ADK `Runner` and maps ADK event types to Attest step types.

### Installation

```bash
uv add 'attest-ai[google-adk]'
```

### Async Capture

```python
import asyncio
from google.adk.runners import Runner
from attest.adapters.google_adk import GoogleADKAdapter
from attest.result import AgentResult
from attest import expect

async def run_and_test():
    runner = Runner(
        agent=root_agent,
        app_name="my-app",
        session_service=session_service,
    )

    adapter = GoogleADKAdapter(agent_id="root-agent")
    trace = await adapter.capture_async(
        runner=runner,
        user_id="user-123",
        session_id="session-abc",
        message="What is the weather in Paris?",
    )

    result = AgentResult(trace=trace)
    expect(result).tool_called("get_weather")
    expect(result).output_contains("Paris")

asyncio.run(run_and_test())
```

### From Pre-collected Events

When you already hold ADK events (for example, from a test fixture or replay), use the class method directly:

```python
from attest.adapters.google_adk import GoogleADKAdapter

trace = GoogleADKAdapter.from_events(
    events=collected_events,
    agent_id="root-agent",
    input_message="What is the weather in Paris?",
)
```

### Event Mapping

| ADK Event field | Captured as |
|---|---|
| `actions.tool_calls` | `tool_call` steps (args) |
| `actions.tool_results` | `tool_call` steps (result) |
| `actions.transfer_to_agent` | `agent_call` step |
| `usage_metadata.total_token_count` | accumulated token count |
| `is_final_response()` + `content.parts[].text` | agent output |
| `llm_response.model_version` | model metadata (first non-None) |

## Combining Provider and Framework Adapters

A framework adapter already captures LLM calls internally. If you need a `Trace` for both the raw provider call and the orchestrated run, use them independently and assert on each:

```python
from attest.adapters.openai import OpenAIAdapter
from attest.adapters.langchain import LangChainAdapter
from attest.result import AgentResult
from attest import expect
from openai import OpenAI

# Provider-level: assert on a raw OpenAI call
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": "Hello"}],
)
provider_adapter = OpenAIAdapter(agent_id="raw-call")
raw_trace = provider_adapter.trace_from_response(
    response,
    input_messages=[{"role": "user", "content": "Hello"}],
)
expect(AgentResult(trace=raw_trace)).output_contains("Hello")

# Framework-level: assert on the full agent run
lc_adapter = LangChainAdapter(agent_id="orchestrated-run")
with lc_adapter.capture() as handler:
    agent.invoke({"input": "Hello"}, config={"callbacks": [handler]})

framework_trace = lc_adapter.trace
expect(AgentResult(trace=framework_trace)).tool_called("lookup_user")
```

In the common case, one adapter is sufficient. Use both only when you need separate assertions at each level.

## Writing a Custom FrameworkAdapter

Implement the `FrameworkAdapter` Protocol to connect Attest to any orchestration framework:

```python
from __future__ import annotations

from typing import Any

from attest._proto.types import Trace
from attest.adapters import FrameworkAdapter
from attest.trace import TraceBuilder


class MyFrameworkAdapter:
    """Adapter for MyFramework event streams."""

    def __init__(self, agent_id: str | None = None) -> None:
        self._agent_id = agent_id

    def trace_from_events(
        self,
        events: list[Any],
        **metadata: Any,
    ) -> Trace:
        builder = TraceBuilder(agent_id=self._agent_id)

        total_tokens = 0
        output_text = ""

        for event in events:
            event_type = getattr(event, "type", None)

            if event_type == "tool_call":
                builder.add_tool_call(
                    name=event.tool_name,
                    args=event.args,
                    result=event.result,
                )
            elif event_type == "llm_call":
                builder.add_llm_call(
                    name=event.model,
                    result={"completion": event.completion},
                )
                total_tokens += getattr(event, "tokens", 0)
            elif event_type == "final_output":
                output_text = event.text

        builder.set_output(message=output_text)
        builder.set_metadata(
            total_tokens=total_tokens if total_tokens > 0 else None,
            **metadata,
        )

        return builder.build()


# Verify the class satisfies the Protocol (structural check, not inheritance)
def _check() -> None:
    _: FrameworkAdapter = MyFrameworkAdapter()
```

The Protocol is structural — no inheritance required. Any class with a matching `trace_from_events` signature satisfies `FrameworkAdapter`.

For `ProviderAdapter`, implement `trace_from_response(response, input_messages, **metadata) -> Trace` with the same pattern.

## Protocol Reference

```python
from attest.adapters import TraceAdapter, ProviderAdapter, FrameworkAdapter
```

| Protocol | Method | Use case |
|---|---|---|
| `TraceAdapter` | `capture(*args, **kwargs) -> Trace` | Generic capture (backward compat) |
| `ProviderAdapter` | `trace_from_response(response, input_messages, **metadata) -> Trace` | Single LLM call |
| `FrameworkAdapter` | `trace_from_events(events, **metadata) -> Trace` | Agent orchestration run |
