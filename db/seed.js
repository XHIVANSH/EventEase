import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, DB_PATH } from "../src/database.js";
import { addDays } from "../src/utils/dates.js";
import { makeTicketCode } from "../src/services/events.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const db = getDb();
db.exec(fs.readFileSync(path.join(here, "schema.sql"), "utf8"));

const events = [
  ["Hackathon",            "TECH",     "Main Computer Lab",  1, "09:00", "13:00", 30, 100],
  ["Robo Race",            "TECH",     "Robotics Arena",     1, "14:00", "16:00",  5, 150],
  ["Code Sprint",          "TECH",     "CS Lab 2",           1, "10:00", "12:00", 40,  50],
  ["AI Quiz",              "TECH",     "Seminar Hall",       1, "15:00", "16:30", 60,   0],
  ["Battle of Bands",      "CULTURAL", "Open Air Theatre",   1, "17:00", "19:00", 100, 200],
  ["Classical Dance",      "CULTURAL", "Auditorium",         1, "11:00", "13:00", 50,   0],
  ["Street Play",          "CULTURAL", "Quad",               2, "10:00", "12:00",  5,   0],
  ["Poetry Slam",          "CULTURAL", "Library Hall",       2, "14:00", "15:30", 30,   0],
  ["Football Tournament",  "SPORTS",   "Main Ground",        1, "08:00", "11:00",  5, 100],
  ["Chess Championship",   "SPORTS",   "Indoor Hall",        2, "09:00", "12:00", 32,  50],
  ["Tug of War",           "SPORTS",   "Main Ground",        2, "15:00", "16:00", 40,   0],
  ["Web Dev Workshop",     "TECH",     "CS Lab 1",           2, "10:00", "13:00", 25,  75],
  ["Capture the Flag",     "TECH",     "CS Lab 2",           2, "14:00", "17:00",  5, 100],
  ["Fashion Show",         "CULTURAL", "Auditorium",         2, "18:00", "20:00", 80, 150],
];

const firstNames = [
  "Riya", "Aarav", "Ananya", "Vihaan", "Isha", "Kabir", "Meera", "Rohan", "Sneha", "Arjun",
  "Diya", "Karan", "Pooja", "Rahul", "Tanvi", "Siddharth", "Nisha", "Yash", "Kavya", "Manav",
  "Priya", "Aditya", "Simran", "Harsh", "Neha", "Vivek", "Anjali", "Dev", "Shreya", "Mohit",
];
const colleges = [
  ["ABC Institute", "abc.edu"],
  ["ICFAI University Dehradun", "iudehradun.edu"],
  ["Graphic Era", "geu.edu"],
  ["DIT University", "dit.edu"],
  ["UPES", "upes.edu"],
];

const C = "CONFIRMED", W = "WAITLISTED", X = "CANCELLED", I = "CHECKED_IN";
const registrations = [
  [1, 5, C],
  [2, 2, C], [3, 2, C], [4, 2, C], [5, 2, C],                 
  [2, 1, C], [3, 1, C], [4, 1, C], [28, 1, C], [29, 1, C], [30, 1, C],
  [6, 7, C], [7, 7, C], [8, 7, C], [9, 7, C], [10, 7, C],      
  [11, 7, W], [12, 7, W],
  [13, 13, C], [14, 13, C], [15, 13, C], [16, 13, C], [17, 13, C], 
  [18, 13, W], [19, 13, W], [20, 13, W], [21, 13, W],          
  [22, 9, C], [23, 9, C], [24, 9, C], [25, 9, C], [26, 9, C],  
  [27, 9, W],
  [5, 3, C], [13, 3, C], [14, 12, C], [15, 10, C], [16, 10, C],
  [28, 14, C], [29, 8, C], [30, 4, C],
  [17, 4, C],                                                  
  [20, 6, C], [21, 12, C], [12, 8, C],
  [25, 5, X], [26, 14, X],
  [19, 3, I],                                                  
];

const insertAll = db.transaction(() => {
  const addEvent = db.prepare(
    `INSERT INTO events (name, category, venue, event_date, start_time, end_time, capacity, fee)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const [name, category, venue, day, start, end, capacity, fee] of events) {
    addEvent.run(name, category, venue, addDays(day), start, end, capacity, fee);
  }

  const addPerson = db.prepare(
    "INSERT INTO participants (name, email, college, phone) VALUES (?, ?, ?, ?)"
  );
  firstNames.forEach((name, i) => {
    const [college, domain] = colleges[i % colleges.length];
    addPerson.run(name, `${name.toLowerCase()}@${domain}`, college, `98765${10000 + i}`);
  });

  const addReg = db.prepare(
    `INSERT INTO registrations (reg_id, event_id, participant_id, status, ticket_code, registered_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  registrations.forEach(([personId, eventId, status], i) => {
    const regId = i + 1;
    const when = new Date(Date.now() - (60 - regId) * 3600 * 1000).toISOString();
    addReg.run(regId, eventId, personId, status, makeTicketCode(regId), when);
  });
});

insertAll();
console.log(`Seeded ${DB_PATH}`);
console.log(`${events.length} events, ${firstNames.length} participants, ${registrations.length} registrations (DEVELOPMENT SAMPLE DATA)`);
console.log(`Fest day 1 = ${addDays(1)}, day 2 = ${addDays(2)}`);
