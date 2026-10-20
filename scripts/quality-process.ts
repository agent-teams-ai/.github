import {
  createProcessExecutor,
  isProcessRuntimeError,
  type ProcessCapturedOutput,
  type ProcessRunResult,
  type Request,
} from "node-or-bun";
import { createNodeProcessAdapter } from "node-or-bun/node";

export const QUALITY_COMMAND_TIMEOUT_MS = 120_000;
const executor = createProcessExecutor(createNodeProcessAdapter());

export class QualityCommandExitError extends Error {
  readonly exitCode: number | null;
  readonly signal: string | null;
  declare readonly output: ProcessCapturedOutput;

  constructor(result: ProcessRunResult) {
    super(result.signal === null
      ? `Quality command exited with code ${result.exitCode}`
      : `Quality command terminated by ${result.signal}`);
    this.name = "QualityCommandExitError";
    this.exitCode = result.exitCode;
    this.signal = result.signal;
    Object.defineProperty(this, "output", {
      value: Object.freeze({ stdout: result.stdout, stderr: result.stderr }),
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

export async function runQualityCommand(request: Omit<Request, "strictUtf8">): Promise<ProcessRunResult> {
  const result = await executor.run({
    ...request,
    timeoutMs: request.timeoutMs ?? QUALITY_COMMAND_TIMEOUT_MS,
    strictUtf8: true,
  });
  // The shared executor reports nonzero exits as results; a quality gate must reject them.
  if (result.exitCode !== 0 || result.signal !== null) {throw new QualityCommandExitError(result);}
  return result;
}

export function getQualityCommandOutput(error: unknown): ProcessCapturedOutput | null {
  return error instanceof QualityCommandExitError || isProcessRuntimeError(error) ? error.output : null;
}

// Disposable negative canary: a protected quality input must reject any byte change.
