// Step type constants
export const STEP_LLM_CALL = "llm_call" as const;
export const STEP_TOOL_CALL = "tool_call" as const;
export const STEP_RETRIEVAL = "retrieval" as const;
export const STEP_AGENT_CALL = "agent_call" as const;

// Status constants
export const STATUS_PASS = "pass" as const;
export const STATUS_SOFT_FAIL = "soft_fail" as const;
export const STATUS_HARD_FAIL = "hard_fail" as const;

// Assertion type constants
export const TYPE_SCHEMA = "schema" as const;
export const TYPE_CONSTRAINT = "constraint" as const;
export const TYPE_TRACE = "trace" as const;
export const TYPE_CONTENT = "content" as const;
export const TYPE_EMBEDDING = "embedding" as const;
export const TYPE_LLM_JUDGE = "llm_judge" as const;
export const TYPE_TRACE_TREE = "trace_tree" as const;

// Error code constants
export const ERR_INVALID_TRACE = 1001 as const;
export const ERR_ASSERTION_ERROR = 1002 as const;
export const ERR_PROVIDER_ERROR = 2001 as const;
export const ERR_ENGINE_ERROR = 3001 as const;
export const ERR_TIMEOUT = 3002 as const;
export const ERR_SESSION_ERROR = 3003 as const;
