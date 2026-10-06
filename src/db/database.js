import { openDB } from "idb";

const DB_NAME = "event-checkin-db";
const DB_VERSION = 1;
const STORE_NAME = "tickets";

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, {
        keyPath: "ticket_id",
      });
    }
  },
});

// Add multiple tickets
export async function addTickets(tickets) {
  const db = await dbPromise;

  const tx = db.transaction(STORE_NAME, "readwrite");

  for (const incomingTicket of tickets) {
    const existingTicket = await tx.store.get(
      incomingTicket.ticket_id
    );

    if (existingTicket) {
      // Preserve check-in information
      await tx.store.put({
        ...incomingTicket,
        checkedIn: existingTicket.checkedIn,
        checkedInAt: existingTicket.checkedInAt,
      });
    } else {
      // New ticket
      await tx.store.put({
        ...incomingTicket,
        checkedIn: false,
        checkedInAt: null,
      });
    }
  }

  await tx.done;
}

// Get a ticket by ticket ID
export async function getTicket(ticketId) {
  const db = await dbPromise;

  return await db.get(STORE_NAME, ticketId);
}

// Get all tickets
export async function getAllTickets() {
  const db = await dbPromise;

  return await db.getAll(STORE_NAME);
}

// Update check-in status
export async function checkInTicket(ticketId) {
  const db = await dbPromise;

  const ticket = await db.get(STORE_NAME, ticketId);

  if (!ticket) {
    return {
      success: false,
      reason: "NOT_FOUND",
    };
  }

  if (ticket.checkedIn) {
    return {
      success: false,
      reason: "ALREADY_CHECKED_IN",
      ticket,
    };
  }

  ticket.checkedIn = true;
  ticket.checkedInAt = new Date().toISOString();

  await db.put(STORE_NAME, ticket);

  return {
    success: true,
    ticket,
  };
}
