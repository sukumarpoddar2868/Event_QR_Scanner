import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import JSZip from "jszip";
import "./index.css";

const STORAGE_KEY = "event-ticket-generator";

export default function App() {
  const [tickets, setTickets] = useState([]);

  const [slNo, setSlNo] = useState(1);
  const [ticketId, setTicketId] = useState("EVT001");

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Bulk Excel states
  const [selectedExcelFile, setSelectedExcelFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [showBulkConfirmation, setShowBulkConfirmation] =
    useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // --------------------------------------------------
  // LOAD SAVED DATA
  // --------------------------------------------------

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);

      if (!savedData) return;

      const parsedData = JSON.parse(savedData);

      setTickets(parsedData.tickets || []);
      setSlNo(parsedData.nextSlNo || 1);
      setTicketId(
        parsedData.nextTicketId || "EVT001"
      );
    } catch (error) {
      console.error(
        "Failed to load saved generator data:",
        error
      );
    }
  }, []);

  // --------------------------------------------------
  // SAVE DATA
  // --------------------------------------------------

  useEffect(() => {
    const data = {
      tickets,
      nextSlNo: slNo,
      nextTicketId: ticketId,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  }, [tickets, slNo, ticketId]);

  // --------------------------------------------------
  // MESSAGE
  // --------------------------------------------------

  function showMessage(text, type = "success") {
    setMessage(text);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  // --------------------------------------------------
  // GENERATE QR
  // --------------------------------------------------

  async function generateQR(ticket) {
    try {
      const dataUrl = await QRCode.toDataURL(
        ticket.ticket_id,
        {
          width: 500,
          margin: 2,
          errorCorrectionLevel: "H",
        }
      );

      setSelectedTicket(ticket);
      setQrDataUrl(dataUrl);

      return dataUrl;
    } catch (error) {
      console.error("QR generation failed:", error);

      showMessage(
        "Failed to generate QR code.",
        "error"
      );

      return null;
    }
  }

  // --------------------------------------------------
  // CALCULATE NEXT TICKET ID
  // --------------------------------------------------

  function calculateNextTicketId(ticketList) {
    const ticketNumbers = ticketList
      .map((ticket) => {
        const match =
          String(ticket.ticket_id).match(/(\d+)$/);

        return match ? Number(match[1]) : 0;
      })
      .filter(Boolean);

    const nextNumber =
      Math.max(...ticketNumbers, 0) + 1;

    return `EVT${String(nextNumber).padStart(3, "0")}`;
  }

  // --------------------------------------------------
  // CALCULATE NEXT SL NO
  // --------------------------------------------------

  function calculateNextSlNo(ticketList) {
    const slNumbers = ticketList
      .map((ticket) => Number(ticket.sl_no))
      .filter((value) => Number.isFinite(value));

    return Math.max(...slNumbers, 0) + 1;
  }

  // --------------------------------------------------
  // CREATE SINGLE TICKET
  // --------------------------------------------------

  async function handleGenerateTicket() {
    const cleanTicketId = ticketId.trim();
    const cleanName = name.trim();
    const cleanNumber = number.trim();

    if (!cleanTicketId) {
      showMessage(
        "Please enter a ticket ID.",
        "error"
      );
      return;
    }

    if (!cleanName) {
      showMessage(
        "Please enter the attendee name.",
        "error"
      );
      return;
    }

    if (!cleanNumber) {
      showMessage(
        "Please enter the phone number.",
        "error"
      );
      return;
    }

    const duplicate = tickets.some(
      (ticket) =>
        ticket.ticket_id.toLowerCase() ===
        cleanTicketId.toLowerCase()
    );

    if (duplicate) {
      showMessage(
        `Ticket ID ${cleanTicketId} already exists.`,
        "error"
      );
      return;
    }

    const newTicket = {
      sl_no: Number(slNo),
      ticket_id: cleanTicketId,
      name: cleanName,
      number: cleanNumber,
    };

    setIsGenerating(true);

    try {
      const dataUrl = await QRCode.toDataURL(
        newTicket.ticket_id,
        {
          width: 500,
          margin: 2,
          errorCorrectionLevel: "H",
        }
      );

      const updatedTickets = [
        ...tickets,
        newTicket,
      ];

      setTickets(updatedTickets);

      setSelectedTicket(newTicket);
      setQrDataUrl(dataUrl);

      const nextSlNo =
        calculateNextSlNo(updatedTickets);

      const nextTicketId =
        calculateNextTicketId(updatedTickets);

      setSlNo(nextSlNo);
      setTicketId(nextTicketId);

      setName("");
      setNumber("");

      showMessage(
        `${newTicket.ticket_id} generated successfully.`
      );
    } catch (error) {
      console.error(
        "Ticket generation failed:",
        error
      );

      showMessage(
        "Failed to generate ticket.",
        "error"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  // --------------------------------------------------
  // DOWNLOAD SINGLE QR
  // --------------------------------------------------

  function handleDownloadSingleQR() {
    if (!selectedTicket || !qrDataUrl) {
      showMessage(
        "No QR code selected.",
        "error"
      );
      return;
    }

    const link = document.createElement("a");

    link.href = qrDataUrl;
    link.download = `${selectedTicket.ticket_id}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --------------------------------------------------
  // READ EXCEL
  // --------------------------------------------------

  async function parseExcelFile(file) {
    const data = await file.arrayBuffer();

    const workbook = XLSX.read(data, {
      type: "array",
    });

    const sheet =
      workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      throw new Error("EMPTY_EXCEL");
    }

    const importedTickets = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const importedTicket = {
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
      };

      if (
        !importedTicket.ticket_id ||
        !importedTicket.name ||
        !importedTicket.number
      ) {
        throw new Error(
          `INCOMPLETE_ROW_${index + 2}`
        );
      }

      importedTickets.push(importedTicket);
    }

    // Check duplicates inside uploaded Excel
    const uploadedIds =
      importedTickets.map((ticket) =>
        ticket.ticket_id.toLowerCase()
      );

    if (
      new Set(uploadedIds).size !==
      uploadedIds.length
    ) {
      throw new Error("DUPLICATE_EXCEL");
    }

    return importedTickets;
  }

  // --------------------------------------------------
  // SELECT EXCEL FILE
  // --------------------------------------------------

  async function handleExcelFileSelect(event) {
    const file = event.target.files[0];

    // Allow selecting the same file again later
    event.target.value = "";

    if (!file) return;

    try {
      const importedTickets =
        await parseExcelFile(file);

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
        importedTickets.filter(
          (ticket) =>
            existingIds.has(
              ticket.ticket_id.toLowerCase()
            )
        );

      setSelectedExcelFile(file);

      setBulkPreview({
        importedTickets,
        newTickets,
        existingTickets,
      });

      setShowBulkConfirmation(true);
    } catch (error) {
      console.error(
        "Excel preview failed:",
        error
      );

      if (error.message === "EMPTY_EXCEL") {
        showMessage(
          "Excel file is empty.",
          "error"
        );
      } else if (
        error.message === "DUPLICATE_EXCEL"
      ) {
        showMessage(
          "Duplicate ticket IDs found inside the Excel file.",
          "error"
        );
      } else if (
        error.message.startsWith(
          "INCOMPLETE_ROW_"
        )
      ) {
        const rowNumber =
          error.message.replace(
            "INCOMPLETE_ROW_",
            ""
          );

        showMessage(
          `Incomplete ticket data in Excel row ${rowNumber}.`,
          "error"
        );
      } else {
        showMessage(
          "Failed to read Excel file.",
          "error"
        );
      }
    }
  }

  // --------------------------------------------------
  // CANCEL BULK IMPORT
  // --------------------------------------------------

  function handleCancelBulkImport() {
    setSelectedExcelFile(null);
    setBulkPreview(null);
    setShowBulkConfirmation(false);
  }

  // --------------------------------------------------
  // CONFIRM BULK IMPORT
  // --------------------------------------------------

  async function handleConfirmBulkImport() {
    if (!bulkPreview) return;

    const {
      newTickets,
      existingTickets,
    } = bulkPreview;

    if (newTickets.length === 0) {
      showMessage(
        "All tickets in this Excel already exist.",
        "error"
      );

      handleCancelBulkImport();
      return;
    }

    setIsImporting(true);

    try {
      const updatedTickets = [
        ...tickets,
        ...newTickets,
      ];

      setTickets(updatedTickets);

      // Prepare next values
      const nextSlNo =
        calculateNextSlNo(updatedTickets);

      const nextTicketId =
        calculateNextTicketId(updatedTickets);

      setSlNo(nextSlNo);
      setTicketId(nextTicketId);

      // IMPORTANT:
      // Show the first newly imported ticket
      // in the QR preview.
      const firstImportedTicket =
        newTickets[0];

      await generateQR(
        firstImportedTicket
      );

      if (existingTickets.length > 0) {
        showMessage(
          `${newTickets.length} new tickets imported. ${existingTickets.length} existing tickets skipped.`
        );
      } else {
        showMessage(
          `${newTickets.length} tickets imported successfully.`
        );
      }

      handleCancelBulkImport();
    } catch (error) {
      console.error(
        "Bulk import failed:",
        error
      );

      showMessage(
        "Failed to import tickets.",
        "error"
      );
    } finally {
      setIsImporting(false);
    }
  }

  // --------------------------------------------------
  // DOWNLOAD MASTER EXCEL
  // --------------------------------------------------

  function handleDownloadExcel() {
    if (tickets.length === 0) {
      showMessage(
        "No tickets available.",
        "error"
      );
      return;
    }

    const worksheet =
      XLSX.utils.json_to_sheet(tickets);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Tickets"
    );

    XLSX.writeFile(
      workbook,
      "event_tickets.xlsx"
    );
  }

  // --------------------------------------------------
  // DOWNLOAD ALL QR CODES
  // --------------------------------------------------

  async function handleDownloadAllQR() {
    if (tickets.length === 0) {
      showMessage(
        "No tickets available.",
        "error"
      );
      return;
    }

    setIsDownloading(true);

    try {
      const zip = new JSZip();

      for (const ticket of tickets) {
        const dataUrl =
          await QRCode.toDataURL(
            ticket.ticket_id,
            {
              width: 500,
              margin: 2,
              errorCorrectionLevel: "H",
            }
          );

        const base64Data =
          dataUrl.split(",")[1];

        zip.file(
          `${ticket.ticket_id}.png`,
          base64Data,
          {
            base64: true,
          }
        );
      }

      const zipBlob =
        await zip.generateAsync({
          type: "blob",
        });

      const url =
        URL.createObjectURL(zipBlob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        "event_qr_codes.zip";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      showMessage(
        `${tickets.length} QR codes downloaded successfully.`
      );
    } catch (error) {
      console.error(
        "QR ZIP generation failed:",
        error
      );

      showMessage(
        "Failed to generate QR ZIP.",
        "error"
      );
    } finally {
      setIsDownloading(false);
    }
  }

  // --------------------------------------------------
  // CLEAR ALL
  // --------------------------------------------------

  function handleClearAll() {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete all generated tickets?"
      );

    if (!confirmed) return;

    setTickets([]);
    setSlNo(1);
    setTicketId("EVT001");

    setSelectedTicket(null);
    setQrDataUrl("");

    localStorage.removeItem(
      STORAGE_KEY
    );

    showMessage(
      "All tickets cleared."
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app-shell">

      {/* ---------------------------------------- */}
      {/* TOP BAR */}
      {/* ---------------------------------------- */}

      <header className="topbar">
        <div>
          <div className="eyebrow">
            EVENT MANAGEMENT
          </div>

          <h1>
            Event Ticket Generator
          </h1>
        </div>

        <div className="topbar-actions">
          <button
            className="btn btn-secondary"
            onClick={handleDownloadExcel}
          >
            Download Master Excel
          </button>

          <button
            className="btn btn-primary"
            onClick={handleDownloadAllQR}
            disabled={
              isDownloading ||
              tickets.length === 0
            }
          >
            {isDownloading
              ? "Creating ZIP..."
              : "Download All QR Codes"}
          </button>
        </div>
      </header>

      {/* ---------------------------------------- */}
      {/* MESSAGE */}
      {/* ---------------------------------------- */}

      {message && (
        <div
          className={`message ${
            messageType === "error"
              ? "message-error"
              : "message-success"
          }`}
        >
          {message}
        </div>
      )}

      {/* ---------------------------------------- */}
      {/* PROGRESS */}
      {/* ---------------------------------------- */}

      <section className="progress-card">
        <div>
          <span className="progress-label">
            CURRENT PROGRESS
          </span>

          <strong>
            {tickets.length} tickets generated
          </strong>
        </div>

        <div className="progress-next">
          <span>Next Sl No</span>
          <strong>{slNo}</strong>
        </div>

        <div className="progress-next">
          <span>Next Ticket ID</span>
          <strong>{ticketId}</strong>
        </div>
      </section>

      <main className="dashboard-grid">

        {/* ---------------------------------------- */}
        {/* SINGLE TICKET */}
        {/* ---------------------------------------- */}

        <section className="card">

          <div className="card-header">
            <div>
              <span className="card-kicker">
                SINGLE TICKET
              </span>

              <h2>
                Create Ticket
              </h2>
            </div>
          </div>

          <div className="form-grid">

            <div className="form-group">
              <label>
                Sl No
              </label>

              <input
                type="number"
                value={slNo}
                onChange={(e) =>
                  setSlNo(
                    Number(e.target.value)
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>
                Ticket ID
              </label>

              <input
                value={ticketId}
                onChange={(e) =>
                  setTicketId(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="form-group full">
              <label>
                Name
              </label>

              <input
                type="text"
                placeholder="Enter attendee name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />
            </div>

            <div className="form-group full">
              <label>
                Phone Number
              </label>

              <input
                type="text"
                placeholder="Enter phone number"
                value={number}
                onChange={(e) =>
                  setNumber(e.target.value)
                }
              />
            </div>

          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={
              handleGenerateTicket
            }
            disabled={isGenerating}
          >
            {isGenerating
              ? "Generating..."
              : "Generate Ticket & QR"}
          </button>

        </section>

        {/* ---------------------------------------- */}
        {/* QR PREVIEW */}
        {/* ---------------------------------------- */}

        <section className="card qr-card">

          <div className="card-header">
            <div>
              <span className="card-kicker">
                QR PREVIEW
              </span>

              <h2>
                {selectedTicket
                  ? selectedTicket.ticket_id
                  : "No Ticket Selected"}
              </h2>
            </div>
          </div>

          <div className="qr-preview">

            {qrDataUrl ? (
              <>
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${
                    selectedTicket?.ticket_id
                  }`}
                />

                <div className="qr-info">
                  <strong>
                    {selectedTicket?.name}
                  </strong>

                  <span>
                    {selectedTicket?.number}
                  </span>

                  <small>
                    Scan value:{" "}
                    {selectedTicket?.ticket_id}
                  </small>
                </div>

                <button
                  className="btn btn-secondary btn-full"
                  onClick={
                    handleDownloadSingleQR
                  }
                >
                  Download This QR
                </button>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  QR
                </div>

                <p>
                  Generate or import a ticket
                  to preview its QR code.
                </p>
              </div>
            )}

          </div>

        </section>

        {/* ---------------------------------------- */}
        {/* BULK IMPORT */}
        {/* ---------------------------------------- */}

        <section className="card bulk-card">

          <div className="card-header">
            <div>
              <span className="card-kicker">
                BULK IMPORT
              </span>

              <h2>
                Upload Excel
              </h2>
            </div>
          </div>

          <div className="upload-box">

            <div className="upload-icon">
              XLS
            </div>

            <h3>
              Import multiple tickets
            </h3>

            <p>
              Upload an Excel file containing:
              <br />
              <strong>
                sl_no, ticket_id, name, number
              </strong>
            </p>

            <label className="btn btn-secondary upload-button">
              Choose Excel File

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={
                  handleExcelFileSelect
                }
                hidden
              />
            </label>

          </div>

          <div className="bulk-note">
            Existing ticket IDs are skipped
            automatically.
          </div>

        </section>

      </main>

      {/* ---------------------------------------- */}
      {/* TICKET TABLE */}
      {/* ---------------------------------------- */}

      <section className="card table-card">

        <div className="card-header">
          <div>
            <span className="card-kicker">
              TICKET DATABASE
            </span>

            <h2>
              Generated Tickets
            </h2>
          </div>

          {tickets.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleClearAll}
            >
              Clear All
            </button>
          )}
        </div>

        {tickets.length === 0 ? (
          <div className="table-empty">
            No tickets generated yet.
          </div>
        ) : (
          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>
                    Sl No
                  </th>

                  <th>
                    Ticket ID
                  </th>

                  <th>
                    Name
                  </th>

                  <th>
                    Number
                  </th>

                  <th>
                    QR
                  </th>
                </tr>
              </thead>

              <tbody>
                {tickets.map(
                  (ticket) => (
                    <tr
                      key={
                        ticket.ticket_id
                      }
                    >
                      <td>
                        {ticket.sl_no}
                      </td>

                      <td>
                        <strong>
                          {
                            ticket.ticket_id
                          }
                        </strong>
                      </td>

                      <td>
                        {ticket.name}
                      </td>

                      <td>
                        {ticket.number}
                      </td>

                      <td>
                        <button
                          className="table-action"
                          onClick={() =>
                            generateQR(
                              ticket
                            )
                          }
                        >
                          View QR
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>

            </table>

          </div>
        )}

      </section>

      {/* ---------------------------------------- */}
      {/* BULK IMPORT CONFIRMATION MODAL */}
      {/* ---------------------------------------- */}

      {showBulkConfirmation &&
        bulkPreview && (
          <div className="modal-overlay">

            <div className="modal">

              <div className="modal-header">

                <div>
                  <span className="card-kicker">
                    EXCEL IMPORT
                  </span>

                  <h2>
                    Confirm Import
                  </h2>
                </div>

                <button
                  className="modal-close"
                  onClick={
                    handleCancelBulkImport
                  }
                >
                  ×
                </button>

              </div>

              <div className="modal-file">
                <strong>
                  {selectedExcelFile?.name}
                </strong>
              </div>

              <div className="import-stats">

                <div className="import-stat">
                  <span>
                    Total Rows
                  </span>

                  <strong>
                    {
                      bulkPreview
                        .importedTickets
                        .length
                    }
                  </strong>
                </div>

                <div className="import-stat">
                  <span>
                    New Tickets
                  </span>

                  <strong>
                    {
                      bulkPreview
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
                      bulkPreview
                        .existingTickets
                        .length
                    }
                  </strong>
                </div>

              </div>

              {bulkPreview.existingTickets
                .length > 0 && (
                <div className="modal-warning">
                  <strong>
                    Existing tickets found
                  </strong>

                  <p>
                    {
                      bulkPreview
                        .existingTickets
                        .length
                    }{" "}
                    ticket(s) already exist
                    and will be skipped.
                  </p>
                </div>
              )}

              {bulkPreview.newTickets
                .length === 0 && (
                <div className="modal-warning">
                  <strong>
                    Nothing new to import
                  </strong>

                  <p>
                    All tickets in this
                    Excel file already
                    exist.
                  </p>
                </div>
              )}

              <div className="modal-actions">

                <button
                  className="btn btn-secondary"
                  onClick={
                    handleCancelBulkImport
                  }
                  disabled={isImporting}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  onClick={
                    handleConfirmBulkImport
                  }
                  disabled={
                    isImporting ||
                    bulkPreview
                      .newTickets
                      .length === 0
                  }
                >
                  {isImporting
                    ? "Importing..."
                    : `Import ${
                        bulkPreview
                          .newTickets
                          .length
                      } Tickets`}
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}
