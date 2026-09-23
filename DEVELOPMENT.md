# Hướng dẫn Phát triển (Development Workflow)

Chào mừng bạn đến với môi trường phát triển của dự án **Maturex Dashboard**. Tài liệu này tóm tắt các quy trình và tiêu chuẩn làm việc trên nhánh `develop`.

---

## 1. Quy chuẩn Nhánh & Quy trình Làm việc (Branching Strategy)

- **`main`**: Nhánh production chính thức, luôn ở trạng thái ổn định và sẵn sàng release.
- **`develop`**: Nhánh tích hợp chính cho các tính năng mới và quá trình phát triển liên tục.
- **`feature/<ten-tinh-nang>`**: Tạo từ `develop` cho từng tính năng hoặc bugfix, sau đó tạo Pull Request về `develop`.

---

## 2. Thiết lập Môi trường Phát triển (Local Setup)

1. Cài đặt các gói phụ thuộc:
   ```bash
   pnpm install
   ```

2. Cấu hình biến môi trường:
   - Tạo file `.env` dựa trên các mẫu cấu hình dịch vụ (Database Postgres, Google OAuth/Drive, Fastway API, Shopify, v.v.).

3. Sinh Prisma Client & Kiểm tra Schema:
   ```bash
   pnpm prisma generate
   ```

4. Chạy môi trường local:
   ```bash
   pnpm dev
   ```
   Ứng dụng sẽ khả dụng tại `http://localhost:3000`.

---

## 3. Quy chuẩn Mã nguồn & Kiểm tra Chất lượng (Code Standards)

Trước khi commit bất kỳ thay đổi nào lên `develop`, hãy đảm bảo tuân thủ các quy tắc trong [ARCHITECTURE.md](./ARCHITECTURE.md):

1. **Linter & Formatter (Biome)**:
   ```bash
   pnpm lint
   ```
   Hoặc tự động sửa lỗi formatting/imports:
   ```bash
   pnpm format
   ```

2. **Kiểm tra TypeScript & Next.js Build**:
   ```bash
   pnpm build
   ```

3. **Nguyên tắc Kiến trúc**:
   - **SSR-First**: Các file `page.tsx` và `layout.tsx` luôn là Server Components, không gắn `'use client'`.
   - **Component Leaves**: Đẩy `'use client'` xuống các component nhỏ ở tầng dưới cùng (Buttons, Sheets, Modals, Forms).
   - **Modularization**: Tránh các file monolithic phình to (>500 dòng). Hãy tách nhỏ theo domain (`src/lib/fl/` cho Flowa/Etsy, `src/lib/ec/` cho EC/Shopify).
