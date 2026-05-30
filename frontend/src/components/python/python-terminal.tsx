"use client";

import * as React from "react";
import "@xterm/xterm/css/xterm.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = BASE_URL.replace(/^http/, "ws") + "/api/py/terminal";

export interface PythonTerminalHandle {
  /** Write the current editor buffer to main.py and run it in the live shell. */
  runCode: (code: string) => void;
  focus: () => void;
}

// A live interactive shell (xterm.js) wired to the backend PTY over a WebSocket.
// Keystrokes go up, raw terminal bytes come down. The session persists while mounted;
// if the shell exits or the socket drops, we reconnect to hand back a fresh prompt.
export const PythonTerminal = React.forwardRef<PythonTerminalHandle, { className?: string }>(
  function PythonTerminal({ className }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const termRef = React.useRef<import("@xterm/xterm").Terminal | null>(null);
    const fitRef = React.useRef<import("@xterm/addon-fit").FitAddon | null>(null);
    const wsRef = React.useRef<WebSocket | null>(null);

    const sendResize = React.useCallback(() => {
      const term = termRef.current;
      const fit = fitRef.current;
      const el = containerRef.current;
      const ws = wsRef.current;
      if (!term || !fit || !el || el.clientWidth === 0 || el.clientHeight === 0) return;
      fit.fit();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    }, []);

    React.useImperativeHandle(ref, () => ({
      runCode: (code: string) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "run", code }));
        }
        termRef.current?.focus();
      },
      focus: () => termRef.current?.focus(),
    }));

    React.useEffect(() => {
      let disposed = false;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let resizeObserver: ResizeObserver | null = null;

      (async () => {
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        if (disposed || !containerRef.current) return;

        const term = new Terminal({
          cursorBlink: true,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 13,
          theme: {
            background: "#0a0a0a",
            foreground: "#e4e4e7",
            cursor: "#e4e4e7",
            selectionBackground: "#3f3f46",
          },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(containerRef.current);
        termRef.current = term;
        fitRef.current = fit;
        sendResize();

        term.onData((data) => {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "input", data }));
          }
        });

        const connect = () => {
          if (disposed) return;
          const ws = new WebSocket(WS_URL);
          ws.binaryType = "arraybuffer";
          wsRef.current = ws;
          ws.onopen = () => sendResize();
          ws.onmessage = (ev) => {
            if (typeof ev.data === "string") {
              try {
                const msg = JSON.parse(ev.data);
                if (msg.type === "exit") {
                  term.write(`\r\n\x1b[90m[process exited ${msg.code}]\x1b[0m\r\n`);
                }
              } catch {
                /* ignore non-JSON text frames */
              }
              return;
            }
            term.write(new Uint8Array(ev.data as ArrayBuffer));
          };
          ws.onclose = () => {
            wsRef.current = null;
            if (disposed) return;
            reconnectTimer = setTimeout(connect, 800);
          };
          ws.onerror = () => ws.close();
        };
        connect();

        resizeObserver = new ResizeObserver(() => sendResize());
        resizeObserver.observe(containerRef.current);
      })();

      return () => {
        disposed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        resizeObserver?.disconnect();
        wsRef.current?.close();
        wsRef.current = null;
        termRef.current?.dispose();
        termRef.current = null;
      };
    }, [sendResize]);

    return <div ref={containerRef} className={className} />;
  },
);
