import "dotenv/config";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createEventEaseAgent, askAgent } from "./agent.js";
import { getDb } from "./database.js";
import { nextTurn } from "./tools/confirmation.js";
import { friendlyError } from "./utils/format.js";

async function chooseRole(rl) {
  while (true) {
    const answer = (await rl.question("Who are you?  1) Participant   2) Organiser : ")).trim();
    if (answer === "1") return "participant";
    if (answer === "2") {
      if (!process.env.ORGANISER_PIN) {
        console.log("Organiser login isn't set up (add ORGANISER_PIN to .env).");
        continue;
      }
      const pin = (await rl.question("Organiser PIN: ")).trim();
      if (pin === process.env.ORGANISER_PIN) return "organiser";
      console.log("Wrong PIN.");
      continue;
    }
    console.log("Please type 1 or 2.");
  }
}

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.log("GOOGLE_API_KEY is missing. Copy .env.example to .env and add your Gemini key.");
    process.exit(1);
  }
  try {
    getDb().prepare("SELECT COUNT(*) AS n FROM events").get();
  } catch {
    console.log("The database isn't ready. Run: npm run seed");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  rl.on("close", () => {
    console.log("\nBye!");
    process.exit(0);
  });

  console.log("=== EventEase - College Fest Assistant ===");
  const role = await chooseRole(rl);
  const agent = createEventEaseAgent(role);
  const threadId = `cli-${Date.now()}`;
  console.log(`\nLogged in as ${role}. Type 'exit' to quit.\n`);

  while (true) {
    const text = (await rl.question("You: ")).trim();
    if (!text) {
      console.log("EventEase: Please type a message.\n");
      continue;
    }
    if (["exit", "quit"].includes(text.toLowerCase())) break;
    if (text.length > 1000) {
      console.log("EventEase: That message is too long. Please shorten it.\n");
      continue;
    }

    nextTurn(); // lets the confirmation gate know a new user message arrived
    try {
      const reply = await askAgent(agent, text, threadId);
      console.log(`\nEventEase: ${reply}\n`);
    } catch (err) {
      console.log(`\nEventEase: ${friendlyError(err)}\n`);
    }
  }
  rl.close();
}

main();
