"use client";

import { useEffect } from "react";
import { LANG_KEY, toFrench } from "@/lib/i18n";

const ATTRS = ["aria-label", "placeholder", "title"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
export const LANG_EVENT = "verdict:lang";

export function readLang(): "en" | "fr" {
  try {
    return localStorage.getItem(LANG_KEY) === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

/**
 * Applies the language the user picked in Settings to everything on screen, including
 * text that appears later (live hints, results). English stays the source; switching back
 * restores the originals.
 */
export function I18nRuntime() {
  useEffect(() => {
    const originals = new WeakMap<Node, string>();
    const attrOriginals = new WeakMap<Element, Record<string, string>>();
    let lang = readLang();
    let busy = false;

    // React marks every node it has hydrated. Translating a node React has not hydrated yet
    // would break hydration, so those wait for the next pass.
    const owned = (n: Node) => Object.keys(n).some((k) => k.startsWith("__reactFiber$"));
    const pending = (n: Node) => {
      if (owned(n)) return false;
      const el = n instanceof Element ? n : n.parentElement;
      if (el?.closest(".ui-toast-region")) return false; // built outside React
      for (let e = el; e; e = e.parentElement) if (owned(e)) return !owned(el!) || n.nodeType === Node.TEXT_NODE ? !owned(el!) : false;
      return false;
    };

    const skip = (n: Node | null) => {
      if (n && pending(n)) return true;
      for (let e = n instanceof Element ? n : n?.parentElement; e; e = e.parentElement) {
        if (SKIP.has(e.tagName) || e.hasAttribute("data-no-i18n")) return true;
      }
      return false;
    };

    const text = (node: Text) => {
      if (skip(node)) return;
      const src = originals.get(node) ?? node.nodeValue ?? "";
      if (lang === "fr") {
        const fr = toFrench(src);
        if (fr != null && node.nodeValue !== fr) {
          originals.set(node, src);
          node.nodeValue = fr;
        }
      } else if (originals.has(node)) {
        node.nodeValue = src;
        originals.delete(node);
      }
    };

    const attrs = (el: Element) => {
      if (skip(el)) return;
      const saved = attrOriginals.get(el) ?? {};
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v == null) continue;
        const src = saved[a] ?? v;
        if (lang === "fr") {
          const fr = toFrench(src);
          if (fr != null && v !== fr) {
            saved[a] = src;
            el.setAttribute(a, fr);
          }
        } else if (saved[a] != null) {
          el.setAttribute(a, saved[a]);
          delete saved[a];
        }
      }
      attrOriginals.set(el, saved);
    };

    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return text(root as Text);
      if (!(root instanceof Element)) return;
      attrs(root);
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = it.nextNode(); n; n = it.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) text(n as Text);
        else attrs(n as Element);
      }
    };

    const apply = () => {
      busy = true;
      document.documentElement.lang = lang;
      walk(document.body);
      mo.takeRecords(); // our own edits are not news
      busy = false;
      document.documentElement.classList.add("i18n-ready");
    };

    const mo = new MutationObserver((records) => {
      if (busy || lang === "en") return;
      busy = true;
      for (const r of records) {
        if (r.type === "characterData") {
          originals.delete(r.target);
          text(r.target as Text);
        } else if (r.type === "attributes" && r.target instanceof Element) {
          const saved = attrOriginals.get(r.target);
          if (saved && r.attributeName) delete saved[r.attributeName];
          attrs(r.target);
        } else r.addedNodes.forEach(walk);
      }
      mo.takeRecords();
      busy = false;
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

    const onLang = () => {
      lang = readLang();
      apply();
    };
    window.addEventListener(LANG_EVENT, onLang);
    apply();
    // Late hydration (streamed parts) does not mutate the DOM: pass again a few times.
    const passes = [250, 700, 1500, 3000].map((ms) => setTimeout(() => lang === "fr" && apply(), ms));
    return () => {
      passes.forEach(clearTimeout);
      mo.disconnect();
      window.removeEventListener(LANG_EVENT, onLang);
    };
  }, []);
  return null;
}
