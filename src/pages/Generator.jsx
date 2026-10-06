import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { readExcelFile, downloadExcel } from "../utils/excel";

const STORAGE_KEY = "event-ticket-generator";

function loadTickets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getNextSlNo(tickets) {
  if (tickets.length === 0) return 1;

  return (
    Math.max(
      ...tickets.map((ticket) =>
        Number(ticket.sl_no) || 0
      )
    ) + 1
  );
}

function getNextTicketId(tickets) {
  if (tickets.length === 0) {
    return "EVT001";
  }

  const numbers = tickets
    .map((ticket) => {
      const match =
        String(ticket.ticket_id).match(
          /(\d+)$/
        );

      return match ? Number(match[1]) : 0;
    })
    .filter(Boolean);

  const nextNumber =
    numbers.length > 0
      ? Math.max(...numbers) + 1
      : tickets.length + 1;

  return `EVT${String(nextNumber).padStart(3, "0")}`;
}

export default function Generator() {
  const [tickets, setTickets] = useState(loadTickets);

  const [slNo, setSlNo] = useState(1);
  const [ticketId, setTicketId] = useState("EVT001");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");

  const [selectedTicket, setSelectedTicket] =
    useState(null);

  const [qrDataUrl, setQrDataUrl] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("success");

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [isDownloading, setIsDownloading] =
    useState(false);

  const [selectedExcelFile, setSelectedExcelFile] =
    useState(null);

  const [bulkPreview, setBulkPreview] =
    useState(null);

  const [
    showBulkConfirmation,
    setShowBulkConfirmation,
  ] = useState(false);

  const [isImporting, setIsImporting] =
    useState(false);

  const totalTickets = tickets.length;

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(tickets)
    );

    setSlNo(getNextSlNo(tickets));
    setTicketId(getNextTicketId(tickets));
  }, [tickets]);

  const progressText = useMemo(() => {
    if (totalTickets === 0) {
      return "No tickets created yet.";
    }

    return `${totalTickets} ticket${
      totalTickets === 1 ? "" : "s"
    } created`;
  }, [totalTickets]);

  async function generateQR(ticket) {
    return QRCode.toDataURL(ticket.ticket_id, {
      width: 500,
      margin: 2,
      errorCorrectionLevel: "H",
    });
  }

  async function handleCreateTicket(event) {
    event.preventDefault();

    setMessage("");

    const cleanTicketId =
      ticketId.trim().toUpperCase();

    const cleanName = name.trim();
    const cleanNumber = number.trim();

    if (!cleanTicketId || !cleanName || !cleanNumber) {
      setMessageType("error");
      setMessage(
        "Please fill in all ticket fields."
      );
      return;
    }

    const exists = tickets.some(
      (ticket) =>
        ticket.ticket_id.toLowerCase() ===
        cleanTicketId.toLowerCase()
    );

    if (exists) {
      setMessageType("error");
      setMessage(
        `Ticket ID ${cleanTicketId} already exists.`
      );
      return;
    }

    const ticket = {
      sl_no: Number(slNo),
      ticket_id: cleanTicketId,
      name: cleanName,
      number: cleanNumber,
    };

    setIsGenerating(true);

    try {
      const qr = await generateQR(ticket);

      setTickets((current) => [
        ...current,
        ticket,
      ]);

      setSelectedTicket(ticket);
      setQrDataUrl(qr);

      setName("");
      setNumber("");

      setMessageType("success");
      setMessage(
        `Ticket ${cleanTicketId} created successfully.`
      );
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        "Failed to generate the QR code."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSelectTicket(ticket) {
    try {
      const qr = await generateQR(ticket);

      setSelectedTicket(ticket);
      setQrDataUrl(qr);
      setMessage("");
    } catch {
      setMessageType("error");
      setMessage(
        "Failed to generate the QR preview."
      );
    }
  }

  function downloadQR() {
    if (!selectedTicket || !qrDataUrl) return;

    const link = document.createElement("a");

    link.href = qrDataUrl;
    link.download = `${selectedTicket.ticket_id}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function downloadMasterExcel() {
    if (tickets.length === 0) {
      setMessageType("error");
      setMessage("There are no tickets to export.");
      return;
    }

    downloadExcel(
      tickets,
      "event-master-tickets.xlsx"
    );

    setMessageType("success");
    setMessage(
      "Master Excel downloaded successfully."
    );
  }

  async function downloadAllQRs() {
    if (tickets.length === 0) {
      setMessageType("error");
      setMessage("There are no tickets to export.");
      return;
    }

    setIsDownloading(true);
    setMessage("");

    try {
      const zip = new JSZip();

      for (const ticket of tickets) {
        const dataUrl = await generateQR(ticket);

        const base64 = dataUrl.split(",")[1];

        zip.file(
          `${ticket.ticket_id}.png`,
          base64,
          {
            base64: true,
          }
        );
      }

      const blob = await zip.generateAsync({
        type: "blob",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = "event-qr-codes.zip";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setMessageType("success");
      setMessage(
        "All QR codes downloaded successfully."
      );
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        "Failed to create the QR ZIP file."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleExcelSelect(event) {
    const file = event.target.files[0];

    event.target.value = "";

    if (!file) return;

    setMessage("");

    try {
      const rows = await readExcelFile(file);

      if (rows.length === 0) {
        setMessageType("error");
        setMessage("The Excel file is empty.");
        return;
      }

      const importedTickets = rows.map((row) => ({
        sl_no: Number(row.sl_no),
        ticket_id: String(
          row.ticket_id || ""
        )
          .trim()
          .toUpperCase(),
        name: String(row.name || "").trim(),
        number: String(
          row.number || row.phone || ""
        ).trim(),
      }));

      const invalidIndex =
        importedTickets.findIndex(
          (ticket) =>
            !ticket.ticket_id ||
            !ticket.name ||
            !ticket.number
        );

      if (invalidIndex !== -1) {
        setMessageType("error");
        setMessage(
          `Incomplete ticket information found in Excel row ${
            invalidIndex + 2
          }.`
        );
        return;
      }

      const uploadedIds =
        importedTickets.map((ticket) =>
          ticket.ticket_id.toLowerCase()
        );

      if (
        new Set(uploadedIds).size !==
        uploadedIds.length
      ) {
        setMessageType("error");
        setMessage(
          "Duplicate ticket IDs were found inside the Excel file."
        );
        return;
      }

      const existingIds = new Set(
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
        importedTickets.filter((ticket) =>
          existingIds.has(
            ticket.ticket_id.toLowerCase()
          )
        );

      setSelectedExcelFile(file);

      setBulkPreview({
        total: importedTickets.length,
        newTickets,
        existingTickets,
      });

      setShowBulkConfirmation(true);
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        "Failed to read the Excel file."
      );
    }
  }

  async function handleConfirmImport() {
    if (!bulkPreview) return;

    if (bulkPreview.newTickets.length === 0) {
      setShowBulkConfirmation(false);
      setSelectedExcelFile(null);
      setBulkPreview(null);

      setMessageType("error");
      setMessage(
        "All tickets in this Excel file already exist."
      );

      return;
    }

    setIsImporting(true);

    try {
      const newTickets =
        bulkPreview.newTickets;

      setTickets((current) => [
        ...current,
        ...newTickets,
      ]);

      const firstTicket = newTickets[0];

      const qr = await generateQR(firstTicket);

      setSelectedTicket(firstTicket);
      setQrDataUrl(qr);

      setShowBulkConfirmation(false);
      setSelectedExcelFile(null);
      setBulkPreview(null);

      setMessageType("success");

      if (
        bulkPreview.existingTickets.length > 0
      ) {
        setMessage(
          `${newTickets.length} new tickets imported. ${bulkPreview.existingTickets.length} existing tickets skipped.`
        );
      } else {
        setMessage(
          `${newTickets.length} tickets imported successfully.`
        );
      }
    } catch (error) {
      console.error(error);

      setMessageType("error");
      setMessage(
        "Failed to import tickets."
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleCancelImport() {
    setSelectedExcelFile(null);
    setBulkPreview(null);
    setShowBulkConfirmation(false);
  }

  function clearAllTickets() {
    const confirmed = window.confirm(
      "Are you sure you want to delete all generated tickets?"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);

    setTickets([]);
    setSelectedTicket(null);
    setQrDataUrl("");

    setMessageType("success");
    setMessage("All tickets have been deleted.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            EVENT QR SYSTEM
          </div>

          <h1>Ticket Generator</h1>

          <p>
            Create event tickets and generate QR
            codes for attendee check-in.
          </p>
        </div>

        <a
          href="/scanner"
          className="button secondary"
        >
          Open Scanner
        </a>
      </header>

      {message && (
        <div className={`alert ${messageType}`}>
          {message}
        </div>
      )}

      <section className="progress-panel">
        <div>
          <div className="eyebrow">
            GENERATOR PROGRESS
          </div>

          <h2>{progressText}</h2>

          <p>
            Your progress is saved automatically
            in this browser.
          </p>
        </div>

        <div className="next-ticket">
          <span>Next SL No.</span>
          <strong>{slNo}</strong>

          <span>Next Ticket ID</span>
          <strong>{ticketId}</strong>
        </div>
      </section>

      <section className="two-column">
        <div className="card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                SINGLE TICKET
              </div>

              <h2>Create Ticket</h2>
            </div>
          </div>

          <form
            onSubmit={handleCreateTicket}
            className="ticket-form"
          >
            <label>
              SL No.
              <input
                type="number"
                value={slNo}
                onChange={(e) =>
                  setSlNo(e.target.value)
                }
                min="1"
              />
            </label>

            <label>
              Ticket ID
              <input
                value={ticketId}
                onChange={(e) =>
                  setTicketId(e.target.value)
                }
                placeholder="EVT001"
              />
            </label>

            <label>
              Attendee Name
              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Rahul Kumar"
              />
            </label>

            <label>
              Mobile Number
              <input
                value={number}
                onChange={(e) =>
                  setNumber(e.target.value)
                }
                placeholder="9876543210"
              />
            </label>

            <button
              type="submit"
              className="button primary full"
              disabled={isGenerating}
            >
              {isGenerating
                ? "Generating..."
                : "Create Ticket & QR"}
            </button>
          </form>
        </div>

        <div className="card qr-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                QR PREVIEW
              </div>

              <h2>Ticket QR</h2>
            </div>
          </div>

          {selectedTicket && qrDataUrl ? (
            <div className="qr-preview">
              <img
                src={qrDataUrl}
                alt={`QR code for ${selectedTicket.ticket_id}`}
              />

              <div className="qr-ticket">
                <strong>
                  {selectedTicket.ticket_id}
                </strong>

                <span>
                  {selectedTicket.name}
                </span>

                <span>
                  {selectedTicket.number}
                </span>
              </div>

              <button
                className="button primary full"
                onClick={downloadQR}
              >
                Download QR
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                QR
              </div>

              <h3>No QR selected</h3>

              <p>
                Create a ticket or select one from
                the table below.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              BULK IMPORT
            </div>

            <h2>Import Tickets from Excel</h2>

            <p>
              Excel columns: sl_no, ticket_id,
              name, number
            </p>
          </div>
        </div>

        <div className="upload-area">
          <div className="upload-icon">
            XLSX
          </div>

          <h3>Import Event Tickets</h3>

          <p>
            Upload your Excel ticket list.
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
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              EXPORT & DATA
            </div>

            <h2>Ticket Database</h2>

            <p>
              {tickets.length} ticket
              {tickets.length === 1 ? "" : "s"}{" "}
              currently stored.
            </p>
          </div>
        </div>

        <div className="action-row">
          <button
            className="button secondary"
            onClick={downloadMasterExcel}
          >
            Download Master Excel
          </button>

          <button
            className="button secondary"
            onClick={downloadAllQRs}
            disabled={
              isDownloading ||
              tickets.length === 0
            }
          >
            {isDownloading
              ? "Creating ZIP..."
              : "Download All QR Codes"}
          </button>

          <button
            className="button danger"
            onClick={clearAllTickets}
            disabled={tickets.length === 0}
          >
            Clear All
          </button>
        </div>
      </section>

      <section className="card">
        <div className="table-heading">
          <div>
            <div className="eyebrow">
              TICKETS
            </div>

            <h2>Generated Tickets</h2>
          </div>

          <strong>{tickets.length}</strong>
        </div>

        {tickets.length === 0 ? (
          <div className="empty-table">
            No tickets have been created yet.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SL No.</th>
                  <th>Ticket ID</th>
                  <th>Name</th>
                  <th>Number</th>
                  <th>QR</th>
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

                    <td>{ticket.number}</td>

                    <td>
                      <button
                        className="table-button"
                        onClick={() =>
                          handleSelectTicket(
                            ticket
                          )
                        }
                      >
                        View QR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showBulkConfirmation &&
        bulkPreview && (
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
                  onClick={handleCancelImport}
                  disabled={isImporting}
                >
                  ×
                </button>
              </div>

              <p className="file-name">
                {selectedExcelFile?.name}
              </p>

              <div className="stats">
                <div>
                  <span>Total</span>
                  <strong>
                    {bulkPreview.total}
                  </strong>
                </div>

                <div>
                  <span>New</span>
                  <strong>
                    {bulkPreview.newTickets.length}
                  </strong>
                </div>

                <div>
                  <span>Existing</span>
                  <strong>
                    {
                      bulkPreview
                        .existingTickets.length
                    }
                  </strong>
                </div>
              </div>

              {bulkPreview.existingTickets
                .length > 0 && (
                <div className="warning-box">
                  {
                    bulkPreview.existingTickets
                      .length
                  }{" "}
                  existing ticket IDs will be
                  skipped.
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="button secondary"
                  onClick={handleCancelImport}
                  disabled={isImporting}
                >
                  Cancel
                </button>

                <button
                  className="button primary"
                  onClick={handleConfirmImport}
                  disabled={
                    isImporting ||
                    bulkPreview.newTickets
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
