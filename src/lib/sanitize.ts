import sanitizeHtmlLib from "sanitize-html";

const HTML_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    "p", "br", "b", "strong", "i", "em", "u", "span", "div", "section", "article",
    "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "blockquote", "hr", "table",
    "thead", "tbody", "tr", "td", "th", "small", "figure", "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "class", "aria-label"],
    img: ["src", "alt", "width", "height", "loading", "class"],
    "*": ["class", "style", "id", "data-*", "aria-*"],
  },
  allowedStyles: {
    "*": {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i, /^rgba\(/i, /^[a-z]+$/i],
      "background-color": [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i, /^rgba\(/i, /^[a-z]+$/i],
      "text-align": [/^(left|right|center|justify)$/],
      "font-size": [/^\d+(px|em|rem|%)$/],
      "font-family": [/^[\w\s,'"-]+$/],
      "font-style": [/^(normal|italic)$/],
      "font-weight": [/^[\d]+$/],
      "letter-spacing": [/^-?[\d.]+(px|em|rem)$/],
      "line-height": [/^[\d.]+(px|em|rem|%)$/],
      margin: [/^-?[\d.]+(px|em|rem|%|auto)(\s+-?[\d.]+(px|em|rem|%|auto))*$/],
      padding: [/^-?[\d.]+(px|em|rem|%)(\s+-?[\d.]+(px|em|rem|%))*$/],
      "border-radius": [/^[\d.]+(px|em|rem|%)$/],
      display: [/^(block|inline|inline-block|flex|grid|none)$/],
      gap: [/^[\d.]+(px|em|rem)$/],
      opacity: [/^[\d.]+$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
  },
  disallowedTagsMode: "discard",
};

export function sanitizeHtml(input: string): string {
  return sanitizeHtmlLib(input.slice(0, 20_000), HTML_OPTIONS);
}

/** CSS kustom: tolak construct berbahaya (@import, url(), expression, positional). */
export function sanitizeCss(input: string): string {
  const stripped = input
    .slice(0, 20_000)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/behavior\s*:/gi, "")
    .replace(/-moz-binding\s*:/gi, "")
    .replace(/position\s*:\s*(fixed|absolute)/gi, "position: relative")
    .replace(/<\/?script[^>]*>/gi, "");
  // Seimbangkan kurung kurawal agar tidak bisa menutup <style> dan menyuntik HTML.
  let depth = 0;
  for (const char of stripped) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth < 0) return "";
  }
  return depth === 0 ? stripped : "";
}

/** <head> kustom: hanya meta name/property/content yang diizinkan. */
export function sanitizeHeadMeta(input: string): string {
  const output: string[] = [];
  for (const match of input.slice(0, 5_000).matchAll(/<meta\s+([^>]+)>/gi)) {
    const attrs = match[1] ?? "";
    const name = /name\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? /property\s*=\s*"([^"]+)"/i.exec(attrs)?.[1];
    const content = /content\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    if (!name || !content || !/^[\w:.\- ]+$/.test(name)) continue;
    const safeContent = content.replace(/"/g, "").replace(/</g, "").slice(0, 300);
    output.push(`<meta name="${name}" content="${safeContent}" />`);
  }
  return output.join("\n");
}

export function stripTags(input: string): string {
  return sanitizeHtmlLib(input, { allowedTags: [], allowedAttributes: {} });
}
