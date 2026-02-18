# attest-ai

Test framework for AI agents. Deterministic assertions (schema validation, cost constraints, trace ordering, content matching) over agent execution traces.

## Install

```bash
pip install attest-ai
```

With LLM provider support:

```bash
pip install attest-ai[openai]      # OpenAI
pip install attest-ai[anthropic]   # Anthropic
pip install attest-ai[gemini]      # Google Gemini
pip install attest-ai[ollama]      # Ollama (local)
pip install attest-ai[all]         # All providers
```

## Quick start

```python
import attest
from attest import expect

result = attest.AgentResult(
    trace=trace,  # captured from your agent
    assertion_results=[],
)

# Layer 1: Schema validation
expect(result).output_matches_schema({"type": "object", "required": ["refund_id"]})

# Layer 2: Cost & performance constraints
expect(result).cost_under(0.05)
expect(result).latency_under(5000)

# Layer 3: Trace structure
expect(result).tools_called_in_order(["lookup_order", "process_refund"])
expect(result).no_tool_loops(max_iterations=3)

# Layer 4: Content assertions
expect(result).output_contains("refund")
expect(result).output_not_contains("sorry")
```

## Pytest integration

Attest registers as a pytest plugin automatically:

```bash
pytest tests/ --attest-engine=/path/to/attest-engine
```

## Links

- [Repository](https://github.com/attest-frameowrk/attest)
- [Contributing](https://github.com/attest-frameowrk/attest/blob/main/CONTRIBUTING.md)
- [License](https://github.com/attest-frameowrk/attest/blob/main/LICENSE) (Apache-2.0)
