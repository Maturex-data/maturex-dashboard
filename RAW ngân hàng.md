# RAW ngân hàng — cấu trúc và nguồn Airwallex

Tài liệu này ghi lại cấu trúc và quy tắc nguồn cho tab `RAW ngân hàng`, cùng kết quả kiểm tra Airwallex trên tab `Airwallex API test`. Không lấy dữ liệu từ database để thay cho API khi đối soát nguồn.

## Phân tách nguồn

`RAW ngân hàng` chỉ dành cho giao dịch Airwallex đã ghép với lịch sử số dư ví cash. Shopify Payments API không trả pháp nhân Airwallex, số dư ví, Card ID, số thẻ/tài khoản Airwallex hoặc trạng thái đối soát với `balances/history`; tuyệt đối không ghi dữ liệu Shopify vào tab này để lấp các cột còn thiếu.

Dữ liệu Shopify thuộc tab `RAW sàn` và có tài liệu riêng ở `RAW sàn.md`. Ngày 30/09/2026, trước khi sửa luồng, `RAW ngân hàng` còn 1.223 hàng dư từ lần ghi Shopify cũ (chỉ còn trạng thái đối soát và payout ở S:T, các cột nguồn chính đã trống). Đã lưu snapshot trước khi thay tại `/private/tmp/maturex-raw-bank-shopify-backup-2026-09-30.json` rồi thay bằng dữ liệu Airwallex; đây là lịch sử lỗi, không phải quy tắc đồng bộ.

## Đích và phạm vi

- Spreadsheet ID: `1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU`.
- Tab thử: `Airwallex API test` (`gid=166749552`). Tab đích: `RAW ngân hàng` (`gid=373655258`).
- Header ở hàng 1; dữ liệu từ hàng 2, cột A:V. Phải đọc và kiểm tra header thực tế trước mỗi lần ghi; không dùng vị trí cột của bản cũ A:U vì cột `Tồn` đã được thêm vào I.
- Snapshot đã xác minh: 698 giao dịch `SETTLED` từ 01/01/2026 đến hết 30/09/2026 theo `Asia/Ho_Chi_Minh`, chỉ tiền tệ USD trong đợt này. Đây là số dòng của lần thử, không phải số dòng cố định cho mọi lần sync.
- Google OAuth lấy từ connection đã lưu của dự án (`getGoogleDriveAccess()` ở `src/lib/ec-drive.ts`). Không lưu key, token hoặc nội dung `.env` trong tài liệu.

## Schema A:V

| Cột | Header hiện tại | Nguồn và quy tắc |
|---|---|---|
| A | Ngày ghi sổ | Ngày theo `Asia/Ho_Chi_Minh` của `balances/history.posted_at` sau khi nối đúng giao dịch. Không lấy ngày từ `created_at` và gọi là ngày ghi sổ. |
| B | Giờ/múi giờ | `balances/history.posted_at` nguyên chuỗi có offset; không tự thay bằng thời gian máy chạy. |
| C | Pháp nhân | `GET /api/v1/account` → `account_details.business_details.business_name`, chỉ dùng khi `account.id` khớp `AIRWALLEX_ACCOUNT_ID` của connection. Snapshot: `MatureX LLC`. |
| D | Tài khoản/thẻ | `Card` khi là `ISSUING_CAPTURE` đã nối được Card ID; các giao dịch khác ghi `Tài khoản`. Đây là nhãn phân loại do hệ thống đặt, không phải nguyên văn field API. |
| E | Card ID | `issuing/transactions.card_id` sau khi khớp `financial_transactions.id = issuing/transactions.transaction_id`; giao dịch không phải thẻ để trống. |
| F | Tiền tệ | `financial_transactions.currency`. Không trộn các tiền tệ trong cùng một tổng hay một chuỗi số dư. |
| G | Thu | Khi `financial_transactions.net > 0`, ghi `net`. Còn lại để trống. |
| H | Chi | Khi `financial_transactions.net < 0`, ghi trị tuyệt đối của `net`. Còn lại để trống. Không cộng phí lần hai vào `net`. |
| I | Tồn | `balances/history.balance` của **chính dòng lịch sử số dư đã ghép duy nhất**; là số dư `account_type=cash` sau giao dịch, không phải tổng các Global Account hoặc phép cộng dồn tự tính. Không ghép được thì để trống và báo ngoại lệ. |
| J | Dự án | Mapping nội bộ chưa được xác minh từ API; để trống. Không suy ra từ merchant hoặc tên thẻ. |
| K | Store | Mapping nội bộ chưa được xác minh từ API; để trống. |
| L | Loại giao dịch | `financial_transactions.transaction_type`, ví dụ `DEPOSIT`, `ISSUING_CAPTURE`, `PURCHASE`, `PAYOUT`. Giữ giá trị gốc. |
| M | Mã chuyển nội bộ | Chỉ ghi khi nối được đúng ID chuyển nội bộ từ endpoint có quyền truy cập. Hiện để trống; `batch_id` hoặc `source_id` không mặc nhiên là mã chuyển nội bộ. |
| N | Mã payout/deposit | Với `DEPOSIT`: `financial_transactions.source_id` chỉ sau khi khớp `deposits.id`/`deposit_id`. Với `PAYOUT`/`PAYOUT_REVERSAL`: chỉ ghi khi khớp `payments.payment_id`. Đây là **ID Airwallex**, không phải Shopify payout ID. Loại khác để trống. |
| O | Mã giao dịch | `financial_transactions.id` nguyên văn dạng text. Dùng làm khóa đối chiếu trong cùng account/nguồn; không biến thành số. |
| P | Diễn giải | `financial_transactions.description`; với giao dịch thẻ thiếu mô tả có thể lấy `issuing/transactions.merchant.name` sau khi nối đúng giao dịch. |
| Q | Nguồn file | Đợt API thử ghi `/api/v1/financial_transactions` để chỉ nguồn chính. Đây là nhãn do tiến trình sync ghi, không phải tên file Airwallex trả về. |
| R | Dòng nguồn | API không có số dòng file ổn định; để trống. |
| S | Đối soát | Kết quả kiểm tra nội bộ, ví dụ khớp financial transaction với balance history; không coi là trạng thái API. |
| T | Ghi chú | Ngoại lệ/phạm vi xác minh của từng dòng. Không dùng để giấu trường thiếu mapping. |
| U | Số thẻ/tài khoản | Giao dịch thẻ: `issuing/transactions.masked_card_number`. Không phải thẻ: chỉ ghi `global_accounts.account_number` nếu `deposits.global_account_id` khớp **đúng** `global_accounts.id`. Không gán một STK chung cho mọi giao dịch `cash`; thiếu liên kết thì để trống. Giữ STK là text để không mất số 0 đầu. |
| V | Tên thẻ | `issuing/cards/{card_id}.nick_name`, fallback `issuing/transactions.card_nickname` khi Card ID đã được xác minh. Không có thẻ thì để trống. |

## Airwallex API cần gọi

Base URL production: `https://api.airwallex.com`. Chỉ dùng sandbox khi cấu hình `AIRWALLEX_ENV=sandbox`. Gửi `Authorization: Bearer {token}` cho các GET; không ghi credential vào log.

1. **Đăng nhập:** `POST /api/v1/authentication/login` với các header `x-api-key`, `x-client-id`, `x-login-as`. Lấy token ngắn hạn để gọi các endpoint dưới đây. `x-login-as` lấy từ `AIRWALLEX_ACCOUNT_ID`.
2. **Pháp nhân:** `GET /api/v1/account`. Kiểm tra `id` bằng account ID đã cấu hình trước khi dùng tên pháp nhân.
3. **Giao dịch tiền chính:** `GET /api/v1/financial_transactions` với `from_created_at`, `to_created_at`, `page_num`, `page_size`. Đi hết phân trang; lọc `status=SETTLED` và đúng khoảng ngày báo cáo theo ICT. Giữ payload gốc, đặc biệt `id`, `source_id`, `source_type`, `transaction_type`, `currency`, `amount`, `net`, `fee`, `settled_at`, `created_at`, `description`, `status`. Đây là nguồn của F–H, L, O, P; **không** lấy `amount` để cộng thêm phí khi `net` đã bao gồm tác động phí.
4. **Lịch sử số dư:** `GET /api/v1/balances/history` với `account_type=cash`, `currency=USD`, `from_post_at`, `to_post_at`, `page_size`, `page` cursor. Chia khoảng thời gian tối đa 7 ngày như lần thử; đi hết `page_after`. Dùng `posted_at`, `balance`, `amount`, `source`, `transaction_type`, `currency`, `account_type` để nối A, B, I. `GET /api/v1/balances/current` chỉ giúp xác minh có đúng ví `cash` USD, **không** dùng số dư hiện tại lặp lên từng giao dịch lịch sử.
5. **Giao dịch thẻ:** `GET /api/v1/issuing/transactions` với `from_created_at`, `to_created_at`, `page_num`, `page_size`. Nối chính xác `transaction_id = financial_transactions.id`; lấy `card_id`, `masked_card_number`, `card_nickname`, `retrieval_ref` và merchant khi có. Gọi `GET /api/v1/issuing/cards/{card_id}` để xác nhận Card ID và lấy `nick_name`.
6. **Deposit:** `GET /api/v1/deposits` với `from_created_at`, `to_created_at`, `page_num`, `page_size`; chia cửa sổ tối đa 30 ngày để không vượt giới hạn API đã gặp. Nối `financial_transactions.source_id = deposits.id`/`deposit_id`. Chỉ dùng `global_account_id` của deposit nếu response có field này.
7. **Global Account / STK:** `GET /api/v1/global_accounts?page_size=100` (phân trang tiếp nếu `has_more`). Nối `deposits.global_account_id = global_accounts.id`, rồi mới lấy `account_number` cho U. **Global Account nhận tiền không đồng nghĩa ngăn ví cash**; không dùng ID này làm cột D hoặc suy ra STK của mọi giao dịch.
8. **Payout Airwallex:** `GET /api/v1/payments/{source_id}` chỉ cho giao dịch `PAYOUT`/`PAYOUT_REVERSAL`; xác nhận `payment_id = source_id` trước khi ghi N.

### Khóa ghép balance history

Ghép ứng viên bằng `history.source`, `history.transaction_type` và `history.amount` với `financial.source_id`/`financial.id`, cùng tiền tệ. Riêng `ISSUING_CAPTURE`, thử `issuing/transactions.retrieval_ref` trước vì đó là `history.source` của nhiều dòng thẻ. Chỉ chấp nhận khi có **đúng một** dòng lịch sử, `account_type=cash`, `currency` bằng giao dịch và `amount` khớp `financial.net`. Nếu trùng ứng viên hoặc không khớp, dừng/báo lỗi; không lấy dòng gần thời gian nhất hay tự tính Tồn. Một số dòng có cùng timestamp, loại và số tiền, nên ba trường đó **không đủ** để ghép duy nhất.

## Quy tắc đồng bộ an toàn

1. Đọc header A:V, kiểm tra đủ 22 tên cột như bảng trên. Đọc toàn bộ các ID hiện tại ở O và phát hiện ID trùng trước khi cập nhật.
2. Lấy hết các trang API của kỳ cần đồng bộ; giữ payload nguồn để truy vết và kiểm tra số dòng từng loại. Dùng một múi giờ báo cáo `Asia/Ho_Chi_Minh`; giữ timestamp gốc có offset ở B.
3. Nối từng dòng bằng ID nguồn. Kiểm tra `currency`, loại giao dịch, `net` và `posted_at` trước khi ghi Tồn/STK. Không gán STK từ `payments.beneficiary.bank_details`: đó có thể là tài khoản **người nhận**, không phải tài khoản của MatureX.
4. Trước khi ghi, đọc lại Sheet để phát hiện người khác vừa sửa. Với cập nhật từng cột, dùng Google Sheets `spreadsheets.values:batchUpdate` và `valueInputOption=RAW`, chỉ ghi các range cần thay đổi; không ghi đè cả hàng hay xóa công thức/giá trị thủ công. Riêng lần chuyển nguồn từ Shopify sang Airwallex đã được xác nhận, chỉ thay A2:V của tab này sau khi kiểm tra không có công thức.
5. Đọc lại sau khi ghi; xác minh đủ số hàng, ID giao dịch và giá trị các cột từ Airwallex. Không tự động chép tab thử sang `RAW ngân hàng`; dữ liệu chính thức lấy từ Airwallex API.

## Kết quả đã xác minh và giới hạn

Lần thử trên `Airwallex API test`: 698 dòng `SETTLED`; 698 dòng có pháp nhân và Tồn từ balance history; 218 dòng thẻ có Card ID/số che/tên thẻ; 335 dòng deposit có STK nối được qua Global Account; 145 dòng không phải thẻ vẫn trống U vì chưa có chứng cứ cho STK. Mã deposit/payout Airwallex đã xác minh trên 340 dòng. `Dự án`, `Store`, `Mã chuyển nội bộ` chưa có mapping nên để trống.

Sau lần đồng bộ chính thức ngày 30/09/2026: `RAW ngân hàng` có 698 dòng Airwallex với 698 ID duy nhất, 0 dòng Shopify và 0 dòng thiếu nguồn; 698 dòng có pháp nhân và Tồn, 218 dòng có Card ID, 335 dòng không phải thẻ có STK xác minh. Đã so cả 22 cột của 698 dòng với tab `Airwallex API test`: không có sai khác. `RAW sàn` giữ nguyên 1.222 dòng tại thời điểm kiểm tra.

Các script điều tra cục bộ ở `scripts/export-airwallex-raw-bank-review.mjs` và `scripts/enrich-airwallex-raw-bank-review.mjs`; thư mục `scripts` đang bị ignore theo cấu hình repo, vì vậy **không coi hai script này là mã đã được commit/deploy**. File Excel kiểm tra được tạo tại `/Users/tatuanthanh/Downloads/data/airwallex-raw-bank-review-2026-enriched.xlsx`. Khi xây sync chính thức, đưa logic vào module có version control, test join/khóa chống trùng, và không phụ thuộc vào file Excel cục bộ.
