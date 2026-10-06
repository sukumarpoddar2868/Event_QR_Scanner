import * as XLSX from "xlsx";

export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);

        const workbook = XLSX.read(data, {
          type: "array",
        });

        const firstSheet =
          workbook.Sheets[workbook.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json(firstSheet, {
          defval: "",
        });

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read Excel file."));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function downloadExcel(tickets, filename = "tickets.xlsx") {
  const worksheet = XLSX.utils.json_to_sheet(tickets);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Tickets"
  );

  XLSX.writeFile(workbook, filename);
}
