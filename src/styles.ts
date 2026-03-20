export default `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  #app {
    width: 100%;
    height: 100%;
  }

  /* ── Theme variables ── */
  #constel-root {
    --bg: #ffffff;
    --bg-surface: #f8f8f8;
    --bg-surface-alt: #fafafa;
    --bg-hover: #f0f0f0;
    --text: #333333;
    --text-secondary: #555555;
    --text-muted: #888888;
    --text-placeholder: #aaaaaa;
    --border: #e0e0e0;
    --input-border: #dddddd;
    --input-bg: #ffffff;
    --accent: #045591;
    --accent-soft: rgba(4, 85, 145, 0.08);
    --accent-glow: rgba(4, 85, 145, 0.15);
    --shadow: rgba(0, 0, 0, 0.1);
    --knob-shadow: rgba(0, 0, 0, 0.2);
    --node-fill: #999999;
    --node-central: #045591;
    --link-stroke: #cccccc;
    --switch-off: #cccccc;
    --close-color: #999999;

    position: absolute;
    inset: 0;
    display: flex;
    background: transparent;
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--text);
  }

  /* ── Dark mode ── */
  #constel-root.dark {
    --bg: #1e1e1e;
    --bg-surface: #252525;
    --bg-surface-alt: #2a2a2a;
    --bg-hover: #333333;
    --text: #d4d4d4;
    --text-secondary: #bbbbbb;
    --text-muted: #888888;
    --text-placeholder: #666666;
    --border: #3a3a3a;
    --input-border: #444444;
    --input-bg: #2d2d2d;
    --accent: #4a9ade;
    --accent-soft: rgba(74, 154, 222, 0.12);
    --accent-glow: rgba(74, 154, 222, 0.25);
    --shadow: rgba(0, 0, 0, 0.3);
    --knob-shadow: rgba(0, 0, 0, 0.4);
    --node-fill: #777777;
    --node-central: #4a9ade;
    --link-stroke: #555555;
    --switch-off: #555555;
    --close-color: #777777;
  }

  #constel-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0;
    padding-top: 48px; /* Clear Logseq's top toolbar */
  }

  /* Resize handle on the right edge */
  #constel-resize-handle {
    width: 4px;
    background: var(--border);
    cursor: col-resize;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  #constel-resize-handle:hover {
    background: var(--accent);
  }

  /* ── Controls panel ── */
  #constel-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-surface-alt);
    border-bottom: 1px solid var(--border);
    position: relative;
    z-index: 5;
    align-items: center;
  }

  .constel-ctrl-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;
  }

  .constel-ctrl-label {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    user-select: none;
  }

  .constel-ctrl-value {
    color: var(--text);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .constel-ctrl-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 80px;
  }

  .constel-ctrl-field--inline {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    min-width: 100px;
  }

  .constel-ctrl-field--inline .constel-range {
    flex: 1;
  }

  .constel-ctrl-buttons {
    gap: 4px;
    width: auto;
  }

  .constel-btn-close {
    margin-left: auto;
  }

  .constel-ctrl-sep {
    width: 1px;
    height: 16px;
    background: var(--border);
    flex-shrink: 0;
  }

  /* Number stepper (+/- buttons) */
  .constel-stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--input-bg);
  }

  .constel-stepper-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.15s, color 0.15s;
  }

  .constel-stepper-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--accent);
  }

  .constel-stepper-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .constel-stepper-value {
    min-width: 20px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    user-select: none;
  }

  /* Dropdown */
  .constel-select {
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--text);
    cursor: pointer;
    outline: none;
  }

  .constel-select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  /* Range sliders */
  .constel-range {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    background: var(--switch-off);
    outline: none;
    cursor: pointer;
  }

  .constel-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg);
    cursor: pointer;
    box-shadow: 0 1px 3px var(--shadow);
  }

  .constel-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg);
    cursor: pointer;
    box-shadow: 0 1px 3px var(--shadow);
  }

  .constel-range:focus {
    outline: 2px solid var(--accent-glow);
    outline-offset: 2px;
  }

  /* Icon buttons */
  .constel-btn-icon {
    width: 28px;
    height: 28px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.15s, border-color 0.15s;
  }

  .constel-btn-icon:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
    color: var(--accent);
  }

  .constel-btn-icon:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* Toggle switches */
  .constel-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }

  .constel-switch-label {
    color: var(--text-muted);
    font-size: 11px;
  }

  .constel-switch.active .constel-switch-label {
    color: var(--text);
  }

  .constel-switch-toggle {
    width: 28px;
    height: 16px;
    border-radius: 8px;
    background: var(--switch-off);
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .constel-switch.active .constel-switch-toggle {
    background: var(--accent);
  }

  .constel-switch-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: left 0.2s;
    box-shadow: 0 1px 2px var(--knob-shadow);
  }

  .constel-switch.active .constel-switch-knob {
    left: 14px;
  }

  /* Navigation history pills */
  #constel-history {
    display: flex;
    gap: 4px;
    padding: 4px 12px;
    overflow-x: auto;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    position: relative;
    z-index: 5;
  }

  #constel-history:empty {
    display: none;
  }

  .constel-pill {
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    cursor: pointer;
    white-space: nowrap;
    color: var(--text-secondary);
    transition: all 0.15s;
  }

  .constel-pill:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .constel-pill.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  /* Graph area */
  #constel-graph {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  /* Loading indicator (non-blocking) */
  #constel-graph.constel-loading::after {
    content: "";
    position: absolute;
    top: 8px;
    left: 50%;
    width: 20px;
    height: 20px;
    margin-left: -10px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: constel-spin 0.6s linear infinite;
    z-index: 10;
    pointer-events: none;
  }

  @keyframes constel-spin {
    to { transform: rotate(360deg); }
  }

  /* Focus ring for keyboard-navigable SVG nodes */
  #constel-graph svg g g:focus {
    outline: 2px solid var(--accent, #045591);
    outline-offset: 2px;
  }

  /* History scroll indicators */
  #constel-history {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0px, black 24px,
      black calc(100% - 24px), transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0px, black 24px,
      black calc(100% - 24px), transparent 100%
    );
    scrollbar-width: none;
  }

  #constel-history::-webkit-scrollbar {
    display: none;
  }
`;
