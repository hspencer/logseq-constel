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
    background: var(--bg);
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

  /* Search bar — left padding reserves space for LogSeq's native toolbar icons */
  #constel-search-bar {
    display: flex;
    padding: 8px 12px 8px 90px;
    gap: 6px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface);
    align-items: center;
    position: relative;
    z-index: 10;
  }

  #constel-search-wrap {
    flex: 1;
    position: relative;
    display: flex;
    min-width: 0;
  }

  #constel-search-input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text);
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }

  #constel-search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  #constel-search-input::placeholder {
    color: var(--text-placeholder);
  }

  #constel-search-results {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 280px;
    overflow-y: auto;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-top: none;
    border-radius: 0 0 6px 6px;
    box-shadow: 0 4px 12px var(--shadow);
    z-index: 100;
  }

  .constel-search-item {
    padding: 6px 10px;
    font-size: 13px;
    cursor: pointer;
    color: var(--text);
  }

  .constel-search-item:hover,
  .constel-search-item.selected {
    background: var(--accent-soft);
    color: var(--accent);
  }

  #constel-search-bar button {
    background: none;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    color: var(--close-color);
    font-size: 20px;
  }

  #constel-search-bar button:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  /* Property switches */
  #constel-props {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface-alt);
    position: relative;
    z-index: 5;
  }

  #constel-props:empty {
    display: none;
  }

  .constel-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid var(--input-border);
    padding: 3px 8px;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s;
    background: var(--input-bg);
  }

  .constel-switch:hover {
    border-color: var(--accent);
  }

  .constel-switch.active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .constel-switch-key {
    color: var(--text-muted);
  }

  .constel-switch-val {
    color: var(--text);
    font-weight: 500;
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
`;
