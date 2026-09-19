# Shopify Data Export

Tài liệu này mô tả cách lấy dữ liệu đơn hàng từ Shopify Admin API về project
Maturex Dashboard.

## 1. Cấu hình credential

Tạo hoặc cập nhật file `.env` ở thư mục gốc project:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_admin_api_token
SHOPIFY_API_VERSION=2026-07
```

Không dùng tiền tố `NEXT_PUBLIC_` cho access token. Token chỉ được sử dụng ở
server-side và không được commit lên repository.

Access token cần có quyền đọc order. Nếu cần đọc các order cũ hơn giới hạn
truy cập mặc định của Shopify, app cần được cấp thêm quyền đọc toàn bộ order.

## 2. Test kết nối

Khởi động Next.js:

```bash
npm run dev
```

Gọi endpoint test:

```text
http://localhost:3000/api/shopify/test
```

Hoặc dùng curl:

```bash
curl http://localhost:3000/api/shopify/test
```

Endpoint trả về:

- Thông tin shop.
- 10 order mới nhất.
- Trạng thái kết nối và thông báo lỗi nếu credential hoặc permission chưa đúng.

Logic endpoint nằm tại:

- `src/lib/shopify.ts`
- `src/app/api/shopify/test/route.ts`

## 3. Export order theo tháng

Script export sử dụng Shopify REST Admin API, lấy `status=any`, lọc theo
`created_at`, tự động cursor pagination và lấy tối đa toàn bộ order trong
khoảng thời gian.

Chạy export:

```bash
npm run export:shopify
```

Khoảng thời gian hiện tại trong script là:

- Tháng 7/2026: `2026-07-01T00:00:00Z` đến trước `2026-08-01T00:00:00Z`.
- Tháng 8/2026: `2026-08-01T00:00:00Z` đến trước `2026-09-01T00:00:00Z`.

File script:

```text
scripts/export-shopify-orders.mjs
```

Kết quả được lưu trong thư mục `exports/`:

```text
exports/shopify-orders-july-2026.csv
exports/shopify-orders-august-2026.csv
exports/shopify-orders-july-august-2026.csv
```

## 4. Điều chỉnh tháng cần lấy

Mở `scripts/export-shopify-orders.mjs` và cập nhật mảng `periods`:

```js
{
  name: "september-2026",
  from: "2026-09-01T00:00:00Z",
  to: "2026-10-01T00:00:00Z",
}
```

Sau đó chạy lại:

```bash
npm run export:shopify
```

Thời gian lọc được tính theo UTC. Nên dùng mốc đầu tháng kế tiếp làm giá trị
`to` để tránh bỏ sót order ở thời điểm cuối tháng.

## 5. Cấu trúc CSV

Các object và array nested được bung thành cột riêng:

```text
customer.first_name
shipping_address.city
billing_address.zip
line_items[0].sku
line_items[0].quantity
transactions[0].amount
```

Như vậy dữ liệu chi tiết của order vẫn được giữ lại nhưng có thể mở và lọc
trực tiếp trong Excel hoặc Google Sheets.

## 5.1. Xuất Shopify Revenue Raw Data theo workbook mẫu

Khi cần file đúng cấu trúc `MatureX_Shopify_Revenue_Raw_Data_Template_v1.3.xlsx`,
chạy sau khi đã có file raw order gốc:

```bash
python3 scripts/create-shopify-revenue-workbook.py
```

Script dùng `exports/shopify-orders-july-august-2026-original.csv`, giữ lại các
sheet hướng dẫn và data dictionary của file mẫu, rồi tạo:

```text
exports/MatureX_Shopify_Revenue_Raw_Data_July_August_2026.xlsx
```

Workbook có ba bảng dữ liệu:

- `Orders`: một dòng cho mỗi order.
- `Order_Fulfillment_Items`: một dòng cho mỗi SKU trong từng fulfillment/mã vận đơn.
- `Refunds`: một dòng cho mỗi refund transaction x refund line item; refund không có SKU vẫn được giữ.

Các trường `processed_at_local`, `order_date`, `order_month` và các trường
fulfillment/refund local được quy đổi theo `America/Los_Angeles`. Dữ liệu raw
không bị đổi sang timezone máy tính; Excel lưu các datetime không kèm timezone
vì định dạng workbook không hỗ trợ timezone metadata.

## 6. Lưu ý bảo mật và vận hành

- Không đưa access token vào source code, screenshot, log hoặc file CSV chia sẻ
  công khai.
- Không thêm `.env` vào git.
- Nếu token bị lộ, hãy revoke token trong Shopify và tạo token mới.
- Shopify giới hạn tốc độ request. Script dùng cursor pagination và retry khi
  nhận HTTP `429`.
- CSV có thể có rất nhiều cột vì Shopify order chứa nhiều dữ liệu nested.

## 7. Export sao kê Airwallex

Sao kê được lấy từ Airwallex Financial Transactions API. Dữ liệu này gồm các
giao dịch ảnh hưởng đến số dư account như payout, conversion, deposit, fee,
transfer và payment.

### Cấu hình credential

Thêm các biến sau vào file `.env`:

```env
AIRWALLEX_CLIENT_ID=your_client_id
AIRWALLEX_API_KEY=your_scoped_api_key
AIRWALLEX_ACCOUNT_ID=your_account_id
AIRWALLEX_ENV=production
```

Scoped API key cần có quyền đọc Financial Transactions. Không dùng tiền tố
`NEXT_PUBLIC_` và không commit file `.env`.

### Cách lấy dữ liệu

Script sẽ:

1. Gọi Authentication API để lấy access token.
2. Gọi `GET /api/v1/financial_transactions`.
3. Tự động lấy tất cả trang với `page_size=1000` cho đến khi `has_more=false`.
4. Xuất cả CSV và JSON gốc.

Chạy export:

```bash
npm run export:airwallex
```

File script:

```text
scripts/export-airwallex-statements.mjs
```

Kết quả được lưu trong thư mục `exports/`:

```text
exports/airwallex-financial-transactions-all.csv
exports/airwallex-financial-transactions-all.json
```

CSV gồm các trường chính như `amount`, `fee`, `net`, `currency`,
`source_type`, `transaction_type`, `description`, `status` và `created_at`.
JSON giữ nguyên response đầy đủ từ Airwallex và kèm tổng số giao dịch,
account ID, môi trường và thời điểm export.

Access token Airwallex có thời hạn ngắn và script sẽ tạo token mới ở mỗi lần
export. API production dùng `https://api.airwallex.com`; sandbox dùng
`AIRWALLEX_ENV=sandbox`.

## 8. Export sao kê thẻ Airwallex

Sao kê thẻ được lấy từ Airwallex Issuing Card Transactions API. Script hiện tại
quét và export giao dịch của tất cả các thẻ trong tài khoản.

Chạy export:

```bash
npm run export:airwallex:cards
```

File script:

```text
scripts/export-airwallex-card-statement.mjs
```

Khoảng thời gian hiện tại:

- Tháng 7/2026: từ `2026-07-01T00:00:00Z`.
- Tháng 8/2026: đến trước `2026-09-01T00:00:00Z`.

Kết quả được lưu trong thư mục `exports/`:

```text
exports/airwallex-all-cards-statement.csv
exports/airwallex-all-cards-statement.json
```

### Các cột trong file sao kê rút gọn

File CSV hiện chỉ giữ lại 6 cột:

```text
Card
Where Paid
Amount
Currency
Transaction Details
Transaction Date
```

- `Card`: số thẻ được che, chỉ hiện các số cuối.
- `Where Paid`: tên merchant/cửa hàng nhận giao dịch.
- `Amount`: số tiền giao dịch.
- `Currency`: đơn vị tiền tệ, ví dụ `USD` hoặc `VND`.
- `Transaction Details`: thông tin theo mẫu sao kê gồm `Card`, merchant + địa điểm và số thẻ được che.
- `Transaction Date`: thời điểm giao dịch từ field `created_at`, định dạng dễ đọc như `Aug 29, 2026`.

Các bản ghi kỹ thuật có `NO_MOVEMENT` và toàn bộ số tiền bằng `0` vẫn được giữ
trong CSV; cột `Amount` hiển thị rõ giá trị `0`.

## 9. Export Account Activity tổng hợp

Để lấy cả giao dịch qua thẻ và giao dịch không qua thẻ như `Transfer`, `Purchase`
và `Deposit`, chạy:

```bash
npm run export:airwallex:account-activity
```

File kết quả:

```text
exports/airwallex-account-activity-july-august-2026.csv
exports/airwallex-account-activity-july-august-2026.json
```

File tổng hợp dùng các cột tiếng Anh `Card`, `card_nick_name`, `account_number`, `nick_name`,
`Where Paid`, `Amount`, `Currency`, `Transaction Details` và `Transaction Date`.
Các giao dịch không qua thẻ sẽ để trống `Card`; account number/name được lấy từ
Global Account liên quan. `Transaction Details` giữ loại giao dịch, tên bên gửi/
bên nhận, reference và transaction ID khi API cung cấp.

Để tạo file Excel tách rõ tiền thu/chi:

```bash
npm run export:airwallex:account-activity:xlsx
```

File Excel có mỗi thẻ một sheet (`Card_6171`, `Card_8621`, ...) và một sheet
`Non-card`. Mỗi sheet có các cột `account_number`, `nick_name`, `Credit` và
`Debit`; giao dịch không phát sinh tiền vẫn được giữ lại với giá trị `0`. Sheet
không có giao dịch trong khoảng thời gian export sẽ không được tạo.

Khi API key có quyền Financial Reports, dùng `npm run export:airwallex:account-activity:enrich`
để tải Account Statement PDF qua API và bù recipient/reference cho các giao dịch
non-card mà Financial Transactions API không trả chi tiết.

Lưu ý: giao dịch thẻ không phải bank transfer, nên API thường không có nội dung
chuyển khoản gốc. Phần nội dung trong file là thông tin chi tiết được dựng từ
merchant để gần giống cột `Details` trên Account Statement của Airwallex.

### Cách đọc các cột dạng `merchant.*` trong file cũ

Trong CSV, một số cột có tên như:

```text
merchant.category_code
merchant.city
merchant.country
merchant.identifier
merchant.name
```

Đây là tên field gốc từ Airwallex sau khi dữ liệu nested được bung ra thành cột
riêng. Dấu chấm nghĩa là field con nằm trong object cha, không phải lỗi mất tên
cột.

Ý nghĩa các cột thường gặp:

- `merchant.name`: tên merchant/cửa hàng nơi phát sinh giao dịch.
- `merchant.city`: thành phố của merchant.
- `merchant.country`: quốc gia của merchant.
- `merchant.identifier`: mã định danh merchant do hệ thống thanh toán cung cấp.
- `merchant.category_code`: mã ngành nghề merchant.

Khi mở bằng Numbers, header dài có thể bị xuống dòng hoặc nhìn như bị tách ra.
Chỉ cần kéo rộng cột hoặc mở bằng Excel/Google Sheets là sẽ thấy đầy đủ tên
cột.

## 10. Export Meta Ads Financials

Đặt credential Meta Ads trong `.env`; không thêm token vào source code hoặc
file export:

```env
META_ACCESS_TOKEN=your_meta_system_user_or_user_access_token
META_AD_ACCOUNT_ID=your_ad_account_id
META_API_VERSION=v24.0
```

`META_AD_ACCOUNT_ID` có thể có hoặc không có tiền tố `act_`. Script sẽ tự chuẩn
hóa về định dạng Graph API `act_<id>`.

Để xuất báo cáo chi tiêu và giá trị purchase cho tháng 7-8/2026:

```bash
node --env-file=.env scripts/export-meta-financials.mjs
python3 scripts/create-meta-financials-xlsx.py
```

Script gọi Meta Graph API theo hai cấp:

1. `/{ad_account}` để lấy currency, timezone, balance, spend cap và tổng spend
   lũy kế của tài khoản.
2. `/{ad_account}/insights` theo ngày và theo campaign, với `spend`,
   `action_values`, `purchase_roas`, `cpc`, `cpm`, `ctr`, clicks và impressions.

Kết quả:

```text
exports/meta-ads-financials-july-august-2026.json
exports/meta-ads-financials-july-august-2026.xlsx
```

Workbook có ba sheet:

- `Account Summary`: thông tin tiền tệ và giới hạn chi tiêu của tài khoản.
- `Daily Financials`: spend, purchase value, ROAS và chỉ số chi phí theo ngày.
- `Campaign Financials`: cùng chỉ số trên theo campaign cho toàn kỳ.

Các số tiền sử dụng `account_currency` mà Meta trả về. Không tự quy đổi tiền tệ.
`purchase_value` và `purchase_roas` chỉ có giá trị khi pixel/CAPI hoặc attribution
setting của tài khoản trả về conversion value.

## 11. Export PGPrints Financials

Lưu Shop ID và Secret của PGPrints vào `.env`; không thêm chúng vào source code,
file export hoặc log:

```env
PGPRINT_SHOP_ID=your_pgprints_store_id
PGPRINT_SECRET=your_pgprints_secret
```

PGPrints Open API yêu cầu header `X-PGPrints-Store-Id` và
`X-PGPrints-Hmac-Sha256`. HMAC là SHA-256 Base64 của đúng chuỗi JSON request
body, ký bằng `PGPRINT_SECRET`.

Để xuất chi phí order cho tháng 7-8/2026:

```bash
node --env-file=.env scripts/export-pgprint-financials.mjs
python3 scripts/create-pgprint-financials-xlsx.py
```

Script gọi `POST https://app.pgprints.io/api/v1/orders/search` với khoảng
`fromTime`/`toTime` dạng Unix milliseconds. API hiện trả tối đa 20 order mỗi
trang, vì vậy script tải song song các trang và lưu checkpoint sau mỗi batch:

```text
exports/pgprint-financials-july-august-2026.checkpoint.json
```

Nếu tiến trình bị dừng trước khi xong, chạy tiếp:

```bash
node --env-file=.env scripts/export-pgprint-financials.mjs --resume
```

Kết quả:

```text
exports/pgprint-financials-july-august-2026.json
exports/pgprint-financials-july-august-2026.xlsx
```

Workbook có các sheet `Summary`, `Daily Financials` và `Order Financials`, với
`product_cost`, `shipping_fee`, `handling_fee`, `other_fee`,
`other_shipping_fee`, `total_cost` và `child_seller_cost`. `total_cost` là giá
trị tổng từ PGPrints, dùng làm số liệu đối soát chính.

Endpoint Search Order không trả currency cho từng order. Vì vậy cột `Currency`
được giữ trống nếu response không có `currency`/`currencyCode`; không tự gán
USD hoặc VND.

## 12. Printful COGS

Printful được đồng bộ qua `PRINTFUL_API_TOKEN` trong `.env`. API đọc danh sách
orders theo phân trang từ `GET https://api.printful.com/orders`.

Khi sync vào `RAW.COGS`, mỗi item là một dòng. Các phí cấp order như shipping,
digitization, tax, VAT và fulfillment fee được phân bổ theo tỷ trọng
`item.price * quantity`; dòng cuối cùng nhận phần chênh lệch làm tròn để tổng
các dòng khớp `costs.total`. Phần phân bổ được lưu trong `raw_payload` với nhãn
`cost_allocation`. Nếu toàn bộ item có giá bằng 0, chi phí được chia đều theo
số lượng item để không phát sinh phép chia cho 0; dòng cuối vẫn nhận chênh lệch
làm tròn.

Mapping chính:

- `supplier`: `Printful`
- `date`: `created` của order
- `reference_order_id`: `external_id`, bỏ hậu tố phân bản dạng `_2` khi ghép với
  Shopify
- `supplier_order_id`: Printful `id`
- `total cost` và `est.cost`: chi phí đã phân bổ từ `costs.total`

API order không cung cấp subscription/billing account-level; các khoản đó vẫn
phải import thủ công từ Printful Wallet.

## 13. COGS Sync History Design

### Mục tiêu

`Sync All` là luồng backfill/đối soát lịch sử, không phải thao tác sync hằng
ngày. Luồng này cần giảm request lặp, hiển thị tiến độ ngay trên dashboard và
khôi phục được khi một nhà cung cấp bị lỗi. Sync thường ngày chỉ đọc dữ liệu
mới kể từ lần đồng bộ thành công gần nhất.

### Quyết định

- Một lượt lịch sử là một job với một khoảng ngày, ví dụ `2026-01-01` đến thời
  điểm chạy; không tạo 12 job theo từng tháng.
- Mỗi nguồn (Printify, Printful, PGPrint, Luxury Pro) quét khoảng lịch sử một
  lần. Dữ liệu được phân tháng sau khi đã ghi vào database.
- Các nguồn chạy song song, nhưng mỗi nguồn tự giới hạn số request để tôn trọng
  rate limit của API đối tác.
- Tiến độ và checkpoint phải lưu trong Neon. Refresh trang vẫn xem được số
  trang/dòng đã xử lý và phần lỗi.
- Lỗi một nguồn không dừng các nguồn khác. Retry chỉ chạy lại nguồn hoặc đoạn
  lỗi; `itemKey` cùng `skipDuplicates` bảo đảm không tạo dữ liệu trùng.
- Mỗi thời điểm chỉ cho phép một COGS sync job chạy để tránh rate limit và xung
  đột ghi dữ liệu.

### Mô hình đã triển khai

`CogsSyncRun` lưu loại chạy `LATEST`/`HISTORY`, khoảng ngày, heartbeat, trạng
thái tổng và số liệu tổng. `CogsSyncSourceRun` lưu checkpoint/cursor, số trang
đã đọc, số dòng mới, số dòng bỏ qua, lỗi cuối và thời điểm hoàn thành cho từng
nhà cung cấp.

UI tạo job và nhận `jobId` ngay, sau đó đọc trạng thái job để hiển thị tiến độ
theo nguồn. Các trạng thái: `QUEUED`, `RUNNING`, `COMPLETED`,
`PARTIAL_FAILED`, `FAILED`. Nút retry chỉ chạy lại source run thất bại. Advisory
lock trong PostgreSQL ngăn hai history job chạy cùng lúc. Job không cập nhật
heartbeat trong 15 phút được đánh dấu stale và giải phóng khóa logic.

Giai đoạn hiện tại chạy nền bằng Next.js `after()` với `maxDuration = 800`.
Điều này phù hợp khi chạy local hoặc hạ tầng cho phép runtime dài. Khi deploy
lên nền tảng serverless có giới hạn thấp hơn, chuyển hàm thực thi job sang
worker/queue; schema, API trạng thái và UI không cần thay đổi.

Sync theo tháng vẫn quét lại toàn bộ tháng được chọn để nhận cả các order cũ
vừa được nhà cung cấp cập nhật. `Sync All` mới là luồng tối ưu: mỗi nguồn chỉ
quét một lần từ `2026-01-01` đến thời điểm chạy.

### Kiểm thử bắt buộc

- Sync lại cùng dữ liệu không phát sinh bản ghi mới.
- Lỗi một nguồn không cản ba nguồn còn lại hoàn thành.
- Refresh khi job đang chạy vẫn xem được tiến độ đã lưu.
- Retry chỉ gọi lại phần thất bại.
- Sync lịch sử không quét lại cùng một nguồn theo từng tháng.
- Sync thường ngày chỉ đọc phần dữ liệu mới sau checkpoint.

## Tài liệu tham khảo

- [Shopify Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql/latest)
- [Shopify REST Admin API - Order](https://shopify.dev/docs/api/admin-rest/latest/resources/order)
- [Shopify REST API pagination](https://shopify.dev/docs/api/admin-rest/usage/pagination)
- [Airwallex API authentication](https://www.airwallex.com/docs/developer-tools/api/manage-api-keys)
- [Airwallex Financial Transactions](https://www.airwallex.com/docs/api/finance/financial_transactions)
- [Airwallex Card Transactions](https://www.airwallex.com/docs/api/issuing/card_transactions)
- [PGPrints API Authentication](https://pgprints.gitbook.io/api/authentication)
- [PGPrints Search Order](https://pgprints.gitbook.io/api/reference/api-reference/search-order-get-tracking-and-others)
- [Printful API Documentation](https://developers.printful.com/docs/)
