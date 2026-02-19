import { AsyncLocalStorage } from "node:async_hooks";
import type { TraceBuilder } from "./trace.js";

export const activeBuilder = new AsyncLocalStorage<TraceBuilder>();
