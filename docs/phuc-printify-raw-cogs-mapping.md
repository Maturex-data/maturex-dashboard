# Printify Team Phúc → RAW.COGS: đối chiếu ngày 07/10/2026

## Cấu hình

Các biến local (token chỉ lưu .env, không ghi trong tài liệu):
- PHUC_PRINTIFY_ACCESS_TOKEN
- PHUC_PRINTIFY_SHOP_ID=28185367
- PHUC_COGS_SPREADSHEET_ID=1QFRzd6-gZ9zrjUtywnTeQMotvAVL_0nGUqhAvRZ6_BM
- PHUC_COGS_SHEET_ID=58221536

Giữ riêng cấu hình Printify EC hiện có. Đây mới là cấu hình và khảo sát; chưa có adapter ghi Printify Team Phúc.

## Kết quả API thực tế

GET /v1/shops.json và GET /v1/shops/28185367/orders.json (phân trang 50 đơn): HTTP 200.
- Một shop FaithShine, sales_channel=disconnected.
- 213 đơn, supplier ID không trùng; từ 09/07/2026 đến 07/10/2026 (timestamp nguồn UTC).
- 213/213 metadata.order_type=manual.
- 0 đơn có metadata.shop_order_id; 0 có metadata.shop_order_label; 0 có currency.
- Có app_order_id dạng 28185367.213: đây là mã Printify, không phải Etsy Order ID.
- 3 reprint: giữ supplier ID riêng, không gộp vào đơn gốc hoặc tự coi là chi phí 0.
- Trạng thái: in-production, fulfilled, canceled. Giữ nguyên, không tự đổi fulfilled thành Completed.
- Tất cả quantity hiện là 1. Tổng line_items.cost bằng total_price ở 213/213 đơn; tổng line_items.shipping_cost bằng total_shipping ở 213/213 đơn.

## Sheet đích thực tế

RAW.COGS: ghi chú hàng 1, hàng 2 rỗng, header A:N ở hàng 3, dữ liệu từ hàng 4.
RAW.Orders: header hàng 1, hiện chưa có dòng dữ liệu; không map được Store.
Không dùng layout Linh/Nam (dữ liệu từ hàng 3) để ghi vào file Phúc.

## Mapping

| Cột đích | Nguồn / xử lý |
| --- | --- |
| Etsy Order ID | Trống: manual orders không có ID Etsy. Không lấy app_order_id thay thế. |
| Supplier Order ID | id Printify |
| Store | Chưa xác định. FaithShine là tên shop Printify, chưa chứng minh thuộc Evernest/Orivia/Kindlora. |
| Supplier | PRINTIFY |
| Source date | created_at; giữ timezone UTC từ nguồn, chốt quy tắc ngày trước khi sync. |
| Status nguồn | status nguyên bản |
| Currency | Trống: orders API không cung cấp, không tự gán USD. |
| Production cost | Tổng line_items.cost / 100, một dòng cho cả đơn. Quantity > 1 cần xác minh ý nghĩa cost trước khi nhân. |
| Shipping cost | total_shipping / 100; không cộng thêm shipping từng item gây lặp. |
| Tax | total_tax / 100 |
| Other cost | Trống: không có trường tương ứng. |
| Total cost nguồn | Chưa có trường tổng debit/invoice được xác nhận. Có thể tính Production + Shipping + Tax, nhưng đây là tổng tính lại; ghi chú Sheet yêu cầu tổng gốc không công thức. Không tự lấy total_price làm tổng đơn gồm shipping/tax. |
| Source line ID | Có thể sinh PRINTIFY:<shop_id>:<id> làm khóa truy vết, cần ghi rõ là giá trị adapter tạo. |
| Source file | Tên bản snapshot API lưu trước khi sync; chưa có export file nguồn để ghi giá trị này. |

Đơn mẫu: production 23.57 + shipping 23.49 + tax 0 = 47.06 tổng tính lại. total_price nguồn = 23.57, không phải 47.06.

Tài liệu Printify gọi total_price là retail price, line_items.cost là fulfillment cost, các số tiền dùng cents:
https://developers.printify.com/
Do đó phải phân biệt kết quả kiểm tra thực tế với định nghĩa trong tài liệu; chưa khẳng định tổng tính lại là số tiền đã bị trừ hoặc invoice paid.

## Kết luận

Cấu trúc 14 cột có thể tiếp nhận dữ liệu Printify theo adapter một dòng/đơn, nhưng chưa đủ dữ liệu để đối soát Etsy/P&L: thiếu Etsy Order ID, Store, Currency; tổng chi phí cần thống nhất cách ghi.
Chưa ghi hoặc clear bất kỳ ô nào trên Google Sheet. Chưa triển khai sync tự động.

## Cập nhật header sau khi người dùng chốt

Ngày 07/10/2026: người dùng đã xóa Source line ID và Source file. Đã xác minh A:L hàng 3 là 12 cột gốc, sau đó bổ sung M:X tại hàng 3:

| Cột | Header | Nguồn API |
| --- | --- | --- |
| M | Recipient name | address_to.first_name + last_name |
| N | Phone | address_to.phone |
| O | Email | address_to.email |
| P | Address 1 | address_to.address1 |
| Q | Address 2 | address_to.address2 |
| R | City | address_to.city |
| S | State / Region | address_to.region |
| T | Postal code | address_to.zip |
| U | Country | address_to.country |
| V | Items name | line_items[].metadata.title, ghép bằng ; |
| W | Items quantity | Tổng line_items[].quantity |
| X | Items SKU | line_items[].metadata.sku, ghép bằng ; |

Hiện RAW.COGS có 24 cột A:X, dữ liệu từ hàng 4. Header đã đọc lại xác minh; chỉ thêm header và định dạng, chưa ghi orders. Hai cột truy vết đã xóa không được tạo lại. Giữ giá trị điện thoại/mã bưu chính dạng text khi viết adapter.

## Lần đẩy thử đã được người dùng yêu cầu

Đã đọc 214 đơn mới nhất và thêm 214 dòng vào RAW.COGS từ hàng 4 (một đơn mới so với lần khảo sát 213 đơn). Đọc lại xác minh từng ô vừa ghi thành công; header/ghi chú và dòng ngoài Printify giữ nguyên. Mỗi đơn một dòng, tiền chia 100, Production gom line_items.cost (quantity của mọi item trong lần chạy này đều 1). Giữ timestamp nguồn cùng timezone. Etsy Order ID, Store, Currency, Other cost và Total cost nguồn để trống; không tạo lại Source line ID/Source file. Đây là đẩy thử một lần, chưa có sync tự động hoặc nút Printify trên UI.

## Card đồng bộ trên trang BO

Tab Mr. Phúc hiển thị Printify; Fastway chỉ hiển thị trong tab Ms. Linh. Server action fl-printify yêu cầu admin đã đăng nhập và sử dụng cấu hình PHUC_* phía server. Có chế độ tháng/khoảng ngày/toàn bộ, lọc theo created_at trong phạm vi UTC+7. Printify được đọc đủ trang rồi lọc local, không giả tham số API không được xác minh. Sync kiểm tra header trước, khóa PostgreSQL theo spreadsheet/gid, đọc lại trước ghi và xác minh sau ghi. Supplier Order ID là khóa chống trùng trong nguồn PRINTIFY. Chỉ cập nhật ô nguồn thay đổi, giữ mapping và dữ liệu API không cung cấp; không clear Sheet. Item có quantity khác 1 hiện dừng trước ghi để xác minh ý nghĩa cost, không tự nhân chi phí.

## GitHub Actions lúc nửa đêm

Workflow `.github/workflows/phuc-printify-sync-cron.yml`: 17:00 UTC hằng ngày = 00:00 giờ Việt Nam ngày kế tiếp. Có workflow_dispatch để chạy thủ công. Chỉ chạy adapter Printify Team Phúc, không gọi các luồng EC/Microm/Fastway. Quét toàn bộ để cập nhật trạng thái đơn cũ, bỏ qua dòng không đổi. Concurrency GitHub và khóa DB bảo vệ chạy đồng thời; lỗi xác minh trả exit code 1. Secrets PHUC_* riêng, OAuth Google/DB dùng kết nối dự án hiện có. Workflow phải nằm trên main mới chạy theo lịch; GitHub có thể khởi chạy trễ khi tải cao.
