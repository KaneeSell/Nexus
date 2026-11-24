import { EventEmitter } from 'node:events';
import type { ReactNode } from 'react';
import { render, type Instance } from 'ink';

const ANSI_REGEX = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const realSetTimeout = globalThis.setTimeout;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

export class MockStdout extends EventEmitter {
  columns: number | undefined;
  rows = 40;
  frames: string[] = [];
  isTTY = true;

  constructor(columns: number | undefined) {
    super();
    this.columns = columns;
  }

  write = (chunk: string | Uint8Array): boolean => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
    this.frames.push(text);
    return true;
  };

  lastFrame = (): string => {
    const raw = this.frames[this.frames.length - 1] ?? '';
    return stripAnsi(raw);
  };
}

export class MockStdin extends EventEmitter {
  isTTY: boolean;
  private queue: string[] = [];

  constructor(isTTY = true) {
    super();
    this.isTTY = isTTY;
  }

  setRawMode = (_enabled: boolean): this => this;
  ref = (): this => this;
  unref = (): this => this;
  setEncoding = (_encoding: BufferEncoding): this => this;

  read = (): string | null => {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift() ?? null;
  };

  press = (sequence: string): void => {
    this.queue.push(sequence);
    this.emit('readable');
  };
}

export interface RenderInkOptions {
  columns?: number;
  hasColumns?: boolean;
  isTTY?: boolean;
}

export interface RenderInkResult {
  instance: Instance;
  stdout: MockStdout;
  stdin: MockStdin;
  lastFrame: () => string;
  press: (sequence: string) => Promise<void>;
  unmount: () => void;
}

export async function flushInk(delayMs = 4): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => realSetTimeout(resolve, delayMs));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

export async function renderInk(
  node: ReactNode,
  options: RenderInkOptions = {}
): Promise<RenderInkResult> {
  const columns = options.hasColumns === false ? undefined : (options.columns ?? 120);
  const stdout = new MockStdout(columns);
  const stderr = new MockStdout(columns);
  const stdin = new MockStdin(options.isTTY ?? true);

  const instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false
  });

  await flushInk();

  return {
    instance,
    stdout,
    stdin,
    lastFrame: stdout.lastFrame,
    press: async (sequence: string) => {
      stdin.press(sequence);
      await flushInk();
    },
    unmount: () => {
      instance.unmount();
      instance.cleanup();
    }
  };
}
