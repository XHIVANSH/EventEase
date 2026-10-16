import { tool } from "langchain";
import * as z from "zod";
import { checkIn, eventStats } from "../services/events.js";
import { safeRun } from "./safeRun.js";
export function makeOrganiserTools(session) {
  const organiserOnly = (fn) =>
    safeRun((input) =>
      session.role === "organiser"
        ? fn(input)
        : { ok: false, message: "Only organisers can do that." }
    );

  const checkInTool = tool(organiserOnly(checkIn), {
    name: "check_in",
    description: "Organiser only. Verify a ticket code (like FEST-T7-0042) and mark it CHECKED_IN. Each ticket works once.",
    schema: z.object({ ticketCode: z.string().describe("Ticket code, e.g. FEST-T7-0042") }),
  });

  const eventStatsTool = tool(organiserOnly(eventStats), {
    name: "event_stats",
    description:
      "Organiser only. Confirmed, waitlisted, checked-in and cancelled counts per event, longest waitlist first. Optional category filter.",
    schema: z.object({ category: z.enum(["TECH", "CULTURAL", "SPORTS"]).optional() }),
  });

  return [checkInTool, eventStatsTool];
}
