export function safeRun(fn) {
  return async (input) => {
    try {
      return JSON.stringify(fn(input));
    } catch (err) {
      console.error("[tool error]", err.message);
      return JSON.stringify({
        ok: false,
        message: "There was a database problem. Please try again in a moment.",
      });
    }
  };
}
