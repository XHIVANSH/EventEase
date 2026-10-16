export function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part.text || ""))
      .join("")
      .trim();
  }
  return "";
}

export function friendlyError(err) {
  const text = String(err?.message || err);
  if (process.env.DEBUG) console.error("[debug]", err);

  if (/429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(text)) {
    return "Gemini's free quota is used up or I'm being rate-limited. Please wait a minute and try again.";
  }
  if (/API key|API_KEY_INVALID|PERMISSION_DENIED|\b401\b|\b403\b/i.test(text)) {
    return "Gemini rejected the API key. Please check GOOGLE_API_KEY in your .env file.";
  }
  if (/model/i.test(text) && /not found|\b404\b|not supported/i.test(text)) {
    return "That Gemini model isn't available. Try another one in GEMINI_MODEL (.env).";
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(text)) {
    return "I couldn't reach Gemini. Please check your internet connection.";
  }
  return "Sorry, something went wrong on my side. Please try again.";
}
