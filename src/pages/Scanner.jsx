
import { useCallback, useEffect, useState } from "react";

import QRScanner from "../components/QRScanner";

import {
  addTickets,
  checkInTicket,
  clearTickets,
  getAllTickets,
} from "../db/database";

import { readExcelFile } from "../utils/excel";

import {
  enableScannerSound,
  playSuccessSound,
  playWarningSound,
  playErrorSound,
} from "../utils/sound";

export default function Scanner() {
  const [tickets, setTickets] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [error, setError] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [showImportConfirmation, setShowImportConfirmation] =
    useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load tickets from IndexedDB
  useEffect(() => {
    async function load() {
      try {
        const stored = await getAllTickets();
        setTickets(stored);
      } catch (err) {
        console.error(err);
        setError("Failed to load scanner database.");
      }
    }

    load();
  }, []);

  // Enable audio after the user interacts with the page
  useEffect(() => {
    function handleUserInteraction() {
      enableScannerSound();
    }

    window.addEventListener("click", handleUserInteraction, {
      once: true,
    });

    window.addEventListener("touchstart", handleUserInteraction, {
      once: true,
    });

    return () => {
      window.removeEventListener(
        "click",
        handleUserInteraction
      );

      window.removeEventListener(
        "touchstart",
        handleUserInteraction
      );
    };
  }, []);

  const checkedInCount = tickets.filter(
    (ticket) => ticket.checkedIn
  ).length;

  const remainingCount =
    tickets.length - checkedInCount;

  // =========================
  // QR SCAN
  // =========================

  const handleQRScan = useCallback(async (ticketId) => {
    setError("");

    const cleanId = String(ticketId)
      .trim()
      .toUpperCase();

    if (!cleanId) {
      playErrorSound();

      setScanResult({
        type: "error",
        title: "INVALID QR CODE",
        message:
          "The QR code does not contain a ticket ID.",
      });

      return;
    }

    try {
      const result = await checkInTicket(cleanId);

      // =========================
      // VALID TICKET
      // =========================

      if (result.success) {
        playSuccessSound();

        setScanResult({
          type: "success",
          title: "ENTRY ALLOWED",
          ticket: result.ticket,
        });

        setTickets((current) =>
          current.map((ticket) =>
            ticket.ticket_id === cleanId
              ? result.ticket
              : ticket
          )
        );

        return;
      }

      // =========================
      // ALREADY CHECKED IN
      // =========================

      if (result.reason === "ALREADY_CHECKED_IN") {
        playWarningSound();

        setScanResult({
          type: "warning",
          title: "ALREADY CHECKED IN",
          ticket: result.ticket,
        });

        return;
      }

      // =========================
      // INVALID TICKET
      // =========================

      if (result.reason === "NOT_FOUND") {
        playErrorSound();

        setScanResult({
          type: "error",
          title: "INVALID TICKET",
          ticket: {
            ticket_id: cleanId,
          },
          message:
            "This ticket was not found in the scanner database.",
        });

        return;
      }

      // =========================
      // OTHER FAILURE
      // =========================

      playErrorSound();

      setScanResult({
        type: "error",
        title: "CHECK-IN FAILED",
        message:
          "Unable to process this ticket.",
      });
    } catch (err) {
      console.error(err);

      playErrorSound();

      setScanResult({
        type: "error",
        title: "SCAN ERROR",
        message:
          "Something went wrong while checking this ticket.",
      });
    }
  }, []);

  const handleScannerError = useCallback((message) => {
    setError(message);
  }, []);

  function scanNext() {
    setScanResult(null);
    setError("");

    setScannerKey((current) => current + 1);
  }

  // =========================
  // EXCEL IMPORT
  // =========================

  async function handleExcelSelect(event) {
    const file = event.target.files[0];

    // Allow selecting the same file again
    event.target.value = "";

    if (!file) return;

    setError("");

    try {
      const rows = await readExcelFile(file);

      if (rows.length === 0) {
        setError("The Excel file is empty.");
        return;
      }

      const importedTickets = rows.map((row) => ({
        sl_no: Number(row.sl_no),

        ticket_id: String(row.ticket_id || "")
          .trim()
          .toUpperCase(),

        name: String(row.name || "").trim(),

        number: String(
          row.number || row.phone || ""
        ).trim(),
      }));

      // Validate required fields
      const invalidIndex = importedTickets.findIndex(
        (ticket) =>
          !ticket.ticket_id ||
          !ticket.name ||
          !ticket.number
      );

      if (invalidIndex !== -1) {
        setError(
          `Incomplete ticket information found in Excel row ${
            invalidIndex + 2
          }.`
        );

        return;
      }

      // Check duplicate IDs inside Excel
      const ids = importedTickets.map(
        (ticket) => ticket.ticket_id
      );

      if (new Set(ids).size !== ids.length) {
        setError(
          "Duplicate ticket IDs were found inside the Excel file."
        );

        return;
      }

      // Find which tickets already exist locally
      const existingIds = new Set(
        tickets.map((ticket) => ticket.ticket_id)
      );

      const newTickets = importedTickets.filter(
        (ticket) => !existingIds.has(ticket.ticket_id)
      );

      const existingTickets = importedTickets.filter(
        (ticket) => existingIds.has(ticket.ticket_id)
      );

      setSelectedFile(file);

      setImportPreview({
        total: importedTickets.length,
        importedTickets,
        newTickets,
        existingTickets,
      });

      setShowImportConfirmation(true);
    } catch (err) {
      console.error(err);

      setError("Failed to read the Excel file.");
    }
  }

  async function confirmImport() {
    if (!importPreview) return;

    setIsImporting(true);
    setError("");

    try {
      /*
       * IMPORTANT:
       *
       * We import ALL tickets, not only new tickets.
       *
       * database.js preserves checkedIn and checkedInAt
       * for existing ticket IDs.
       *
       * Therefore:
       *
       * Same ticket_id  -> update ticket information,
       *                     preserve check-in state.
       *
       * New ticket_id   -> create new unchecked ticket.
       */
      await addTickets(
        importPreview.importedTickets
      );

      const updated = await getAllTickets();

      setTickets(updated);

      const newCount =
        importPreview.newTickets.length;

      const existingCount =
        importPreview.existingTickets.length;

      cancelImport();

      setError(
        `${newCount} new tickets added. ${existingCount} existing tickets updated. Checked-in status was preserved.`
      );
    } catch (err) {
      console.error(err);

      setError(
        "Failed to import tickets into the scanner database."
      );
    } finally {
      setIsImporting(false);
    }
  }

  function cancelImport() {
    setSelectedFile(null);
    setImportPreview(null);
    setShowImportConfirmation(false);
  }

  // =========================
  // CLEAR DATABASE
  // =========================

  async function handleClearTickets() {
    const confirmed = window.confirm(
      "Are you sure you want to remove all tickets from this scanner device?"
    );

    if (!confirmed) return;

    try {
      await clearTickets();

      setTickets([]);
      setScanResult(null);

      setError(
        "All tickets were removed from this scanner."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Failed to clear scanner database."
      );
    }
  }

  // =========================
  // RENDER
  // =========================

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            EVENT CHECK-IN
          </div>

          <h1>Ticket Scanner</h1>

          <p>
            Scan attendee QR codes and manage event
            entry.
          </p>
        </div>

        <a
          href="/"
          className="button secondary"
        >
          Ticket Generator
        </a>
      </header>

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {/* =========================
          CHECK-IN SUMMARY
      ========================= */}

      <section className="progress-panel scanner-progress">
        <div>
          <div className="eyebrow">
            CHECK-IN STATUS
          </div>

          <h2>
            {checkedInCount} / {tickets.length}
          </h2>

          <p>
            Tickets checked in on this scanner
            device.
          </p>
        </div>

        <div className="next-ticket">
          <span>Remaining</span>

          <strong>{remainingCount}</strong>
        </div>
      </section>

      {/* =========================
          EXCEL IMPORT
      ========================= */}

      <section className="card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              TICKET DATABASE
            </div>

            <h2>Import Master Excel</h2>

            <p>
              Upload the same ticket Excel file
              whenever you need to add or update
              tickets.
            </p>
          </div>
        </div>

        <div className="upload-area">
          <div className="upload-icon">
            XLSX
          </div>

          <h3>Import Event Tickets</h3>

          <p>
            Required columns:
            <br />
            <strong>
              sl_no, ticket_id, name, number
            </strong>
          </p>

          <label className="button secondary">
            Choose Excel File

            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={handleExcelSelect}
            />
          </label>
        </div>

        {tickets.length > 0 && (
          <div className="loaded-info">
            <strong>{tickets.length}</strong>{" "}
            tickets currently loaded on this
            scanner.
          </div>
        )}
      </section>

      {/* =========================
          LIVE SCANNER
      ========================= */}

      <section className="card scanner-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              LIVE SCANNER
            </div>

            <h2>Scan Ticket</h2>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              !
            </div>

            <h3>No tickets loaded</h3>

            <p>
              Import the master Excel file before
              scanning tickets.
            </p>
          </div>
        ) : !scanResult ? (
          <QRScanner
            key={scannerKey}
            onScan={handleQRScan}
            onError={handleScannerError}
          />
        ) : (
          <div
            className={`scan-result ${scanResult.type}`}
          >
            <div className="scan-icon">
              {scanResult.type === "success" &&
                "✓"}

              {scanResult.type === "warning" &&
                "!"}

              {scanResult.type === "error" &&
                "×"}
            </div>

            <h2>{scanResult.title}</h2>

            {scanResult.ticket && (
              <div className="scan-ticket-info">
                <p>
                  <strong>Ticket ID:</strong>{" "}
                  {scanResult.ticket.ticket_id}
                </p>

                {scanResult.ticket.name && (
                  <p>
                    <strong>Name:</strong>{" "}
                    {scanResult.ticket.name}
                  </p>
                )}

                {scanResult.ticket.number && (
                  <p>
                    <strong>Number:</strong>{" "}
                    {scanResult.ticket.number}
                  </p>
                )}
              </div>
            )}

            {scanResult.message && (
              <p className="scan-message">
                {scanResult.message}
              </p>
            )}

            <button
              className="button primary full"
              onClick={scanNext}
            >
              Scan Next Ticket
            </button>
          </div>
        )}
      </section>

      {/* =========================
          LIVE TICKET TABLE
      ========================= */}

      {tickets.length > 0 && (
        <section className="card ticket-status-card">
          <div className="table-heading">
            <div>
              <div className="eyebrow">
                LIVE TICKET STATUS
              </div>

              <h2>Ticket Check-in List</h2>

              <p>
                Check-in status updates automatically
                after every scan.
              </p>
            </div>

            <strong>
              {checkedInCount}/{tickets.length}
            </strong>
          </div>

          <div className="table-scroll">
            <table className="ticket-status-table">
              <thead>
                <tr>
                  <th>SL No.</th>
                  <th>Ticket ID</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticket_id}>
                    <td>{ticket.sl_no}</td>

                    <td>
                      <strong>
                        {ticket.ticket_id}
                      </strong>
                    </td>

                    <td>{ticket.name}</td>

                    <td>
                      {ticket.checkedIn ? (
                        <span className="status-badge checked">
                          <span className="status-icon">
                            ✓
                          </span>
                          Checked
                        </span>
                      ) : (
                        <span className="status-badge unchecked">
                          <span className="status-icon">
                            ○
                          </span>
                          Not Checked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =========================
          CLEAR DATABASE
      ========================= */}

      {tickets.length > 0 && (
        <section className="card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                SCANNER DATA
              </div>

              <h2>Local Ticket Database</h2>

              <p>
                Ticket and check-in data is stored
                locally on this device.
              </p>
            </div>
          </div>

          <button
            className="button danger"
            onClick={handleClearTickets}
          >
            Clear Scanner Database
          </button>
        </section>
      )}

      {/* =========================
          IMPORT CONFIRMATION
      ========================= */}

      {showImportConfirmation &&
        importPreview && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-top">
                <div>
                  <div className="eyebrow">
                    IMPORT CONFIRMATION
                  </div>

                  <h2>Import Tickets?</h2>
                </div>

                <button
                  className="modal-close"
                  onClick={cancelImport}
                  disabled={isImporting}
                >
                  ×
                </button>
              </div>

              <p className="file-name">
                {selectedFile?.name}
              </p>

              <div className="stats">
                <div>
                  <span>Total</span>

                  <strong>
                    {importPreview.total}
                  </strong>
                </div>

                <div>
                  <span>New</span>

                  <strong>
                    {
                      importPreview.newTickets
                        .length
                    }
                  </strong>
                </div>

                <div>
                  <span>Existing</span>

                  <strong>
                    {
                      importPreview
                        .existingTickets.length
                    }
                  </strong>
                </div>
              </div>

              {importPreview.existingTickets
                .length > 0 && (
                <div className="warning-box">
                  Existing ticket IDs will be
                  updated with the new Excel
                  information. Their checked-in
                  status will be preserved.
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="button secondary"
                  onClick={cancelImport}
                  disabled={isImporting}
                >
                  Cancel
                </button>

                <button
                  className="button primary"
                  onClick={confirmImport}
                  disabled={isImporting}
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

