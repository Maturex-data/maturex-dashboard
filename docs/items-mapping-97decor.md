# Bảng Mapping 34 Cột: Etsy Sold Order Items → RAW.Items (97Decor - Ms. Linh)

Tài liệu này xác định quy tắc chuyển đổi và ánh xạ chi tiết 34 cột từ file xuất nguồn **Etsy Sold Order Items CSV** sang cấu trúc bảng đích **RAW.Items** trên Google Sheet cho nhóm BO **Ms. Linh** (Shop **97Decor**).

- **Google Spreadsheet ID:** `1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do`
- **Tab đích:** `RAW.Items` (Sheet ID / GID: `136409036`)
- **Link Google Sheet:** `https://docs.google.com/spreadsheets/d/1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do/edit?gid=136409036#gid=136409036`
- **BO phụ trách:** `ms-linh` (Ms. Linh)
- **Shop áp dụng:** `97DECOR`
- **Giá trị cột Store:** `97Decor`
- **Khóa chống trùng (Deduplication Key):** `Transaction ID` (Cột N)

---

## 1. Bảng Ánh Xạ Chi Tiết 34 Cột

| STT | Cột Đích (RAW.Items) | Cột Nguồn (Etsy CSV) | Kiểu Dữ Liệu | Bắt Buộc | Quy Tắc Xử Lý / Ghi Chú |
|:---|:---|:---|:---|:---:|:---|
| 1 | **Sale Date** | Sale Date | String | Có | Giữ nguyên chuỗi ngày nguồn (`MM/DD/YY`). |
| 2 | **Item Name** | Item Name | String | Có | Tên sản phẩm, hỗ trợ giữ nguyên dấu phẩy và ký tự xuống dòng bên trong ô. |
| 3 | **Buyer** | Buyer | String | Không | Họ tên hoặc ID người mua hàng. |
| 4 | **Quantity** | Quantity | Number | Có | Số lượng sản phẩm mua. |
| 5 | **Price** | Price | Number | Có | Đơn giá sản phẩm. Parse float, giữ nguyên giá trị rỗng nếu ô trống. |
| 6 | **Coupon Code** | Coupon Code | String | Không | Mã giảm giá áp dụng (nếu có). |
| 7 | **Coupon Details** | Coupon Details | String | Không | Chi tiết giảm giá (`% off`, `Fixed amount`...). |
| 8 | **Discount Amount** | Discount Amount | Number | Không | Số tiền được giảm giá cho item. |
| 9 | **Shipping Discount** | Shipping Discount | Number | Không | Số tiền giảm giá phí ship. |
| 10 | **Order Shipping** | Order Shipping | Number | Không | Phí vận chuyển của đơn hàng. |
| 11 | **Order Sales Tax** | Order Sales Tax | Number | Không | Thuế bán hàng. |
| 12 | **Item Total** | Item Total | Number | Có | Tổng tiền của item sau giảm giá. |
| 13 | **Currency** | Currency | String | Có | Đơn vị tiền tệ gốc (`USD`...). Không tự quy đổi. |
| 14 | **Transaction ID** | Transaction ID | String (Text) | Có | **Khóa định danh dòng sản phẩm (Cột N)**. Bắt buộc bảo toàn số dạng text, dùng để Upsert chống trùng lặp. |
| 15 | **Listing ID** | Listing ID | String (Text) | Có | Mã listing sản phẩm trên Etsy, bảo toàn số dạng text. |
| 16 | **Date Paid** | Date Paid | String | Không | Ngày thanh toán. |
| 17 | **Date Shipped** | Date Shipped | String | Không | Ngày gửi hàng. |
| 18 | **Ship Name** | Ship Name | String | Không | Tên người nhận hàng. |
| 19 | **Ship Address1** | Ship Address1 | String | Không | Địa chỉ người nhận dòng 1. |
| 20 | **Ship Address2** | Ship Address2 | String | Không | Địa chỉ người nhận dòng 2 (căn hộ, tòa nhà...). |
| 21 | **Ship City** | Ship City | String | Không | Thành phố nhận hàng. |
| 22 | **Ship State** | Ship State | String | Không | Bang / Tỉnh nhận hàng. |
| 23 | **Ship Zipcode** | Ship Zipcode | String (Text) | Không | Mã bưu điện; **bắt buộc định dạng text** bảo toàn số 0 đầu (`07030`, `01824`...). |
| 24 | **Ship Country** | Ship Country | String | Không | Quốc gia nhận hàng (`United States`...). |
| 25 | **Order ID** | Order ID | String (Text) | Có | Mã đơn hàng Etsy chứa item này. Giữ dạng text. |
| 26 | **Variations** | Variations | String | Không | Biến thể sản phẩm (màu sắc, kích thước, phân loại), giữ nguyên xuống dòng. |
| 27 | **Order Type** | Order Type | String | Không | Loại đơn (`online`...). |
| 28 | **Listings Type** | Listings Type | String | Không | Loại listing (`listing`...). |
| 29 | **Payment Type** | Payment Type | String | Không | Kiểu thanh toán (`online_cc`...). |
| 30 | **InPerson Discount** | InPerson Discount | Number | Không | Giảm giá bán trực tiếp. |
| 31 | **InPerson Location** | InPerson Location | String | Không | Địa điểm bán trực tiếp. |
| 32 | **VAT Paid by Buyer** | VAT Paid by Buyer | Number | Không | Thuế VAT người mua trả. |
| 33 | **SKU** | SKU | String (Text) | Không | Mã SKU quản lý sản phẩm nội bộ (vd: `97DC126157000000`), giữ nguyên text. |
| 34 | **Store** | *(Tự động gán)* | String | Có | **Cố định là `97Decor`** cho nhóm BO Ms. Linh. |

---

## 2. Phân Tích Khóa Chống Trùng (Deduplication Strategy)

- **Vấn đề với Order ID:** Một đơn hàng Etsy có thể chứa nhiều sản phẩm khác nhau. Thực tế trong file kiểm tra tháng 9/2026 có **35 đơn hàng chứa từ 2 item trở lên**. Do đó, **tuyệt đối không được dùng riêng Order ID để làm khóa chống trùng**.
- **Đặc tính của Transaction ID:**
  - Trên Etsy, mỗi dòng sản phẩm bán ra được gán một `Transaction ID` duy nhất.
  - Kiểm tra 245 dòng trong file mẫu: **100% có Transaction ID và 100% là duy nhất (0 trùng)**.
  - Kiểm tra 277 dòng hiện có trong tab `RAW.Items`: **277 Transaction ID là duy nhất (0 trùng)**.
- **Quy tắc Upsert:**
  - So khớp theo `Transaction ID` (Cột N).
  - Nếu `Transaction ID` đã tồn tại: Cập nhật dòng tương ứng.
  - Nếu `Transaction ID` chưa có: Nối thêm vào cuối tab `RAW.Items`.
  - Bảo toàn 100% dữ liệu của các shop khác (`Artisanhand`, `Timond`...) trong cùng tab.

---

## 3. Trạng Thái & File Xem Trước (Preview)

- **File nguồn kiểm thử:** `/Users/tatuanthanh/Downloads/linh/97decor_EtsySoldOrderItems2026-9.csv` (245 dòng, 33 cột).
- **File XLSX đã xuất:** `/Users/tatuanthanh/Downloads/data/linh-97decor-items-preview.xlsx` (gồm 3 sheet: `RAW.Items`, `Mapping`, `Validation`).
- **Trạng thái ghi Sheet:** **Đang khóa** chờ người dùng duyệt mapping và file XLSX trước khi mở nút ghi thật lên Google Sheet.
