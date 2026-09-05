import { OPENAI_BLOCK } from "../schema/index.js";

// Collapse an OpenAI content-part array into a plain string when every part is
// text, joining them with a newline; a mixed array (text + image, ...) is
// returned untouched so nothing is lost.
//
// The join matters: strict OpenAI-compatible gateways reject a content array
// where they expect a string, and a Claude client routinely sends several text
// blocks in one turn. An earlier version of this helper only collapsed a lone
// text part, which silently changed the wire shape for every multi-block turn.
export function collapseTextParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return parts;
  // Only plain {type, text} blocks may be joined. A part carrying anything else
  // — cache_control for the DashScope/alicode prompt cache, a signature, an id —
  // would lose that field in a string, so such an array is returned untouched.
  const isPlainText = (p) =>
    p?.type === OPENAI_BLOCK.TEXT &&
    Object.keys(p).every((k) => k === "type" || k === "text");
  if (!parts.every(isPlainText)) return parts;
  return parts.map((p) => p.text || "").join("\n");
}
