import { participantTools, listEventsTool, getMyRegistrationsTool } from "./participantTools.js";
import { makeOrganiserTools } from "./organiserTools.js";

export function getToolsForRole(role) {
  if (role === "organiser") {
    return [listEventsTool, getMyRegistrationsTool, ...makeOrganiserTools({ role })];
  }
  return participantTools; 
}
