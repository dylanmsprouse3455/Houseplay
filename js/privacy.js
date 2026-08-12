(function () {
  "use strict";

  const replacements = [
    [/Dylan\s*×\s*Jamie/g, "HousePlay"],
    [/Give Dylan head/g, "Give head"],
    [/Started by Jamie/g, "Started manually"],
    [/Jamie’s missions/g, "Daily missions"],
    [/Jamie's missions/g, "Daily missions"],
    [/Dylan Admin/g, "Admin"],
    [/Dylan’s/g, "Admin’s"],
    [/Dylan's/g, "Admin's"],
    [/Jamie’s/g, "Player’s"],
    [/Jamie's/g, "Player's"],
    [/\bDylan\b/g, "Admin"],
    [/\bJamie\b/g, "Player"]
  ];

  function clean(value) {
    let output = String(value == null ? "" : value);
    replacements.forEach(([pattern, replacement]) => {
      output = output.replace(pattern, replacement);
    });
    return output;
  }

  function sanitizeNode(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const next = clean(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    ["aria-label", "title", "placeholder", "alt", "value"].forEach((attribute) => {
      if (!node.hasAttribute(attribute)) return;
      const current = node.getAttribute(attribute);
      const next = clean(current);
      if (next !== current) node.setAttribute(attribute, next);
    });

    node.childNodes.forEach(sanitizeNode);
  }

  function sanitizePage() {
    sanitizeNode(document.documentElement);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(sanitizeNode);
      if (mutation.type === "characterData") sanitizeNode(mutation.target);
      if (mutation.type === "attributes") sanitizeNode(mutation.target);
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sanitizePage, { once: true });
  } else {
    sanitizePage();
  }

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "placeholder", "alt", "value"]
  });
})();
