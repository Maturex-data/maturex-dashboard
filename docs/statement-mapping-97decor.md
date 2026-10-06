# Bảng Mapping 10 Cột: Etsy Payment Statement → RAW.Statement (97Decor - Ms. Linh)

Tài liệu này xác định quy tắc chuyển đổi, ánh xạ chi tiết 10 cột từ file xuất nguồn **Etsy Payment Statement CSV** sang cấu trúc bảng đích **RAW.Statement** trên Google Sheet cho nhóm BO **Ms. Linh** (Shop **97Decor**).

- **Google Spreadsheet ID:** `1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do`
- **Tab đích:** `RAW.Statement` (Sheet ID / GID: `69264119`)
- **Link Google Sheet:** `https://docs.google.com/spreadsheets/d/1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do/edit?gid=69264119#gid=69264119`
- **BO phụ trách:** `ms-linh` (Ms. Linh)
- **Shop áp dụng:** `97DECOR`
- **Giá trị cột Store:** `97Decor`
- **File mẫu kiểm tra:** `/Users/tatuanthanh/Downloads/linh/97decor_etsy_statement_2026_9 (1).csv` (1,587 dòng giao dịch)
- **File preview kiểm tra:** `/Users/tatuanthanh/Downloads/data/linh-97decor-statement-preview.xlsx`

---

## 1. Bảng Ánh Xạ Chi Tiết 10 Cột

| STT | Cột Đích (RAW.Statement) | Cột Nguồn (Etsy CSV) | Kiểu Dữ Liệu | Bắt Buộc | Quy Tắc Xử Lý & Bảo Toàn Dữ Liệu |
|:---|:---|:---|:---|:---:|:---|
| 1 | **Date** | Date | String | Có | Giữ nguyên chuỗi ngày nguồn (`30-Sep-26`). Dùng để xác minh tháng giao dịch (`2026-09`). |
| 2 | **Type** | Type | String | Có | Loại giao dịch: `Marketing`, `Tax`, `Fee`, `Sale`, `Deposit`, `Buyer Fee`, `Refund`. Giữ nguyên text. |
| 3 | **Title** | Title | String | Có | Tiêu đề giao dịch (vd: `Payment for Order #4187446807`, `Listing fee`, `Etsy Ads`). Giữ nguyên text, **không chuyển ID trong Title thành số**. |
| 4 | **Info** | Info | String | Không | Thông tin chi tiết giao dịch (vd: `Order #4187446807`, `Listing #4548450225`). Giữ nguyên text, **không chuyển ID thành số**. |
| 5 | **Currency** | Currency | String | Có | Đơn vị tiền tệ (`USD`). Giữ nguyên, không quy đổi tiền tệ. |
| 6 | **Amount** | Amount | String | Không | **Bảo toàn 100% chuỗi tiền nguồn**, gồm dấu âm, dấu ngoặc, ký hiệu `$` và `--` (vd: `$62.48`, `--`). **Tuyệt đối không biến `--` hoặc ô trống thành 0**. |
| 7 | **Fees & Taxes** | Fees & Taxes | String | Không | Giữ nguyên chuỗi tiền phí & thuế (vd: `($15.00)`, `-$0.20`, `--`). Không tự tính lại. |
| 8 | **Net** | Net | String | Không | Giữ nguyên chuỗi tiền thực nhận Net từ Etsy (vd: `$62.48`, `($15.00)`). **Không tự tính lại Net hoặc gom giao dịch**. |
| 9 | **Tax Details** | Tax Details | String | Không | Giữ nguyên chi tiết thuế (vd: `--`). Không biến `--` thành 0. |
| 10 | **Store** | *(Tự động điền)* | String | Có | **Cố định là `97Decor`** cho BO Ms. Linh. Không lấy từ cột phụ thứ 10 của CSV. |

### Cột Store (Cột thứ 10 trên Sheet):
- Cột thứ 10 trên Sheet đích `RAW.Statement` là cột `Store`, được tự động gán cố định là `97Decor` cho shop 97Decor.
- File CSV của Etsy có 9 cột header chuẩn. Dữ liệu tiền gốc được lưu giữ nguyên vẹn tại cột F (`Amount`).

---

## 2. Cơ Chế Import Lại & Chống Mất Dòng

### Tại sao không thể Deduplicate đơn giản theo Date + Type + Title + Amount?
- Trong sao kê Etsy Payment Statement, có rất nhiều dòng giao dịch **hoàn toàn giống nhau nhưng đều hợp lệ**.
- Ví dụ: Trong cùng một ngày, shop có thể phát sinh nhiều khoản phí niêm yết giống hệt nhau (`Type: Fee`, `Title: Listing fee`, `Amount: --`, `Fees & Taxes: -$0.20`, `Net: -$0.20`).
- Nếu áp dụng cơ chế deduplicate theo các trường này, các giao dịch hợp lệ sẽ bị nuốt chửng, dẫn đến **thất thoát doanh thu và chi phí**.

### Giải pháp thay thế theo Tháng Xác Minh (Monthly Replacement):
1. **Xác minh tháng chặt chẽ:**
   - Trích xuất tháng từ toàn bộ các dòng giao dịch trong file (vd: `30-Sep-26` -> `2026-09`).
   - Yêu cầu tất cả dòng trong file phải thuộc cùng 1 tháng duy nhất.
   - Đối chiếu với tháng trong tên file (`97decor_etsy_statement_2026_9 (1).csv` -> `2026-09`). Nếu không khớp, **lập tức dừng lại và báo lỗi**.
2. **Cơ chế ghi đè an toàn khi import lại:**
   - Đọc dữ liệu hiện có trong tab `RAW.Statement`.
   - Lọc bỏ các dòng cũ thỏa mãn đồng thời cả 2 điều kiện:
     `Store === "97Decor"` (hoặc `97decor`) **VÀ** `Date` thuộc tháng được xác minh (`2026-09`).
   - **Bảo toàn 100% dữ liệu:**
     - Giữ nguyên toàn bộ dòng của các shop khác (vd: Shop `Timond` hiện có 397 dòng trong tab).
     - Giữ nguyên toàn bộ dòng của shop `97Decor` ở các tháng khác.
   - Nối toàn bộ 1,587 dòng mới vào danh sách theo đúng thứ tự nguồn.
   - Cập nhật tab bằng Google Sheets `batchUpdate`.

---

## 3. Khóa An Toàn Phía Server & UI

- Nút Import trên giao diện `/ecombius/bo-import` đối với loại **Etsy Payment Statement** được hiển thị ở trạng thái **Khóa an toàn (Lock)** với nhãn *"Chờ duyệt preview (Đang khóa ghi thật)"*.
- API `/api/fl/bo-statement/preview` từ chối hành động `action="import"` với mã lỗi `403 Forbidden` cho đến khi người dùng kiểm tra file preview XLSX và chính thức duyệt mở khóa.
- Người dùng có thể tải file preview XLSX chuẩn hóa 3 tabs:
  1. `RAW.Statement`: 10 cột dữ liệu chuẩn hóa.
  2. `Mapping`: Bảng đặc tả ánh xạ chi tiết.
  3. `Thống kê & Cảnh báo`: Thống kê dòng, phân bổ loại giao dịch, giải thích cơ chế thay thế an toàn.
