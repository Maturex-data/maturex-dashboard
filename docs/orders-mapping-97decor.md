# Bảng Mapping 37 Cột: Etsy Sold Orders → RAW.Orders (97Decor - Ms. Linh)

Tài liệu này xác định quy tắc chuyển đổi và ánh xạ chi tiết 37 cột từ file xuất nguồn **Etsy Sold Orders CSV** sang cấu trúc bảng đích **RAW.Orders** trên Google Sheet ECOMBIUS cho nhóm BO **Ms. Linh** (Shop **97Decor**).

- **Google Spreadsheet ID:** `1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do`
- **Tab đích:** `RAW.Orders` (Sheet ID: `839747432`)
- **Link Google Sheet:** `https://docs.google.com/spreadsheets/d/1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do/edit?gid=839747432#gid=839747432`
- **BO phụ trách:** `ms-linh` (Ms. Linh)
- **Shop áp dụng:** `97DECOR`
- **Giá trị cột Store:** `97Decor`

---

## 1. Bảng Ánh Xạ Chi Tiết 37 Cột

| STT | Cột Đích (RAW.Orders) | Cột Nguồn (Etsy CSV) | Kiểu Dữ Liệu | Bắt Buộc | Quy Tắc Xử Lý / Ghi Chú |
|:---|:---|:---|:---|:---:|:---|
| 1 | **Sale Date** | Sale Date | String | Có | Giữ nguyên chuỗi ngày nguồn (`MM/DD/YY`), không tự đổi múi giờ hoặc format. |
| 2 | **Order ID** | Order ID | String (Text) | Có | Định dạng text bảo toàn chữ số, không chuyển sang số học để tránh mất số 0 đầu; kiểm tra trùng lặp đơn. |
| 3 | **Buyer User ID** | Buyer User ID | String | Không | Username của khách hàng trên Etsy. Trường trống giữ trống. |
| 4 | **Full Name** | Full Name | String | Không | Họ tên đầy đủ người nhận hàng. |
| 5 | **First Name** | First Name | String | Không | Tên người nhận. |
| 6 | **Last Name** | Last Name | String | Không | Họ người nhận. |
| 7 | **Number of Items** | Number of Items | Number (Int) | Không | Số lượng món hàng trong đơn; parse số nguyên. Không tự gán 0 nếu ô trống. |
| 8 | **Payment Method** | Payment Method | String | Không | Phương thức thanh toán (vd: `Credit Card`, `PayPal`). |
| 9 | **Date Shipped** | Date Shipped | String | Không | Ngày giao hàng (nếu đã ship). Trường trống giữ trống. |
| 10 | **Street 1** | Street 1 | String | Không | Địa chỉ nhận hàng dòng 1. |
| 11 | **Street 2** | Street 2 | String | Không | Địa chỉ nhận hàng dòng 2 (nếu có căn hộ, số phòng). |
| 12 | **Ship City** | Ship City | String | Không | Thành phố nhận hàng. |
| 13 | **Ship State** | Ship State | String | Không | Bang / Tỉnh nhận hàng. |
| 14 | **Ship Zipcode** | Ship Zipcode | String (Text) | Không | Mã bưu điện; **bắt buộc định dạng text** bảo toàn số 0 đầu (vd: `07030`, `01824`). |
| 15 | **Ship Country** | Ship Country | String | Không | Quốc gia nhận hàng (vd: `United States`). |
| 16 | **Currency** | Currency | String | Không | Mã tiền tệ gốc (vd: `USD`). Không tự quy đổi tỷ giá. |
| 17 | **Order Value** | Order Value | Number (Float) | Không | Giá trị đơn hàng (trước giảm giá/thuế/ship). Parse float chính xác. |
| 18 | **Coupon Code** | Coupon Code | String | Không | Mã coupon giảm giá khách áp dụng. |
| 19 | **Coupon Details** | Coupon Details | String | Không | Chi tiết giảm giá (vd: `% off`, `Fixed amount`). |
| 20 | **Discount Amount** | Discount Amount | Number (Float) | Không | Số tiền được giảm giá. Parse float chính xác. |
| 21 | **Shipping Discount** | Shipping Discount | Number (Float) | Không | Số tiền giảm giá vận chuyển. Parse float. |
| 22 | **Shipping** | Shipping | Number (Float) | Không | Phí vận chuyển khách thanh toán. Parse float. |
| 23 | **Sales Tax** | Sales Tax | Number (Float) | Không | Thuế bán hàng bang thu. Parse float. |
| 24 | **Order Total** | Order Total | Number (Float) | Không | Tổng số tiền đơn hàng khách trả. Parse float. |
| 25 | **Status** | Status | String | Không | Trạng thái đơn hàng trên Etsy (nếu có). |
| 26 | **Card Processing Fees** | Card Processing Fees | Number (Float) | Không | Phí xử lý thanh toán Etsy thu. Parse float. |
| 27 | **Order Net** | Order Net | Number (Float) | Không | Tiền thực nhận về tài khoản sau phí thanh toán. |
| 28 | **Adjusted Order Total** | Adjusted Order Total | Number (Float) | Không | Tổng tiền sau điều chỉnh (refund/thay đổi). |
| 29 | **Adjusted Card Processing Fees** | Adjusted Card Processing Fees | Number (Float) | Không | Phí thẻ sau điều chỉnh. |
| 30 | **Adjusted Net Order Amount** | Adjusted Net Order Amount | Number (Float) | Không | Thực nhận sau điều chỉnh. |
| 31 | **Buyer** | Buyer | String | Không | Tên hiển thị người mua. |
| 32 | **Order Type** | Order Type | String | Không | Loại đơn (`online`...). |
| 33 | **Payment Type** | Payment Type | String | Không | Kiểu thanh toán (`online_cc`...). |
| 34 | **InPerson Discount** | InPerson Discount | Number (Float) | Không | Giảm giá đơn bán trực tiếp (nếu có). |
| 35 | **InPerson Location** | InPerson Location | String | Không | Địa điểm bán trực tiếp (nếu có). |
| 36 | **SKU** | SKU | String (Text) | Không | Danh sách SKU sản phẩm trong đơn, ngăn cách dấu phẩy. Giữ nguyên text. |
| 37 | **Store** | *(Tự động gán)* | String | Có | **Cố định là `97Decor`** theo cấu hình nhóm BO Ms. Linh. |

---

## 2. Quy Tắc Kỹ Thuật Cốt Lõi

1. **Parser CSV Chuẩn RFC 4180:**
   - Hỗ trợ file UTF-8 có hoặc không có BOM (`\uFEFF`).
   - Xử lý chính xác các trường chứa dấu phẩy nằm trong ngoặc kép (quoted commas) và các ô có dấu xuống dòng (`\r\n`, `\n`).
   - Hỗ trợ escaped quotes (`""`).
2. **Bảo Toàn Kiểu Dữ Liệu:**
   - Cột dạng Text (`Order ID`, `Ship Zipcode`, `SKU`, `Buyer User ID`) luôn giữ nguyên text, không bị Excel hay JavaScript chuyển thành số làm mất số 0 ở đầu.
   - Cột dạng Số (`Order Value`, `Order Total`...): chỉ chuyển đổi thành number khi dữ liệu parse chính xác. Nếu gặp chuỗi không hợp lệ, hệ thống báo lỗi rõ ràng ở báo cáo validation chứ không tự ý ép về 0.
   - Trường trống: Giữ nguyên ô trống (empty/null), không tự điền 0 hoặc chuỗi giả.
3. **Kiểm Tra Tính Toàn Vẹn Của Header:**
   - Bắt buộc kiểm tra đủ 36 header nguồn của Etsy Sold Orders. Thiếu bất kỳ cột nào hệ thống sẽ từ chối file.
   - Không chấp nhận file có header bị trùng lặp.
4. **Nhận Diện & Xác Minh Shop:**
   - Hệ thống đối chiếu tên file: Từ chối nếu tên file chứa dấu hiệu của shop khác (`evernest`, `orivia`, `timond`, `pocdy`...).
   - Lưu ý: Việc đối chiếu tên file kết hợp với lựa chọn shop là bước kiểm tra nghiệp vụ, không thay thế việc phân quyền tuyệt đối.
5. **Chế Độ Duyệt (Preview Phase):**
   - Không ghi đè hay phát sinh bất kỳ request ghi (write) nào lên Google Sheet trong giai đoạn này.
   - Xuất file XLSX 3 sheet tại `/Users/tatuanthanh/Downloads/data/linh-97decor-orders-preview.xlsx` để người dùng kiểm tra đối chiếu.
