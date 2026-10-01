# RAW sàn — cấu trúc và hướng dẫn đồng bộ Shopify

Tài liệu này ghi lại schema, nguồn dữ liệu và quy tắc ghép cột của tab **RAW sàn** để có thể tiếp tục đồng bộ khi mở lại công việc.

## Đích Google Sheet

- Spreadsheet ID: `1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU`
- Tab: `RAW sàn`
- Header: hàng 1, dữ liệu bắt đầu từ hàng 2, cột A:Y.
- Store hiện tại: **The Deerly** (`the-deerly.myshopify.com`).
- Google OAuth hiện được dự án kết nối bằng tài khoản `data.maturex@gmail.com`.

Không đưa access token, refresh token, Shopify token hay giá trị `.env` vào tài liệu hoặc commit.

## Schema 25 cột

| Cột | Tên cột | Nguồn và cách điền |
|---|---|---|
| A | Ngày giao dịch | `processed_at` của balance transaction, hiển thị theo múi giờ `Asia/Ho_Chi_Minh`. |
| B | Transaction dates (phạm vi giao dịch) | Gom các ngày `processed_at` theo `payout_id`, bỏ transaction có `type=payout`, gộp ngày liên tiếp thành khoảng. Không có payout thì để trống. |
| C | Dự án | Nhãn nội bộ, Shopify API không trả về; hiện để trống. |
| D | Store | Tên store theo cấu hình dự án: `The Deerly`. Đây là mapping nội bộ, không phải field của từng transaction. |
| E | Sàn/cổng thanh toán | Hằng số `Shopify Payments` cho các dòng lấy từ Shopify Payments API. |
| F | Pháp nhân | Thông tin nội bộ, không có trong API; để trống cho tới khi có mapping pháp nhân được xác nhận. |
| G | Tiền tệ | `currency` của balance transaction hoặc payout. |
| H | Mã order | Ghép `source_order_id` của balance transaction với Shopify Order `id`, lấy `name` (ví dụ `#DEER...`). Nếu không tìm thấy tên order thì giữ ID nguồn nếu có. |
| I | Mã payout/deposit | `payout_id` của transaction; với payout record dùng `id`. |
| J | Loại giao dịch | `type` của balance transaction: ví dụ `charge`, `refund`, `debit`, `credit`, `dispute`, `payout`. |
| K | Trạng thái gốc | `payout_status` của balance transaction; payout record dùng `status`. Đây là trạng thái payout, không phải trạng thái payment riêng của order. |
| L | Nhóm trạng thái | Suy ra từ K: `paid` → **Đã thanh toán**; `pending`, `scheduled`, `in_transit` → **Đang xử lý**; `failed` → **Thất bại**; `canceled`/`cancelled` → **Đã hủy**. Giá trị không nhận diện được thì để trống. |
| M | Số tiền gross | `amount` của balance transaction. |
| N | Phí | `fee` của balance transaction. Giữ số 0 nếu API trả `0`; không để ô trống chỉ vì không phát sinh phí. |
| O | Thuế | Shopify Orders `currentTotalTaxSet.shopMoney.amount` là thuế ở cấp order, không phải tax field của balance transaction. Chỉ ghi lên dòng `debit` khi `abs(amount)` của debit khớp chính xác với thuế order; cách này tránh lặp thuế lên cả debit và charge. Nếu không ghép chắc chắn được thì để trống. |
| P | Hoàn/chargeback | Ghi `amount` của transaction khi `type` là `refund`, `dispute` hoặc `chargeback`; loại khác để trống. Giữ dấu âm/dương như API. |
| Q | Reserve/hold | Payout summary có `reserved_funds_gross_amount` và `reserved_funds_fee_amount`, nhưng đây là tổng ở cấp payout. Không lặp tổng payout lên từng transaction; để trống trên các dòng transaction. Nếu sau này có dòng summary riêng, cần thống nhất rõ gross hay fee được ghi ở đây. |
| R | Net payout | `net` của balance transaction. |
| S | Ngày dự kiến | Không có field ngày dự kiến riêng trong response đang dùng; để trống. Không tự dùng ngày payout làm ngày dự kiến. |
| T | Ngày gửi | Ghép `payout_id` với payout `id`, lấy `date`. Transaction chưa có payout thì để trống. |
| U | Nguồn file | API không trả tên file nguồn; để trống. |
| V | Dòng nguồn | API không có số dòng file nguồn; để trống. |
| W | Ghi chú | `adjustment_reason` nếu API trả về; không có thì để trống. |
| X | Payment provider | Hằng số `Shopify Payments`, theo endpoint và nguồn tích hợp. |
| Y | Lấy lúc (múi giờ) | Thời điểm snapshot do tiến trình lấy dữ liệu ghi nhận, chuyển sang `Asia/Ho_Chi_Minh` (ICT). Đây là metadata của lần đồng bộ, không phải field Shopify. |

## Shopify API cần gọi

Dùng API version từ `SHOPIFY_API_VERSION` trong môi trường dự án; hiện fallback trong code là `2026-07`. Phân trang theo `Link` header cho REST và `pageInfo.endCursor` cho GraphQL. Mọi khoảng thời gian lọc theo tháng phải được dựng nhất quán với múi giờ Việt Nam; truy vấn `processed_at` dùng UTC và lọc lại để bao gồm khoảng `[đầu tháng ICT, đầu tháng sau ICT)`.

### 1. Balance Transactions — dữ liệu chính của RAW sàn

```http
GET https://{SHOPIFY_STORE_DOMAIN}/admin/api/{API_VERSION}/shopify_payments/balance/transactions.json?processed_at_min={UTC_START}&processed_at_max={UTC_END}&limit=250
X-Shopify-Access-Token: {SHOPIFY_ACCESS_TOKEN}
```

Các field cần giữ trong payload: `id`, `type`, `processed_at`, `currency`, `amount`, `fee`, `net`, `payout_id`, `payout_status`, `source_id`, `source_type`, `source_order_id`, `source_order_transaction_id`, `adjustment_reason`.

Có thể lọc theo một payout để lập phạm vi ngày giao dịch:

```http
GET https://{SHOPIFY_STORE_DOMAIN}/admin/api/{API_VERSION}/shopify_payments/balance/transactions.json?payout_id={PAYOUT_ID}&limit=250
```

### 2. Payouts — trạng thái, ngày payout và summary

```http
GET https://{SHOPIFY_STORE_DOMAIN}/admin/api/{API_VERSION}/shopify_payments/payouts.json?date_min={YYYY-MM-DD}&date_max={YYYY-MM-DD}&limit=250
X-Shopify-Access-Token: {SHOPIFY_ACCESS_TOKEN}
```

Dùng các field `id`, `status`, `date`, `currency`, `amount`, `summary`. Trong `summary`, reserve nằm ở `reserved_funds_gross_amount` và `reserved_funds_fee_amount`. `date` là ngày payout được Shopify trả về, không phải một field ETA riêng.

### 3. Orders — tên order và thuế cấp order

```http
POST https://{SHOPIFY_STORE_DOMAIN}/admin/api/{API_VERSION}/graphql.json
X-Shopify-Access-Token: {SHOPIFY_ACCESS_TOKEN}
Content-Type: application/json
```

Truy vấn tối thiểu để ghép order và thuế:

```graphql
query RawSànOrders($after: String, $first: Int!, $query: String!) {
  orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) {
    nodes {
      id
      name
      currentTotalTaxSet { shopMoney { amount } }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Ghép `source_order_id` với phần ID cuối của GraphQL Order `id` (dạng `gid://shopify/Order/...`). Thuế trong Orders là tổng thuế hiện tại của order; không coi nó là thuế riêng của mọi payment transaction.

## Google Sheets API và xác thực

Lấy Google access token qua OAuth connector/connection hiện có của dự án, không đọc token từ log và không hardcode token. Dự án có helper `getGoogleDriveAccess()` trong `src/lib/ec-drive.ts`. Sau khi xác nhận đúng spreadsheet và tab, đọc dữ liệu bằng Sheets values API; ghi nhiều cột bằng `spreadsheets.values:batchUpdate` với `valueInputOption: RAW`. Chỉ gửi các ranges cần sửa và đọc lại các ranges đó để xác minh số hàng/giá trị sau ghi.

```http
POST https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values:batchUpdate
Authorization: Bearer {PROJECT_OAUTH_ACCESS_TOKEN}
Content-Type: application/json
```

Không ghi lại toàn bộ A:Y nếu chỉ cần cập nhật một số cột: điều đó có thể xóa giá trị thủ công hoặc dữ liệu mới do người khác thêm.

## Cách làm mới tháng

1. Đọc và kiểm tra header A:Y của `RAW sàn`; dừng nếu header khác schema ở trên.
2. Lấy balance transactions cho khoảng tháng cần cập nhật; phân trang đầy đủ. Chuẩn hóa phạm vi tháng theo `Asia/Ho_Chi_Minh`.
3. Lấy payouts của cùng khoảng; lấy Orders đủ để ghép `source_order_id`, `name` và thuế.
4. Tạo một hàng cho mỗi balance transaction, map theo bảng 25 cột. Không tạo dữ liệu giả cho các cột API không cung cấp.
5. Tính nhóm trạng thái L; map thuế O theo quy tắc debit khớp số tiền tuyệt đối; chỉ điền reserve ở dòng summary riêng nếu có thiết kế rõ ràng.
6. Trước khi ghi, so sánh số dòng và khóa nghiệp vụ với dữ liệu đang có; tránh thêm trùng hoặc ghi nhầm tháng. Ghi theo batch từng cột/range cần cập nhật.
7. Đọc lại sheet sau khi ghi và xác minh số dòng, khoảng ngày, store, phí, trạng thái và thuế.

## Vị trí code liên quan và phạm vi hiện tại

- `src/lib/shopify-payments-rest-sync.ts`: gọi REST balance transactions, payouts, disputes và Orders REST; lưu Shopify payment records vào database. API version lấy từ `SHOPIFY_API_VERSION`.
- `src/lib/shopify-payments-sync.ts`: Shopify Payments GraphQL sync vào database, bao gồm balance transactions, payouts, disputes và refunds.
- `src/lib/shopify-raw-order-sync.ts`: Orders GraphQL sync; query hiện có `currentTotalTaxSet`.
- `src/lib/shopify-payout-sheet-sync.ts`: xuất payout summary sang tab `Store — Deerlys` (A:E). Đây không phải writer cho tab `RAW sàn`.

**Writer RAW sàn hiện có:** giao diện nằm ở `/ec/drive-sync`, thẻ `Shopify → RAW sàn`; backend là `src/app/api/ec/drive/shopify-raw/route.ts`; logic fetch/map/ghi sheet là `src/lib/shopify-raw-sheet-sync.ts`. Route chỉ cho phép admin. Writer kiểm tra đúng 25 header, thay các dòng tháng được chọn, giữ nguyên tháng khác và đọc lại để xác minh sau ghi. Không nhầm writer này với `shopify-payout-sheet-sync.ts`, vốn ghi tab `Store — Deerlys`.

## Snapshot đã cập nhật

Lần cập nhật được xác minh gần nhất: tháng **2026-09**, 1.218 dòng giao dịch Shopify Payments. Đã điền phí, nhóm trạng thái, 29 giá trị thuế khớp chính xác trên dòng debit, và thời điểm snapshot. Số liệu này là mốc tham chiếu, không thay thế việc truy vấn Shopify khi làm mới các tháng sau.
