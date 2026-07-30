import * as XLSX from "xlsx";

// Buduje prawdziwy plik .xlsx w pamieci (ta sama biblioteka co
// produkcyjnie) -- testy parsera dostaja realne bajty do sparsowania,
// nie udawane fixture'y, zeby faktycznie chronily przed regresjami typu
// "inna liczba spacji w naglowku psuje caly import" (juz sie zdarzylo
// dwa razy na produkcji).
export function buildXlsxFile(
  headers: string[],
  rows: (string | number)[][],
  filename = "test.xlsx"
): File {
  const aoa = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buffer], filename, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
