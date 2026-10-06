import { useEffect, useState } from "react";
import { readExcelFile } from "./utils/excel";
import {
  addTickets,
  getAllTickets,
  checkInTicket,
} from "./db/database";

function App() {
  const [tickets, setTickets] = useState([]);
  const [message, setMessage] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [result, setResult] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [showImportConfirmation, setShowImportConfirmation] =
    useState(false);

  // Load tickets from IndexedDB when app starts
  useEffect(() => {
    const loadTickets = async () => {
      try {
        const storedTickets = await getAllTickets();
        setTickets(storedTickets);
      } catch (error) {
        console.error("Failed to load tickets:", error);
        setMessage("Failed to load tickets from IndexedDB.");
      }
    };

    loadTickets();
  }, []);

  // Step 1: User selects Excel file
  const handleExcelUpload = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setSelectedFile(file);
    setShowImportConfirmation(true);

    // Allows selecting the same file again later
    event.target.value = "";
  };

  // Step 2: User confirms Excel import
  const confirmExcelImport = async () => {
    if (!selectedFile) return;

    try {
      setMessage("Reading Excel file...");

      const rows = await readExcelFile(selectedFile);

      if (rows.length === 0) {
        setMessage("Excel file is empty.");
        setSelectedFile(null);
        setShowImportConfirmation(false);
        return;
      }

      const formattedTickets = rows.map((row) => ({
        ticket_id: String(row.ticket_id || "").trim(),
        name: row.name || "",
        phone: row.phone ? String(row.phone) : "",
        checkedIn: false,
        checkedInAt: null,
      }));

      // Check for missing ticket IDs
      const invalidTickets = formattedTickets.filter(
        (ticket) => !ticket.ticket_id
      );

      if (invalidTickets.length > 0) {
        setMessage(
          "Import failed: Some tickets have no ticket_id."
        );

        setSelectedFile(null);
        setShowImportConfirmation(false);
        return;
      }

      // Check for duplicate ticket IDs inside Excel
      const ticketIds = formattedTickets.map(
        (ticket) => ticket.ticket_id
      );

      const uniqueTicketIds = new Set(ticketIds);

      if (uniqueTicketIds.size !== ticketIds.length) {
        setMessage(
          "Import failed: Duplicate ticket_id found in Excel."
        );

        setSelectedFile(null);
        setShowImportConfirmation(false);
        return;
      }

      // Save tickets to IndexedDB.
      // Existing check-in history is preserved
      // by addTickets() in database.js.
      await addTickets(formattedTickets);

      // Reload tickets from IndexedDB
      const storedTickets = await getAllTickets();

      setTickets(storedTickets);

      setMessage(
        `${formattedTickets.length} tickets imported successfully.`
      );

      setSelectedFile(null);
      setShowImportConfirmation(false);
    } catch (error) {
      console.error("Excel import failed:", error);

      setMessage("Failed to import Excel file.");

      setSelectedFile(null);
      setShowImportConfirmation(false);
    }
  };

  // Cancel Excel import
  const cancelExcelImport = () => {
    setSelectedFile(null);
    setShowImportConfirmation(false);
  };

  // Check in ticket
  const handleCheckIn = async () => {
    const id = ticketId.trim();

    if (!id) {
      setResult({
        type: "error",
        message: "Please enter a ticket ID.",
      });

      return;
    }

    try {
      const response = await checkInTicket(id);

      if (response.success) {
        setResult({
          type: "success",
          message: "ENTRY ALLOWED",
          ticket: response.ticket,
        });
      } else if (response.reason === "ALREADY_CHECKED_IN") {
        setResult({
          type: "duplicate",
          message: "ALREADY CHECKED IN",
          ticket: response.ticket,
        });
      } else if (response.reason === "NOT_FOUND") {
        setResult({
          type: "error",
          message: "INVALID TICKET",
        });
      }

      // Refresh ticket list from IndexedDB
      const updatedTickets = await getAllTickets();
      setTickets(updatedTickets);

      // Clear input
      setTicketId("");
    } catch (error) {
      console.error("Check-in failed:", error);

      setResult({
        type: "error",
        message: "Something went wrong while checking in.",
      });
    }
  };

  const checkedInCount = tickets.filter(
    (ticket) => ticket.checkedIn
  ).length;

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial",
        maxWidth: "900px",
        margin: "auto",
      }}
    >
      <h1>Event Check-in</h1>

      {/* Excel Import */}
      <section>
        <h2>1. Import Tickets</h2>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelUpload}
        />

        {/* Import Confirmation */}
        {showImportConfirmation && selectedFile && (
          <div
            style={{
              marginTop: "20px",
              padding: "20px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              maxWidth: "500px",
            }}
          >
            <h3>Import Excel?</h3>

            <p>
              ⚠️ Existing tickets will be updated, but
              check-in history will be preserved.
            </p>

            <p>
              <strong>File:</strong> {selectedFile.name}
            </p>

            <button
              onClick={cancelExcelImport}
              style={{
                marginRight: "10px",
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={confirmExcelImport}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Import
            </button>
          </div>
        )}

        <p>{message}</p>
      </section>

      <hr />

      {/* Check-in */}
      <section>
        <h2>2. Check-in Ticket</h2>

        <input
          type="text"
          placeholder="Enter Ticket ID"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCheckIn();
            }
          }}
        />

        <button
          onClick={handleCheckIn}
          style={{
            marginLeft: "10px",
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          Check In
        </button>
      </section>

      {/* Result */}
      {result && (
        <section style={{ marginTop: "30px" }}>
          {result.type === "success" && (
            <div>
              <h2>✅ ENTRY ALLOWED</h2>

              <p>
                <strong>Name:</strong> {result.ticket.name}
              </p>

              <p>
                <strong>Ticket:</strong>{" "}
                {result.ticket.ticket_id}
              </p>

              <p>
                <strong>Checked in at:</strong>{" "}
                {new Date(
                  result.ticket.checkedInAt
                ).toLocaleString()}
              </p>
            </div>
          )}

          {result.type === "duplicate" && (
            <div>
              <h2>❌ ALREADY CHECKED IN</h2>

              <p>
                <strong>Name:</strong> {result.ticket.name}
              </p>

              <p>
                <strong>Ticket:</strong>{" "}
                {result.ticket.ticket_id}
              </p>

              <p>This ticket has already been used.</p>

              <p>
                <strong>Original check-in:</strong>{" "}
                {new Date(
                  result.ticket.checkedInAt
                ).toLocaleString()}
              </p>
            </div>
          )}

          {result.type === "error" && (
            <div>
              <h2>❌ INVALID TICKET</h2>

              <p>{result.message}</p>
            </div>
          )}
        </section>
      )}

      <hr />

      {/* Counter */}
      <section>
        <h2>Check-in Status</h2>

        <p>
          <strong>
            {checkedInCount} / {tickets.length}
          </strong>{" "}
          tickets checked in
        </p>
      </section>

      <hr />

      {/* Ticket List */}
      <section>
        <h2>Tickets</h2>

        {tickets.length === 0 ? (
          <p>No tickets loaded.</p>
        ) : (
          <table border="1" cellPadding="10">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.ticket_id}>
                  <td>{ticket.ticket_id}</td>
                  <td>{ticket.name}</td>
                  <td>{ticket.phone}</td>
                  <td>
                    {ticket.checkedIn
                      ? "✅ CHECKED IN"
                      : "NOT CHECKED IN"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

export default App;
