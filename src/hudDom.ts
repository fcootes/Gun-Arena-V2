/** React may replace HUD nodes on pause/replay: cache only connected elements. */
export class HudDom {
  private nodes = new Map<string, HTMLElement | null>();
  private observer: MutationObserver;
  constructor(private root: HTMLElement) {
    this.observer = new MutationObserver(records => {
      // Text changes do not affect selector results; mounted HUD elements do.
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE)))
        for (const [selector, node] of this.nodes) if (!node || !node.isConnected) this.nodes.delete(selector);
    });
    this.observer.observe(root, { childList: true, subtree: true });
  }
  get(selector: string): HTMLElement | null {
    const existing = this.nodes.get(selector);
    if (this.nodes.has(selector) && (!existing || existing.isConnected)) return existing;
    // Missing elements stay cached until a structural React commit.
    const node = this.root.querySelector<HTMLElement>(selector);
    this.nodes.set(selector, node);
    return node;
  }
  text(node: Element | null | undefined, value: string) {
    if (node && node.textContent !== value) node.textContent = value;
  }
  html(node: Element | null | undefined, value: string) {
    if (node && node.innerHTML !== value) node.innerHTML = value;
  }
  clear() { this.observer.disconnect(); this.nodes.clear(); }
}
