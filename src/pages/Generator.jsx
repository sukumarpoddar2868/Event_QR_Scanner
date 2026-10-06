import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import JSZip from "jszip";

const STORAGE_KEY = "event-ticket-generator";

export default function Generator() {
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

  const [selectedExcelFile, setSelectedExcelFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [showBulkConfirmation, setShowBulkConfirmation] =
    useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // ----------------------------------------
  // Load saved generator state
  // ----------------------------------------

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);

      if (!savedData) return;

      const parsed = JSON.parse(savedData);

      if (Array.isArray(parsed.tickets)) {
        setTickets(parsed.tickets);
      }

      if (parsed.slNo) {
        setSlNo(parsed.slNo);
      }

      if (parsed.ticketId) {
        setTicketId(parsed.ticketId);
      }
    } catch (error) {
      console.error("Failed to load saved generator data:", error);
    }
  }, []);

  // ----------------------------------------
  // Save generator state
  // ----------------------------------------

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tickets,
        slNo,
        ticketId,
      })
    );
  }, [tickets, slNo, ticketId]);

  // ----------------------------------------
  // Messages
  // ----------------------------------------

  function showMessage(text, type = "success") {
    setMessage(text);
    setMessageType(type);
  }

  // ----------------------------------------
  // Calculate next SL number
  // ----------------------------------------

  function calculateNextSlNo(ticketList) {
    if (ticketList.length === 0) {
      return 1;
    }

    const numbers = ticketList
      .map((ticket) => Number(ticket.sl_no))
      .filter((number) => Number.isFinite(number));

    if (numbers.length === 0) {
      return 1;
    }

    return Math.max(...numbers) + 1;
  }

  // ----------------------------------------
  // Calculate next Ticket ID
  // ----------------------------------------

  function calculateNextTicketId(ticketList) {
    if (ticketList.length === 0) {
      return "EVT001";
    }

    let highestNumber = 0;

    for (const ticket of ticketList) {
      const match = String(ticket.ticket_id).match(
        /(\d+)$/
      );

      if (match) {
        const number = Number(match[1]);

        if (number > highestNumber) {
          highestNumber = number;
        }
      }
    }

    const nextNumber = highestNumber + 1;

    return `EVT${String(nextNumber).padStart(3, "0")}`;
  }

  // ----------------------------------------
  // Generate QR
  // ----------------------------------------

  async function generateQR(ticket) {
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
  }

  // ----------------------------------------
  // Create single ticket
  // ----------------------------------------

  async function handleGenerateTicket(event) {
    event.preventDefault();

    const cleanTicketId = ticketId.trim();
    const cleanName = name.trim();
    const cleanNumber = number.trim();

    if (!cleanTicketId) {
      showMessage("Please enter a ticket ID.", "error");
      return;
    }

    if (!cleanName) {
      showMessage("Please enter the attendee name.", "error");
      return;
    }

    if (!cleanNumber) {
      showMessage("Please enter the phone number.", "error");
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

    const ticket = {
      sl_no: Number(slNo),
      ticket_id: cleanTicketId,
      name: cleanName,
      number: cleanNumber,
    };

    setIsGenerating(true);

    try {
      await generateQR(ticket);

      const updatedTickets = [
        ...tickets,
        ticket,
      ];

      setTickets(updatedTickets);

      setSlNo(
        calculateNextSlNo(updatedTickets)
      );

      setTicketId(
        calculateNextTicketId(updatedTickets)
      );

      setName("");
      setNumber("");

      showMessage(
        `${cleanTicketId} generated successfully.`
      );
    } catch (error) {
      console.error(error);

      showMessage(
        "Failed to generate QR code.",
        "error"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  // ----------------------------------------
  // Download selected QR
  // ----------------------------------------

  function handleDownloadQR() {
    if (!qrDataUrl || !selectedTicket) {
      return;
    }

    const link = document.createElement("a");

    link.href = qrDataUrl;
    link.download = `${selectedTicket.ticket_id}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ----------------------------------------
  // Parse Excel
  // ----------------------------------------

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

  // ----------------------------------------
  // Select Excel
  // ----------------------------------------

  async function handleExcelFileSelect(event) {
    const file = event.target.files[0];

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
      console.error(error);

      if (error.message === "EMPTY_EXCEL") {
        showMessage(
          "The Excel file is empty.",
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
        error.message.startsWith("INCOMPLETE_ROW_")
      ) {
        const rowNumber =
          error.message.split("_")[2];

        showMessage(
          `Incomplete data found in Excel row ${rowNumber}.`,
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

  // ----------------------------------------
  // Cancel bulk import
  // ----------------------------------------

  function handleCancelBulkImport() {
    setSelectedExcelFile(null);
    setBulkPreview(null);
    setShowBulkConfirmation(false);
  }

  // ----------------------------------------
  // Confirm bulk import
  // ----------------------------------------

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

      const nextSlNo =
        calculateNextSlNo(updatedTickets);

      const nextTicketId =
        calculateNextTicketId(updatedTickets);

      setSlNo(nextSlNo);
      setTicketId(nextTicketId);

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
      console.error(error);

      showMessage(
        "Failed to import tickets.",
        "error"
      );
    } finally {
      setIsImporting(false);
    }
  }

  // ----------------------------------------
  // Download Master Excel
  // ----------------------------------------

  function handleDownloadExcel() {
    if (tickets.length === 0) {
      showMessage(
        "There are no tickets to export.",
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

  // ----------------------------------------
  // Download all QR codes
  // ----------------------------------------

  async function handleDownloadAllQRs() {
    if (tickets.length === 0) {
      showMessage(
        "There are no tickets to download.",
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

        const base64 =
          dataUrl.split(",")[1];

        zip.file(
          `${ticket.ticket_id}.png`,
          base64,
          {
            base64: true,
          }
        );
      }

      const blob =
        await zip.generateAsync({
          type: "blob",
        });

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        "event_ticket_qr_codes.zip";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      showMessage(
        `${tickets.length} QR codes downloaded successfully.`
      );
    } catch (error) {
      console.error(error);

      showMessage(
        "Failed to create QR ZIP file.",
        "error"
      );
    } finally {
      setIsDownloading(false);
    }
  }

  // ----------------------------------------
  // Clear everything
  // ----------------------------------------

  function handleClearAll() {
    const confirmed = window.confirm(
      "Are you sure you want to delete all generated tickets from this browser?"
    );

    if (!confirmed) return;

    setTickets([]);
    setSlNo(1);
    setTicketId("EVT001");
    setName("");
    setNumber("");
    setSelectedTicket(null);
    setQrDataUrl("");

    localStorage.removeItem(
      STORAGE_KEY
    );

    showMessage(
      "All generator data has been cleared."
    );
  }

  return (
    <main className="app-shell">

      {/* ================================
          HEADER
      ================================= */}

      <header className="topbar">
        <div>
          <div className="card-kicker">
            EVENT MANAGEMENT
          </div>

          <h1>Ticket Generator</h1>

          <p>
            Create tickets and generate QR codes
            for event check-in.
          </p>
        </div>

        <div className="topbar-actions">
          <a
            href="/scanner"
            className="btn btn-secondary"
          >
            Open Scanner
          </a>
        </div>
      </header>

      {/* ================================
          MESSAGE
      ================================= */}

      {message && (
        <div
          className={`message ${messageType}`}
        >
          {message}
        </div>
      )}

      {/* ================================
          PROGRESS
      ================================= */}

      <section className="progress-card card">
        <div>
          <div className="card-kicker">
            GENERATOR PROGRESS
          </div>

          <h2>
            {tickets.length} tickets created
          </h2>

          <p>
            Your progress is saved automatically
            in this browser.
          </p>
        </div>

        <div className="progress-next">
          <span>Next SL No.</span>
          <strong>{slNo}</strong>

          <span>Next Ticket ID</span>
          <strong>{ticketId}</strong>
        </div>
      </section>

      {/* ================================
          MAIN GRID
      ================================= */}

      <section className="dashboard-grid">

        {/* ================================
            SINGLE TICKET
        ================================= */}

        <div className="card">

          <div className="card-header">
            <div>
              <div className="card-kicker">
                SINGLE TICKET
              </div>

              <h2>Create Ticket</h2>
            </div>
          </div>

          <form
            onSubmit={handleGenerateTicket}
          >

            <div className="form-grid">

              <div className="form-group">
                <label>
                  SL No.
                </label>

                <input
                  type="number"
                  value={slNo}
                  onChange={(event) =>
                    setSlNo(
                      Number(event.target.value)
                    )
                  }
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>
                  Ticket ID
                </label>

                <input
                  type="text"
                  value={ticketId}
                  onChange={(event) =>
                    setTicketId(
                      event.target.value
                    )
                  }
                  placeholder="EVT001"
                />
              </div>

              <div className="form-group">
                <label>
                  Attendee Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Rahul Kumar"
                />
              </div>

              <div className="form-group">
                <label>
                  Phone Number
                </label>

                <input
                  type="text"
                  value={number}
                  onChange={(event) =>
                    setNumber(
                      event.target.value
                    )
                  }
                  placeholder="9876543210"
                />
              </div>

            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isGenerating}
            >
              {isGenerating
                ? "Generating..."
                : "Generate Ticket QR"}
            </button>

          </form>
        </div>

        {/* ================================
            QR PREVIEW
        ================================= */}

        <div className="card qr-card">

          <div className="card-header">
            <div>
              <div className="card-kicker">
                QR PREVIEW
              </div>

              <h2>Generated QR</h2>
            </div>
          </div>

          {qrDataUrl && selectedTicket ? (
            <>
              <div className="qr-preview">
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${selectedTicket.ticket_id}`}
                />
              </div>

              <div className="qr-info">
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
                className="btn btn-primary btn-full"
                onClick={handleDownloadQR}
              >
                Download QR PNG
              </button>
            </>
          ) : (
            <div className="empty-state">
              <div className="upload-icon">
                QR
              </div>

              <h3>
                No QR selected
              </h3>

              <p>
                Generate a ticket to preview
                its QR code here.
              </p>
            </div>
          )}

        </div>

      </section>

      {/* ================================
          BULK IMPORT
      ================================= */}

      <section className="card bulk-card">

        <div className="card-header">
          <div>
            <div className="card-kicker">
              BULK OPERATIONS
            </div>

            <h2>Import Tickets from Excel</h2>

            <p>
              Upload an Excel file containing
              sl_no, ticket_id, name and number.
            </p>
          </div>
        </div>

        <div className="upload-box">

          <div className="upload-icon">
            XLSX
          </div>

          <h3>
            Upload Master Ticket Excel
          </h3>

          <p>
            Existing ticket IDs will be skipped.
          </p>

          <label className="upload-button">
            Choose Excel File

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileSelect}
              hidden
            />
          </label>

        </div>

        <div className="bulk-note">
          Required columns:
          <strong>
            sl_no, ticket_id, name, number
          </strong>
        </div>

      </section>

      {/* ================================
          ACTIONS
      ================================= */}

      <section className="card">

        <div className="card-header">
          <div>
            <div className="card-kicker">
              EXPORT
            </div>

            <h2>Ticket Files</h2>
          </div>
        </div>

        <div className="form-grid">

          <button
            className="btn btn-secondary"
            onClick={handleDownloadExcel}
          >
            Download Master Excel
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleDownloadAllQRs}
            disabled={isDownloading}
          >
            {isDownloading
              ? "Creating ZIP..."
              : "Download All QR Codes"}
          </button>

          <button
            className="btn btn-danger"
            onClick={handleClearAll}
          >
            Clear Generator Data
          </button>

        </div>

      </section>

      {/* ================================
          TICKET TABLE
      ================================= */}

      <section className="card table-card">

        <div className="table-header">

          <div>
            <div className="card-kicker">
              TICKET LIST
            </div>

            <h2>
              Generated Tickets
            </h2>
          </div>

          <strong>
            {tickets.length}
          </strong>

        </div>

        <div className="table-wrapper">

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
                <tr
                  key={ticket.ticket_id}
                >
                  <td>
                    {ticket.sl_no}
                  </td>

                  <td>
                    <strong>
                      {ticket.ticket_id}
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
                      onClick={async () => {
                        await generateQR(
                          ticket
                        );
                      }}
                    >
                      View QR
                    </button>

                  </td>
                </tr>
              ))}

              {tickets.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="table-empty"
                  >
                    No tickets created yet.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </section>

      {/* ================================
          BULK IMPORT MODAL
      ================================= */}

      {showBulkConfirmation &&
        bulkPreview && (
          <div className="modal-overlay">

            <div className="modal">

              <div className="modal-header">

                <div>
                  <div className="card-kicker">
                    IMPORT CONFIRMATION
                  </div>

                  <h2>
                    Import Excel?
                  </h2>
                </div>

                <button
                  className="modal-close"
                  onClick={
                    handleCancelBulkImport
                  }
                  disabled={isImporting}
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
                  <span>Total Rows</span>
                  <strong>
                    {
                      bulkPreview
                        .importedTickets
                        .length
                    }
                  </strong>
                </div>

                <div className="import-stat">
                  <span>New Tickets</span>
                  <strong>
                    {
                      bulkPreview
                        .newTickets
                        .length
                    }
                  </strong>
                </div>

                <div className="import-stat">
                  <span>Existing</span>
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
                  {
                    bulkPreview
                      .existingTickets
                      .length
                  } ticket IDs already exist
                  and will be skipped.
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
