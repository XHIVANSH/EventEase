import { getDb } from "../database.js";

export const MAX_CONFIRMED_EVENTS = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const fail = (message) => ({ ok: false, message });

export function makeTicketCode(regId) {
  return `FEST-T7-${String(regId).padStart(4, "0")}`;
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function findParticipant(email) {
  return getDb()
    .prepare("SELECT * FROM participants WHERE email = ?")
    .get(cleanEmail(email));
}
function seatsTaken(eventId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM registrations
       WHERE event_id = ? AND status IN ('CONFIRMED', 'CHECKED_IN')`
    )
    .get(eventId).n;
}
function countConfirmed(participantId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM registrations
       WHERE participant_id = ? AND status IN ('CONFIRMED', 'CHECKED_IN')`
    )
    .get(participantId).n;
}
function findEvent(nameOrId) {
  const db = getDb();
  const text = String(nameOrId || "").trim();
  if (!text) return { error: "Which event do you mean?" };

  if (/^\d+$/.test(text)) {
    const byId = db.prepare("SELECT * FROM events WHERE event_id = ?").get(Number(text));
    if (byId) return { event: byId };
  }
  const exact = db.prepare("SELECT * FROM events WHERE LOWER(name) = LOWER(?)").get(text);
  if (exact) return { event: exact };

  const matches = db.prepare("SELECT * FROM events WHERE name LIKE ?").all(`%${text}%`);
  if (matches.length === 1) return { event: matches[0] };
  if (matches.length === 0) return { error: `No event found matching "${text}".` };
  const names = matches.map((m) => m.name).join(", ");
  return { error: `Several events match "${text}": ${names}. Ask the user which one they mean.` };
}
export function listEvents({ category, date, onlyWithSeats } = {}) {
  if (date && !DATE_PATTERN.test(date)) return fail("Date must be in YYYY-MM-DD format.");

  let sql = `
    SELECT e.event_id, e.name, e.category, e.venue, e.event_date,
           e.start_time, e.end_time, e.capacity, e.fee,
           (SELECT COUNT(*) FROM registrations r
             WHERE r.event_id = e.event_id
               AND r.status IN ('CONFIRMED', 'CHECKED_IN')) AS seats_taken
    FROM events e
    WHERE 1 = 1`;
  const params = [];
  if (category) {
    sql += " AND e.category = ?";
    params.push(category);
  }
  if (date) {
    sql += " AND e.event_date = ?";
    params.push(date);
  }
  sql += " ORDER BY e.event_date, e.start_time";

  let events = getDb().prepare(sql).all(...params).map((e) => ({
    ...e,
    seats_left: e.capacity - e.seats_taken,
  }));
  if (onlyWithSeats) events = events.filter((e) => e.seats_left > 0);

  return { ok: true, count: events.length, events };
}

export function registerParticipant({ name, email, college, phone, dryRun = false }) {
  const mail = cleanEmail(email);
  if (!EMAIL_PATTERN.test(mail)) return fail("That email address doesn't look valid.");

  const existing = findParticipant(mail);
  if (existing) {
    return {
      ok: true,
      already_registered: true,
      participant: existing,
      message: `${existing.name} is already in the system, no need to register again.`,
    };
  }

  if (!String(name || "").trim() || !String(college || "").trim()) {
    return fail("To create a new participant I need their name and college.");
  }
  const digits = phone ? String(phone).replace(/\D/g, "") : null;
  if (phone && digits.length !== 10) return fail("The phone number must have 10 digits.");

  if (dryRun) {
    return { ok: true, preview: true, message: `Would create participant ${name} (${mail}) from ${college}.` };
  }
  const info = getDb()
    .prepare("INSERT INTO participants (name, email, college, phone) VALUES (?, ?, ?, ?)")
    .run(String(name).trim(), mail, String(college).trim(), digits);

  return {
    ok: true,
    participant_id: Number(info.lastInsertRowid),
    message: `Participant ${name} created.`,
  };
}

export function registerForEvent({ email, eventName, dryRun = false }) {
  const db = getDb();
  const person = findParticipant(email);
  if (!person) {
    return fail(`No participant found with email ${email}. They need to be registered first (name and college required).`);
  }
  const found = findEvent(eventName);
  if (found.error) return fail(found.error);
  const event = found.event;

  const attempt = db.transaction(() => {
    const already = db
      .prepare(
        `SELECT status FROM registrations
         WHERE event_id = ? AND participant_id = ? AND status <> 'CANCELLED'`
      )
      .get(event.event_id, person.participant_id);
    if (already) {
      return fail(`${person.name} is already registered for ${event.name} (status: ${already.status}).`);
    }

    if (countConfirmed(person.participant_id) >= MAX_CONFIRMED_EVENTS) {
      return fail(`${person.name} already has ${MAX_CONFIRMED_EVENTS} confirmed events, which is the maximum allowed.`);
    }

    const clash = db
      .prepare(
        `SELECT e.name, e.start_time, e.end_time
         FROM registrations r JOIN events e ON e.event_id = r.event_id
         WHERE r.participant_id = ?
           AND r.status IN ('CONFIRMED', 'WAITLISTED', 'CHECKED_IN')
           AND e.event_date = ?
           AND e.start_time < ? AND ? < e.end_time`
      )
      .get(person.participant_id, event.event_date, event.end_time, event.start_time);
    if (clash) {
      return fail(
        `Time clash: ${event.name} (${event.start_time}-${event.end_time}) overlaps with ` +
          `${clash.name} (${clash.start_time}-${clash.end_time}) on the same day.`
      );
    }

    const seatsLeft = event.capacity - seatsTaken(event.event_id);
    const status = seatsLeft > 0 ? "CONFIRMED" : "WAITLISTED";

    if (dryRun) {
      return {
        ok: true,
        preview: true,
        participant: person.name,
        event: event.name,
        date: event.event_date,
        time: `${event.start_time}-${event.end_time}`,
        venue: event.venue,
        fee: event.fee,
        would_be: status,
        seats_left: seatsLeft,
      };
    }

    const info = db
      .prepare(
        `INSERT INTO registrations (event_id, participant_id, status, registered_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(event.event_id, person.participant_id, status, new Date().toISOString());
    const regId = Number(info.lastInsertRowid);
    const ticketCode = makeTicketCode(regId);
    db.prepare("UPDATE registrations SET ticket_code = ? WHERE reg_id = ?").run(ticketCode, regId);

    let waitlistPosition = null;
    if (status === "WAITLISTED") {
      waitlistPosition = db
        .prepare(
          `SELECT COUNT(*) AS n FROM registrations
           WHERE event_id = ? AND status = 'WAITLISTED' AND reg_id <= ?`
        )
        .get(event.event_id, regId).n;
    }

    return {
      ok: true,
      status,
      ticket_code: ticketCode,
      participant: person.name,
      event: event.name,
      date: event.event_date,
      time: `${event.start_time}-${event.end_time}`,
      venue: event.venue,
      fee: event.fee,
      waitlist_position: waitlistPosition,
    };
  });

  return attempt.immediate();
}
function promoteFromWaitlist(eventId) {
  const db = getDb();
  const event = db.prepare("SELECT capacity FROM events WHERE event_id = ?").get(eventId);
  if (seatsTaken(eventId) >= event.capacity) return null;

  const waiting = db
    .prepare(
      `SELECT r.reg_id, r.ticket_code, p.participant_id, p.name, p.email
       FROM registrations r JOIN participants p ON p.participant_id = r.participant_id
       WHERE r.event_id = ? AND r.status = 'WAITLISTED'
       ORDER BY r.reg_id`
    )
    .all(eventId);

  for (const person of waiting) {
    if (countConfirmed(person.participant_id) < MAX_CONFIRMED_EVENTS) {
      db.prepare("UPDATE registrations SET status = 'CONFIRMED' WHERE reg_id = ?").run(person.reg_id);
      return { name: person.name, email: person.email, ticket_code: person.ticket_code };
    }
  }
  return null;
}

export function cancelRegistration({ email, eventName, dryRun = false }) {
  const db = getDb();
  const person = findParticipant(email);
  if (!person) return fail(`No participant found with email ${email}.`);
  const found = findEvent(eventName);
  if (found.error) return fail(found.error);
  const event = found.event;

  const attempt = db.transaction(() => {
    const reg = db
      .prepare(
        `SELECT * FROM registrations
         WHERE event_id = ? AND participant_id = ? AND status <> 'CANCELLED'`
      )
      .get(event.event_id, person.participant_id);
    if (!reg) return fail(`${person.name} has no active registration for ${event.name}.`);
    if (reg.status === "CHECKED_IN") {
      return fail(`${person.name} has already checked in to ${event.name}, so it can't be cancelled.`);
    }

    if (dryRun) {
      return {
        ok: true,
        preview: true,
        message: `Would cancel ${person.name}'s ${reg.status} registration for ${event.name} (ticket ${reg.ticket_code}).`,
      };
    }

    db.prepare("UPDATE registrations SET status = 'CANCELLED' WHERE reg_id = ?").run(reg.reg_id);
    const promoted = reg.status === "CONFIRMED" ? promoteFromWaitlist(event.event_id) : null;

    return {
      ok: true,
      cancelled_ticket: reg.ticket_code,
      event: event.name,
      was: reg.status,
      promoted_from_waitlist: promoted,
    };
  });

  return attempt.immediate();
}

export function getMyRegistrations({ email }) {
  const person = findParticipant(email);
  if (!person) return fail(`No participant found with email ${email}.`);

  const registrations = getDb()
    .prepare(
      `SELECT r.status, r.ticket_code, e.name AS event, e.category, e.venue,
              e.event_date, e.start_time, e.end_time, e.fee,
              CASE WHEN r.status = 'WAITLISTED' THEN
                (SELECT COUNT(*) FROM registrations w
                  WHERE w.event_id = r.event_id AND w.status = 'WAITLISTED'
                    AND w.reg_id <= r.reg_id)
              END AS waitlist_position
       FROM registrations r JOIN events e ON e.event_id = r.event_id
       WHERE r.participant_id = ?
       ORDER BY e.event_date, e.start_time`
    )
    .all(person.participant_id);

  return { ok: true, participant: person.name, count: registrations.length, registrations };
}

export function checkIn({ ticketCode }) {
  const db = getDb();
  const code = String(ticketCode || "").trim().toUpperCase();
  const reg = db
    .prepare(
      `SELECT r.reg_id, r.status, p.name AS participant, e.name AS event, e.event_date, e.start_time
       FROM registrations r
       JOIN participants p ON p.participant_id = r.participant_id
       JOIN events e ON e.event_id = r.event_id
       WHERE r.ticket_code = ?`
    )
    .get(code);

  if (!reg) return fail(`Ticket ${code} was not found.`);
  if (reg.status === "CHECKED_IN") return fail(`Ticket ${code} was already used (${reg.participant}, ${reg.event}). Entry denied.`);
  if (reg.status === "WAITLISTED") return fail(`Ticket ${code} is only WAITLISTED, not confirmed. Entry denied.`);
  if (reg.status === "CANCELLED") return fail(`Ticket ${code} was cancelled. Entry denied.`);

  const info = db
    .prepare("UPDATE registrations SET status = 'CHECKED_IN' WHERE reg_id = ? AND status = 'CONFIRMED'")
    .run(reg.reg_id);
  if (info.changes === 0) return fail("Could not check in this ticket. Please try again.");

  return { ok: true, ticket_code: code, participant: reg.participant, event: reg.event, date: reg.event_date, start_time: reg.start_time };
}

export function eventStats({ category } = {}) {
  let sql = `
    SELECT e.name, e.category, e.event_date, e.start_time, e.capacity,
           COALESCE(SUM(r.status = 'CONFIRMED'), 0)  AS confirmed,
           COALESCE(SUM(r.status = 'WAITLISTED'), 0) AS waitlisted,
           COALESCE(SUM(r.status = 'CHECKED_IN'), 0) AS checked_in,
           COALESCE(SUM(r.status = 'CANCELLED'), 0)  AS cancelled
    FROM events e LEFT JOIN registrations r ON r.event_id = e.event_id`;
  const params = [];
  if (category) {
    sql += " WHERE e.category = ?";
    params.push(category);
  }
  sql += " GROUP BY e.event_id ORDER BY waitlisted DESC, e.event_date, e.start_time";

  const stats = getDb().prepare(sql).all(...params);
  return { ok: true, note: "Rows are sorted by longest waitlist first.", stats };
}
