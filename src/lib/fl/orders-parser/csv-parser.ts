/**
 * RFC 4180 compliant CSV Parser
 * Hỗ trợ BOM, quoted commas, escaped quotes ("") và xuống dòng trong ô.
 */
export function parseCsv(text: string): string[][] {
  // Loại bỏ BOM nếu có
  let input = text;
  if (input.charCodeAt(0) === 0xfeff) {
    input = input.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;
  let i = 0;
  const len = input.length;

  while (i < len) {
    const char = input[i];

    if (insideQuotes) {
      if (char === '"') {
        // Kiểm tra xem có phải escaped quote ("") không
        if (i + 1 < len && input[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        }
        // Đóng quote
        insideQuotes = false;
        i++;
        continue;
      }
      currentCell += char;
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      i++;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      i++;
      continue;
    }

    if (char === "\r") {
      // Bỏ qua \r, xử lý kết thúc dòng nếu tiếp theo là \n
      if (i + 1 < len && input[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      i++;
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      i++;
      continue;
    }

    currentCell += char;
    i++;
  }

  // Đẩy cell và row cuối cùng nếu còn
  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  // Loại bỏ các dòng trống hoàn toàn ở cuối file
  while (
    rows.length > 0 &&
    rows[rows.length - 1].length === 1 &&
    rows[rows.length - 1][0].trim() === ""
  ) {
    rows.pop();
  }

  return rows;
}
