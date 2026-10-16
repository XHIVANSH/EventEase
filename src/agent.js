import { createAgent } from "langchain";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import { buildSystemPrompt } from "./prompt.js";
import { getToolsForRole } from "./tools/index.js";
import { textOf } from "./utils/format.js";

export function createEventEaseAgent(role) {
  const model = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0, 
  });

  return createAgent({
    model,
    tools: getToolsForRole(role),
    systemPrompt: buildSystemPrompt(role),
    checkpointer: new MemorySaver(), 
  });
}

export async function askAgent(agent, text, threadId) {
  const result = await agent.invoke(
    { messages: [{ role: "user", content: text }] },
    { configurable: { thread_id: threadId }, recursionLimit: 20 }
  );
  const lastMessage = result.messages[result.messages.length - 1];
  return textOf(lastMessage.content) || "Sorry, I couldn't come up with a reply. Please try again.";
}
