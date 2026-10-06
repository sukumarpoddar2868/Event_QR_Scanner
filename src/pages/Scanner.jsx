import { useEffect, useState } from "react";
import QRScanner from "../components/QRScanner";
import {
  checkInTicket,
  getAllTickets,
  addTickets,
} from "../db/database";
import { readExcelFile } from "../utils/excel";

export default function Scanner() {
  const [tickets, setTickets] = useState([]);

  const [scanResult, setScanResult] = useState(null);
  const [scannerKey, setScannerKey] = useState(0);

  const [cameraError, setCameraError] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [showImportConfirmation, setShowImportConfirmation] =
    useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // ----------------------------------------
  // Load tickets from IndexedDB
  // ----------------------------------------

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const storedTickets = await getAllTickets();

        setTickets(storedTickets);
      } catch (error) {
        console.error(
          "Failed to load tickets:",
          error
        );

        setCameraError(
          "Failed to load tickets from local database."
        );
      }
    };

    loadTickets();
  }, []);

  // ----------------------------------------
  // Check-in counter
  // ----------------------------------------

  const checkedInCount = tickets.filter(
    (ticket) => ticket.checkedIn
  ).length;

  const remainingCount =
    tickets.length - checkedInCount;

  // ----------------------------------------
  // Handle QR scan
  // ----------------------------------------

  const handleQRScan = async (ticketId) => {
    setCameraError("");

    const cleanTicketId = ticketId.trim();

    if (!cleanTicketId) {
      setScanResult({
        type: "error",
        title: "INVALID QR CODE",
        message: "The QR code does not contain a ticket ID.",
      });

      return;
    }

    try {
      const result =
        await checkInTicket(cleanTicketId);

      // -------------------------------
      // ENTRY ALLOWED
      // -------------------------------

      if (result.success) {
        setScanResult({
          type: "success",
          title: "ENTRY ALLOWED",
          ticket: result.ticket,
        });

        // Update React state immediately
        setTickets((currentTickets) =>
          currentTickets.map((ticket) =>
            ticket.ticket_id === cleanTicketId
              ? result.ticket
              : ticket
          )
        );

        return;
      }

      // -------------------------------
      // ALREADY CHECKED IN
      // -------------------------------

      if (
        result.reason ===
        "ALREADY_CHECKED_IN"
      ) {
        setScanResult({
          type: "warning",
          title: "ALREADY CHECKED IN",
          ticket: result.ticket,
        });

        return;
      }

      // -------------------------------
      // INVALID TICKET
      // -------------------------------

      if (
        result.reason === "NOT_FOUND"
      ) {
        setScanResult({
          type: "error",
          title: "INVALID TICKET",
          ticket: {
            ticket_id: cleanTicketId,
          },
          message:
            "This ticket was not found in the imported ticket list.",
        });

        return;
      }

      // -------------------------------
      // UNKNOWN RESULT
      // -------------------------------

      setScanResult({
        type: "error",
        title: "CHECK-IN FAILED",
        message:
          "Unable to process this ticket.",
      });
    } catch (error) {
      console.error(
        "Check-in error:",
        error
      );

      setScanResult({
        type: "error",
        title: "SCAN ERROR",
        message:
          "Something went wrong while checking this ticket.",
      });
    }
  };

  // ----------------------------------------
  // Camera error
  // ----------------------------------------

  const handleScannerError = (message) => {
    setCameraError(message);
  };

  // ----------------------------------------
  // Scan next ticket
  // ----------------------------------------

  const handleScanNext = () => {
    setScanResult(null);
    setCameraError("");

    // Force QRScanner to mount again
    setScannerKey(
      (currentKey) => currentKey + 1
    );
  };

  // ----------------------------------------
  // Select Excel file
  // ----------------------------------------

  async function handleExcelSelect(event) {
    const file = event.target.files[0];

    // Allow selecting the same file again
    event.target.value = "";

    if (!file) {
      return;
    }

    setCameraError("");

    try {
      const rows =
        await readExcelFile(file);

      // ------------------------------------
      // Empty file
      // ------------------------------------

      if (rows.length === 0) {
        setCameraError(
          "The Excel file is empty."
        );

        return;
      }

      // ------------------------------------
      // Convert Excel rows
      // ------------------------------------

      const importedTickets =
        rows.map((row) => ({
          sl_no: Number(row.sl_no),
          ticket_id: String(
            row.ticket_id || ""
          ).trim(),
          name: String(
            row.name || ""
          ).trim(),
          number: String(
            row.number ||
              row.phone ||
              ""
          ).trim(),
        }));

      // ------------------------------------
      // Validate rows
      // ------------------------------------

      const invalidRowIndex =
        importedTickets.findIndex(
          (ticket) =>
            !ticket.ticket_id ||
            !ticket.name ||
            !ticket.number
        );

      if (invalidRowIndex !== -1) {
        setCameraError(
          `Incomplete ticket information found in Excel row ${
            invalidRowIndex + 2
          }.`
        );

        return;
      }

      // ------------------------------------
      // Check duplicate IDs inside Excel
      // ------------------------------------

      const uploadedIds =
        importedTickets.map(
          (ticket) =>
            ticket.ticket_id.toLowerCase()
        );

      if (
        new Set(uploadedIds).size !==
        uploadedIds.length
      ) {
        setCameraError(
          "Duplicate ticket IDs were found inside the Excel file."
        );

        return;
      }

      // ------------------------------------
      // Find existing tickets
      // ------------------------------------

      const existingIds =
        new Set(
          tickets.map((ticket) =>
            ticket.ticket_id.toLowerCase()
          )
        );

      const newTickets =
        importedTickets.filter(
          (ticket) =>
            !existingIds.has(
              ticket.ticket_id.toLowerCase()
            )
        );

      const existingTickets =
        importedTickets.filter(
          (ticket) =>
            existingIds.has(
              ticket.ticket_id.toLowerCase()
            )
        );

      // ------------------------------------
      // Prepare confirmation
      // ------------------------------------

      setSelectedFile(file);

      setImportPreview({
        total: importedTickets.length,
        newTickets,
        existingTickets,
      });

      setShowImportConfirmation(true);
    } catch (error) {
      console.error(
        "Excel import error:",
        error
      );

      setCameraError(
        "Failed to read the Excel file."
      );
    }
  }

  // ----------------------------------------
  // Confirm Excel import
  // ----------------------------------------

  async function handleConfirmImport() {
    if (!importPreview) {
      return;
    }

    const {
      newTickets,
      existingTickets,
    } = importPreview;

    if (newTickets.length === 0) {
      setCameraError(
        "All tickets in this Excel file already exist."
      );

      handleCancelImport();

      return;
    }

    setIsImporting(true);
    setCameraError("");

    try {
      // Store tickets in IndexedDB
      await addTickets(newTickets);

      // Reload database
      const updatedTickets =
        await getAllTickets();

      setTickets(updatedTickets);

      // Close modal
      setSelectedFile(null);
      setImportPreview(null);
      setShowImportConfirmation(false);

      if (existingTickets.length > 0) {
        setCameraError(
          `${newTickets.length} new tickets imported. ${existingTickets.length} existing tickets skipped.`
        );
      }
    } catch (error) {
      console.error(
        "Failed to import tickets:",
        error
      );

      setCameraError(
        "Failed to import tickets into the local database."
      );
    } finally {
      setIsImporting(false);
    }
  }

  // ----------------------------------------
  // Cancel Excel import
  // ----------------------------------------

  function handleCancelImport() {
    setSelectedFile(null);
    setImportPreview(null);
    setShowImportConfirmation(false);
  }

  // ----------------------------------------
  // Clear scanner database
  // ----------------------------------------

  async function handleClearTickets() {
    const confirmed =
      window.confirm(
        "Are you sure you want to remove all tickets from this scanner device?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const db = await import(
        "../db/database"
      );

      // Open database
      const database =
        await db.dbPromise;

      const transaction =
        database.transaction(
          "tickets",
          "readwrite"
        );

      await transaction
        .objectStore("tickets")
        .clear();

      await transaction.done;

      setTickets([]);
      setScanResult(null);

      setCameraError(
        "All tickets were removed from this scanner device."
      );
    } catch (error) {
      console.error(
        "Failed to clear tickets:",
        error
      );

      setCameraError(
        "Failed to clear scanner data."
      );
    }
  }

  return (
    <main className="app-shell">

      {/* =================================
          HEADER
      ================================== */}

      <header className="topbar">

        <div>
          <div className="card-kicker">
            EVENT CHECK-IN
          </div>

          <h1>
            Ticket Scanner
          </h1>

          <p>
            Scan attendee QR codes and manage
            event entry.
          </p>
        </div>

        <div className="topbar-actions">

          <a
            href="/"
            className="btn btn-secondary"
          >
            Ticket Generator
          </a>

        </div>

      </header>

      {/* =================================
          MESSAGE
      ================================== */}

      {cameraError && (
        <div className="message error">
          {cameraError}
        </div>
      )}

      {/* =================================
          CHECK-IN STATUS
      ================================== */}

      <section className="progress-card card">

        <div>

          <div className="card-kicker">
            CHECK-IN STATUS
          </div>

          <h2>
            {checkedInCount} /{" "}
            {tickets.length}
          </h2>

          <p>
            {tickets.length === 0
              ? "No tickets have been imported yet."
              : "Tickets checked in on this scanner device."}
          </p>

        </div>

        <div className="progress-next">

          <span>
            Remaining
          </span>

          <strong>
            {remainingCount}
          </strong>

        </div>

      </section>

      {/* =================================
          IMPORT MASTER EXCEL
      ================================== */}

      <section className="card bulk-card">

        <div className="card-header">

          <div>

            <div className="card-kicker">
              TICKET DATABASE
            </div>

            <h2>
              Import Master Excel
            </h2>

            <p>
              Load the master ticket file before
              starting the event.
            </p>

          </div>

        </div>

        <div className="upload-box">

          <div className="upload-icon">
            XLSX
          </div>

          <h3>
            Import Event Tickets
          </h3>

          <p>
            Use the Excel file created by the
            Ticket Generator.
          </p>

          <label className="upload-button">

            Choose Excel File

            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={
                handleExcelSelect
              }
            />

          </label>

        </div>

        {tickets.length > 0 && (
          <div className="bulk-note">
            <strong>
              {tickets.length}
            </strong>{" "}
            tickets currently loaded on this
            scanner.
          </div>
        )}

      </section>

      {/* =================================
          SCANNER
      ================================== */}

      <section className="card scanner-card">

        <div className="card-header">

          <div>

            <div className="card-kicker">
              LIVE SCANNER
            </div>

            <h2>
              Scan Ticket
            </h2>

          </div>

        </div>

        {/* No tickets */}

        {tickets.length === 0 ? (

          <div className="empty-state">

            <div className="upload-icon">
              !
            </div>

            <h3>
              No tickets loaded
            </h3>

            <p>
              Import the master Excel file
              before scanning tickets.
            </p>

          </div>

        ) : !scanResult ? (

          /* Scanner */

          <QRScanner
            key={scannerKey}
            onScan={handleQRScan}
            onError={
              handleScannerError
            }
          />

        ) : (

          /* Scan result */

          <div
            className={`scan-result ${scanResult.type}`}
          >

            <div className="scan-result-icon">

              {scanResult.type ===
                "success" && "✓"}

              {scanResult.type ===
                "warning" && "!"}

              {scanResult.type ===
                "error" && "×"}

            </div>

            <h2>
              {scanResult.title}
            </h2>

            {scanResult.ticket && (
              <div className="scan-ticket-info">

                <p>
                  <strong>
                    Ticket ID:
                  </strong>{" "}
                  {
                    scanResult.ticket
                      .ticket_id
                  }
                </p>

                {scanResult.ticket.name && (
                  <p>
                    <strong>
                      Name:
                    </strong>{" "}
                    {
                      scanResult.ticket
                        .name
                    }
                  </p>
                )}

                {scanResult.ticket.number && (
                  <p>
                    <strong>
                      Number:
                    </strong>{" "}
                    {
                      scanResult.ticket
                        .number
                    }
                  </p>
                )}

                {scanResult.ticket
                  .checkedInAt && (
                  <p>
                    <strong>
                      Checked in:
                    </strong>{" "}
                    {new Date(
                      scanResult.ticket
                        .checkedInAt
                    ).toLocaleTimeString()}
                  </p>
                )}

              </div>
            )}

            {scanResult.message && (
              <p className="scan-result-message">
                {scanResult.message}
              </p>
            )}

            <button
              className="btn btn-primary btn-full"
              onClick={
                handleScanNext
              }
            >
              Scan Next Ticket
            </button>

          </div>

        )}

      </section>

      {/* =================================
          DATABASE ACTIONS
      ================================== */}

      {tickets.length > 0 && (
        <section className="card scanner-actions-card">

          <div className="card-header">

            <div>
              <div className="card-kicker">
                SCANNER DATA
              </div>

              <h2>
                Local Ticket Database
              </h2>

              <p>
                Ticket and check-in data is stored
                locally on this device.
              </p>
            </div>

          </div>

          <button
            className="btn btn-danger"
            onClick={
              handleClearTickets
            }
          >
            Clear Scanner Database
          </button>

        </section>
      )}

      {/* =================================
          IMPORT CONFIRMATION MODAL
      ================================== */}

      {showImportConfirmation &&
        importPreview && (
          <div className="modal-overlay">

            <div className="modal">

              <div className="modal-header">

                <div>

                  <div className="card-kicker">
                    IMPORT CONFIRMATION
                  </div>

                  <h2>
                    Import Tickets?
                  </h2>

                </div>

                <button
                  className="modal-close"
                  onClick={
                    handleCancelImport
                  }
                  disabled={isImporting}
                >
                  ×
                </button>

              </div>

              <div className="modal-file">

                <strong>
                  {selectedFile?.name}
                </strong>

              </div>

              <div className="import-stats">

                <div className="import-stat">

                  <span>
                    Total Rows
                  </span>

                  <strong>
                    {importPreview.total}
                  </strong>

                </div>

                <div className="import-stat">

                  <span>
                    New Tickets
                  </span>

                  <strong>
                    {
                      importPreview
                        .newTickets
                        .length
                    }
                  </strong>

                </div>

                <div className="import-stat">

                  <span>
                    Existing
                  </span>

                  <strong>
                    {
                      importPreview
                        .existingTickets
                        .length
                    }
                  </strong>

                </div>

              </div>

              {importPreview
                .existingTickets
                .length > 0 && (
                <div className="modal-warning">

                  {
                    importPreview
                      .existingTickets
                      .length
                  }{" "}
                  ticket IDs already exist on
                  this scanner and will be skipped.

                </div>
              )}

              <div className="modal-actions">

                <button
                  className="btn btn-secondary"
                  onClick={
                    handleCancelImport
                  }
                  disabled={isImporting}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  onClick={
                    handleConfirmImport
                  }
                  disabled={
                    isImporting ||
                    importPreview
                      .newTickets
                      .length === 0
                  }
                >
                  {isImporting
                    ? "Importing..."
                    : "Import Tickets"}
                </button>

              </div>

            </div>

          </div>
        )}

    </main>
  );
}
