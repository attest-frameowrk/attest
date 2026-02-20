"""Tests for TraceTree cross-agent accessors."""

from __future__ import annotations

from attest._proto.types import Step, Trace, TraceMetadata
from attest.trace_tree import TraceTree


def _make_multi_agent_tree() -> TraceTree:
    """Build a 3-agent tree: orchestrator -> researcher -> writer."""
    writer_trace = Trace(
        trace_id="trc_writer",
        agent_id="writer",
        output={"message": "Draft complete."},
        steps=[
            Step(type="tool_call", name="write_doc", args={"title": "Report"}),
        ],
        metadata=TraceMetadata(total_tokens=100, cost_usd=0.001, latency_ms=500),
    )
    researcher_trace = Trace(
        trace_id="trc_researcher",
        agent_id="researcher",
        output={"message": "Research done."},
        steps=[
            Step(type="tool_call", name="search_web", args={"q": "attest"}),
            Step(
                type="agent_call",
                name="delegate_writer",
                sub_trace=writer_trace,
            ),
        ],
        metadata=TraceMetadata(total_tokens=200, cost_usd=0.002, latency_ms=1000),
    )
    root_trace = Trace(
        trace_id="trc_orchestrator",
        agent_id="orchestrator",
        output={"message": "Task complete."},
        steps=[
            Step(type="llm_call", name="plan"),
            Step(type="tool_call", name="fetch_context", args={"key": "abc"}),
            Step(
                type="agent_call",
                name="delegate_researcher",
                sub_trace=researcher_trace,
            ),
        ],
        metadata=TraceMetadata(total_tokens=300, cost_usd=0.003, latency_ms=1500),
    )
    return TraceTree(root=root_trace)


def test_delegations_returns_all_pairs() -> None:
    tree = _make_multi_agent_tree()
    delegations = tree.delegations
    assert delegations == [
        ("orchestrator", "researcher"),
        ("researcher", "writer"),
    ]


def test_delegations_empty_for_single_agent() -> None:
    tree = TraceTree(
        root=Trace(
            trace_id="trc_solo",
            agent_id="solo",
            output={"message": "done"},
            steps=[Step(type="tool_call", name="search")],
        )
    )
    assert tree.delegations == []


def test_all_tool_calls_collects_across_tree() -> None:
    tree = _make_multi_agent_tree()
    tool_calls = tree.all_tool_calls()
    tool_names = [tc.name for tc in tool_calls]
    assert tool_names == ["fetch_context", "search_web", "write_doc"]


def test_all_tool_calls_excludes_non_tool_steps() -> None:
    tree = _make_multi_agent_tree()
    tool_calls = tree.all_tool_calls()
    for tc in tool_calls:
        assert tc.type == "tool_call"


def test_all_tool_calls_empty_when_no_tools() -> None:
    tree = TraceTree(
        root=Trace(
            trace_id="trc_no_tools",
            agent_id="agent",
            output={"message": "done"},
            steps=[Step(type="llm_call", name="think")],
        )
    )
    assert tree.all_tool_calls() == []
