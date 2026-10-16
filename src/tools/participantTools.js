import { tool } from "langchain";
import * as z from "zod";
import {
  listEvents,
  registerParticipant,
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
} from "../services/events.js";
import { safeRun } from "./safeRun.js";
import { checkConfirmation, withGate } from "./confirmation.js";

const categorySchema = z.enum(["TECH", "CULTURAL", "SPORTS"]);

export const listEventsTool = tool(safeRun(listEvents), {
  name: "list_events",
  description:
    "List fest events from the database. Optional filters: category, date (YYYY-MM-DD) and onlyWithSeats. Each event includes seats_left.",
  schema: z.object({
    category: categorySchema.optional(),
    date: z.string().optional().describe("Date as YYYY-MM-DD"),
    onlyWithSeats: z.boolean().optional().describe("true to hide full events"),
  }),
});

export const getMyRegistrationsTool = tool(safeRun(getMyRegistrations), {
  name: "get_my_registrations",
  description: "Show all registrations (with status and ticket codes) of the participant with this email.",
  schema: z.object({ email: z.string().describe("Participant email") }),
});

const registerParticipantTool = tool(
  safeRun(({ name, email, college, phone, confirmed }) => {
    const gate = checkConfirmation(`new-participant:${email}`, confirmed);
    return withGate(gate, registerParticipant({ name, email, college, phone, dryRun: gate.dryRun }));
  }),
  {
    name: "register_participant",
    description:
      "Create a new participant if the email is not in the system yet. Needs name, email and college. First call with confirmed=false to preview, then confirmed=true only after the user says yes.",
    schema: z.object({
      name: z.string(),
      email: z.string(),
      college: z.string(),
      phone: z.string().optional().describe("10-digit phone number, optional"),
      confirmed: z.boolean().optional().describe("true only after the user explicitly confirmed"),
    }),
  }
);

const registerForEventTool = tool(
  safeRun(({ email, eventName, confirmed }) => {
    const gate = checkConfirmation(`register:${email}:${eventName}`, confirmed);
    return withGate(gate, registerForEvent({ email, eventName, dryRun: gate.dryRun }));
  }),
  {
    name: "register_for_event",
    description:
      "Register a participant for ONE event. Gives a CONFIRMED seat if available, otherwise WAITLISTED, and a ticket code. Checks time clashes, the 3-event limit and duplicates. Call with confirmed=false first to preview, then confirmed=true only after the user says yes.",
    schema: z.object({
      email: z.string().describe("Participant email"),
      eventName: z.string().describe("Event name (or part of it)"),
      confirmed: z.boolean().optional().describe("true only after the user explicitly confirmed"),
    }),
  }
);

const cancelRegistrationTool = tool(
  safeRun(({ email, eventName, confirmed }) => {
    const gate = checkConfirmation(`cancel:${email}:${eventName}`, confirmed);
    return withGate(gate, cancelRegistration({ email, eventName, dryRun: gate.dryRun }));
  }),
  {
    name: "cancel_registration",
    description:
      "Cancel a participant's registration for one event. If a confirmed seat is freed, the first waitlisted person is promoted automatically. Call with confirmed=false first to preview, then confirmed=true only after the user says yes.",
    schema: z.object({
      email: z.string().describe("Participant email"),
      eventName: z.string().describe("Event name (or part of it)"),
      confirmed: z.boolean().optional().describe("true only after the user explicitly confirmed"),
    }),
  }
);

export const participantTools = [
  listEventsTool,
  registerParticipantTool,
  registerForEventTool,
  cancelRegistrationTool,
  getMyRegistrationsTool,
];
