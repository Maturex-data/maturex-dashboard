"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Kind = "orders" | "items" | "statement" | "cogs";
type Job = {
  valid?: boolean;
  orderIds?: string[];
  file: File;
  path: string;
  kind?: Kind;
  shop: string;
  month: string;
  status: string;
  error?: string;
  done?: boolean;
};
const rank = { orders: 0, items: 1, statement: 2, cogs: 3 };
async function droppedFiles(
  items: DataTransferItemList,
): Promise<{ file: File; path: string }[]> {
  const result: { file: File; path: string }[] = [];
  async function walk(entry: FileSystemEntry, path: string): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      result.push({ file, path: path + file.name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const entries = await new Promise<FileSystemEntry[]>(
          (resolve, reject) => reader.readEntries(resolve, reject),
        );
        if (!entries.length) break;
        for (const child of entries) await walk(child, `${path}${entry.name}/`);
      }
    }
  }
  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry();
    if (entry) await walk(entry, "");
  }
  return result;
}
export function FolderImport() {
  const [jobs, setJobs] = useState<Job[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function analyze(job: Job): Promise<Job> {
    const form = new FormData();
    form.set("file", job.file);
    form.set("path", job.path);
    form.set("shop", job.shop);
    try {
      const res = await fetch("/api/fl/bo-folder/analyze", {
        method: "POST",
        body: form,
      });
      const p = await res.json();
      if (!res.ok) throw Error(p.error);
      if (p.error)
        return { ...job, ...p, valid: false, status: "Lỗi", error: p.error };
      return {
        ...job,
        ...p,
        valid: !p.needsShop,
        status: p.needsShop ? "Chọn shop" : "Sẵn sàng",
        error: undefined,
      };
    } catch (e) {
      return {
        ...job,
        valid: false,
        status: "Lỗi",
        error: e instanceof Error ? e.message : "Không đọc được file",
      };
    }
  }
  async function load(files: { file: File; path: string }[]) {
    setBusy(true);
    setMessage("");
    try {
      const supported = files.filter(
        (x) =>
          /\.(csv|xlsx)$/i.test(x.file.name) && !x.file.name.startsWith("~$"),
      );
      if (!supported.length || supported.length > 100)
        throw Error("Chọn từ 1 đến 100 file CSV/XLSX.");
      const next: Job[] = [];
      const hashes = new Set<string>();
      for (const x of supported) {
        if (x.file.size > 20 * 1024 * 1024)
          throw Error(`${x.path}: vượt 20 MB.`);
        const hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await x.file.arrayBuffer()),
          ),
        ).join(",");
        if (hashes.has(hash)) continue;
        hashes.add(hash);
        setMessage(
          `Đang phân tích ${next.length + 1}/${supported.length}: ${x.path}`,
        );
        next.push(
          await analyze({
            ...x,
            shop: "",
            month: "",
            status: "Đang phân tích",
          }),
        );
      }
      setJobs(next);
      setMessage(
        "Kiểm tra danh sách bên dưới trước khi import. File giống hệt được loại trùng.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không đọc được thư mục.");
    } finally {
      setBusy(false);
    }
  }
  const statementKeys = jobs
    .filter((j) => j.kind === "statement" && !j.error && j.shop)
    .map((j) => `${j.shop}:${j.month}`);
  const duplicateStatements =
    statementKeys.length !== new Set(statementKeys).size;
  const multipleCogs = jobs.filter((j) => j.kind === "cogs").length > 1;
  const orderIds = jobs
    .filter((j) => j.kind === "orders")
    .flatMap((j) => j.orderIds ?? []);
  const overlappingOrders = orderIds.length !== new Set(orderIds).size;
  async function run() {
    setBusy(true);
    const next = [...jobs];
    let ordersFailed = false;
    try {
      for (const job of [...jobs].sort(
        (a, b) => rank[a.kind as Kind] - rank[b.kind as Kind],
      )) {
        if (job.done) continue;
        const i = jobs.indexOf(job);
        if (ordersFailed && (job.kind === "items" || job.kind === "cogs")) {
          next[i] = {
            ...job,
            status: "Chặn",
            error: "Orders lỗi; xử lý Orders rồi chạy lại.",
          };
          setJobs([...next]);
          continue;
        }
        next[i] = { ...job, status: "Đang import", error: undefined };
        setJobs([...next]);
        try {
          const form = new FormData();
          form.set("file", job.file);
          form.set("shopCode", job.shop);
          form.set("boId", "ms-linh");
          form.set("action", "validate");
          const url = `/api/fl/bo-${job.kind}/preview`;
          const check = await fetch(url, { method: "POST", body: form });
          const preview = await check.json();
          if (!check.ok || !preview.success || preview.summary?.blocked)
            throw Error(
              preview.error ||
                preview.summary?.validationDetails
                  ?.filter(
                    (v: { status: string }) => v.status !== "SKIPPED_TIKTOK",
                  )
                  .map(
                    (v: { orderId: string; message: string }) =>
                      `${v.orderId}: ${v.message}`,
                  )
                  .join("; ") ||
                "Preview còn lỗi.",
            );
          form.set("action", "import");
          if (job.kind === "cogs") {
            form.set("previewToken", preview.summary.previewToken);
            form.set("approvedKeys", "[]");
          }
          const res = await fetch(url, { method: "POST", body: form });
          const p = await res.json();
          if (!res.ok || !p.success) throw Error(p.error || "Import lỗi.");
          const r = p.importResult;
          next[i] = {
            ...job,
            done: true,
            status: `Xong: thêm ${r?.insertedCount ?? 0}, cập nhật ${r?.updatedCount ?? r?.replacedCount ?? 0}, bỏ qua ${r?.skippedCount ?? 0}`,
          };
        } catch (e) {
          next[i] = {
            ...job,
            status: "Lỗi",
            error: e instanceof Error ? e.message : "Import lỗi",
          };
          if (job.kind === "orders") ordersFailed = true;
        }
        setJobs([...next]);
      }
      setMessage(
        "Đã hoàn tất lượt import. Có thể chạy lại file lỗi; file thành công sẽ được bỏ qua.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import nhanh cả thư mục · Ms. Linh</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Orders → Items → Statement → COGS chung. COGS thay đổi tự cập nhật các
          cột nguồn; không cần duyệt từng dòng.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="rounded-md border-2 border-dashed p-5 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            if (busy) return;
            try {
              await load(await droppedFiles(e.dataTransfer.items));
            } catch {
              setMessage("Không đọc được thư mục; hãy dùng nút chọn thư mục.");
            }
          }}
        >
          Chọn thư mục hoặc kéo thả vào đây
        </Button>
        <Input
          className="hidden"
          type="file"
          multiple
          ref={(node) => {
            input.current = node;
            node?.setAttribute("webkitdirectory", "");
          }}
          onChange={(e) => {
            if (e.target.files)
              void load(
                Array.from(e.target.files).map((file) => ({
                  file,
                  path: file.webkitRelativePath || file.name,
                })),
              );
            e.target.value = "";
          }}
        />
        {message && <p className="text-sm">{message}</p>}
        {multipleCogs && (
          <p className="text-destructive text-sm">
            Có nhiều file COGS. Chỉ giữ bản nguồn mới nhất cho lượt import này.
          </p>
        )}
        {overlappingOrders && (
          <p className="text-destructive text-sm">
            Nhiều file Orders chứa cùng Order ID. Bỏ bản trùng hoặc gộp file
            trước khi import để tránh ghi đè sai shop.
          </p>
        )}
        {duplicateStatements && (
          <p className="text-destructive text-sm">
            Có nhiều Statement cùng shop và tháng. Chỉ giữ một bản để tránh ghi
            đè lẫn nhau.
          </p>
        )}
        {!!jobs.length && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Tháng</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j, i) => (
                <TableRow key={j.path}>
                  <TableCell className="max-w-72 break-all">{j.path}</TableCell>
                  <TableCell>{j.kind ?? "Không rõ"}</TableCell>
                  <TableCell>
                    {j.shop || (
                      <Select
                        disabled={busy}
                        onValueChange={async (value) => {
                          if (!value) return;
                          setBusy(true);
                          try {
                            const updated = await analyze({
                              ...j,
                              shop: String(value),
                            });
                            setJobs((old) =>
                              old.map((v, k) => (k === i ? updated : v)),
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn shop" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="97DECOR">97Decor</SelectItem>
                          <SelectItem value="TIMOND">Timond</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>{j.month || "—"}</TableCell>
                  <TableCell>
                    <p>{j.status}</p>
                    {j.error && (
                      <p className="text-destructive text-xs max-w-96 break-words">
                        {j.error}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || j.done}
                      onClick={() =>
                        setJobs((old) => old.filter((_, k) => k !== i))
                      }
                    >
                      Bỏ file
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Button
          disabled={
            busy ||
            !jobs.length ||
            duplicateStatements ||
            overlappingOrders ||
            multipleCogs ||
            jobs.some((j) => !j.kind || !j.shop || !j.valid) ||
            jobs.every((j) => j.done)
          }
          onClick={() => void run()}
        >
          Import tất cả / chạy lại file lỗi
        </Button>
      </CardContent>
    </Card>
  );
}
