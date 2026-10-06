# Architecture & Guidelines

Tài liệu này mô tả cấu trúc thư mục, quy chuẩn code (coding conventions), và các quyết định kiến trúc cốt lõi của dự án `maturex-dashboard`.

## 1. Cấu trúc thư mục (Directory Structure)

Dự án tuân theo cấu trúc chuẩn của Next.js (App Router) với thư mục `src`:

```text
src/
├── app/               # Next.js App Router (Pages, Layouts, API routes). Phân trang và routing.
├── components/        # Chứa tất cả các React components.
│   ├── ui/            # UI components cơ bản, dùng chung theo chuẩn shadcn/ui (ví dụ: button, select, card).
│   ├── shared/        # Các components dùng chung trên toàn ứng dụng (ví dụ: DataTable).
│   └── dashboard/     # Các components chuyên biệt cho từng tính năng/trang trên dashboard (chia theo domain: fl, ec, microm, po...).
├── hooks/             # Custom React hooks (chỉ dùng cho Client Components).
├── lib/               # Các utility functions, helpers, và cấu hình dùng chung (chia theo domain: fl, ec, microm...).
└── types/             # (Nếu có) Định nghĩa TypeScript types/interfaces toàn cục.
```

## 2. Chiến lược Rendering (SSR & Client Components)

Next.js App Router mặc định mọi component đều là **Server Components**. Chúng ta sẽ ưu tiên Server-Side Rendering (SSR) để tối ưu hoá hiệu năng, SEO và bảo mật:

### Quy tắc quan trọng về `page.tsx` và `layout.tsx`
- **KHÔNG sử dụng `'use client'` ở đầu các file `page.tsx` hoặc `layout.tsx`**.
- `page.tsx` và `layout.tsx` **luôn luôn phải là Server Components**.
- Mọi logic fetch dữ liệu chính của một trang nên được thực hiện trực tiếp tại `page.tsx` (sử dụng `async/await`), sau đó truyền data xuống các component con thông qua `props`.

### Khi nào dùng Client Components (`'use client'`)?
Chỉ chuyển một component thành Client Component (bằng cách thêm `'use client'` ở đầu file) khi nó thực sự cần thiết, cụ thể:
- Cần sử dụng React hooks như `useState`, `useEffect`, `useRef`, `useTransition`, `useOptimistic`...
- Cần lắng nghe các sự kiện của trình duyệt (onClick, onChange, onDrop, etc.).
- Cần truy cập vào các API của trình duyệt (window, document, localStorage...).

**Lưu ý:** Hãy đẩy Client Components xuống sâu nhất có thể trong cây component (push Client Components to the leaves). Ví dụ: Thay vì biến cả một trang `page.tsx` thành Client Component chỉ vì một nút bấm hoặc form chọn, hãy tách riêng phần tương tác đó ra component con, khai báo `'use client'` tại đó, và import vào `page.tsx`.

## 3. Quy chuẩn Code (Coding Conventions)

- **Ngôn ngữ:** Sử dụng TypeScript 100%. Luôn định nghĩa type/interface rõ ràng cho `props`, state và return type (khi cần).
- **Linter & Formatter:** Dự án sử dụng [Biome](https://biomejs.dev/).
  - Trước khi commit code, hãy chạy lệnh `pnpm lint` để tự động check và fix các lỗi linter/format.
  - Cấu hình Biome nằm ở `biome.json`.
- **CSS / Styling:** Sử dụng Tailwind CSS. Hạn chế viết CSS thuần. Gom nhóm các class name logic bằng thư viện `cn` (clsx + tailwind-merge) để tránh xung đột class.
- **Imports:** 
  - Ưu tiên sử dụng absolute imports với alias `@/` thay vì relative imports phức tạp (vd: `import { Button } from "@/components/ui/button"` thay vì `../../../components/ui/button`).
  - Nếu chỉ import type, luôn sử dụng `import type` (để linter và bundler tối ưu hóa code tốt hơn).

## 4. Chuẩn hóa Giao diện & shadcn/ui (UI Standards)

Dự án áp dụng chặt chẽ Design System dựa trên **shadcn/ui** (thư mục `@/components/ui/`). Mọi giao diện mới hoặc refactor đều phải tuân thủ:

- **Ưu tiên sử dụng component shadcn/ui thay thế thẻ HTML native:**
  - **Select / Dropdown:** Bắt buộc dùng `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` từ `@/components/ui/select`. Không dùng thẻ `<select>` thuần với CSS ad-hoc hay hack ký tự mũi tên `▼`.
  - **Form Inputs:** Dùng `Input` từ `@/components/ui/input` và `Label` từ `@/components/ui/label` để đảm bảo accessibility (a11y).
  - **Khung & Thẻ nội dung:** Dùng `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` từ `@/components/ui/card` thay vì viết lặp lại các khối thẻ `section` / `div` với border và shadow tùy tiện.
  - **Breadcrumbs:** Dùng `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator` từ `@/components/ui/breadcrumb`.
  - **Tabs & Điều hướng:** Dùng `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` từ `@/components/ui/tabs`. Không gắn class `overflow-x-auto` lên `TabsList` nếu container có chiều cao cố định để tránh sinh thanh cuộn dọc không mong muốn.
  - **Buttons & Badges:** Dùng `Button`, `Badge` từ `@/components/ui/` với các variant chuẩn (`outline`, `secondary`, `destructive`, `ghost`).
- **Icons:** Thống nhất sử dụng thư viện `lucide-react`. Giữ kích thước icon hài hòa (`size-3.5` hoặc `size-4` cho nút/bảng điều khiển nhỏ).

## 5. Nguyên tắc Tách nhỏ & Bảo trì Code (Modularization & Maintenance)

- **Tránh các file monolithic (>300–400 dòng):**
  - Khi một màn hình hoặc tính năng phình to, hãy chủ động tách nhỏ thành các sub-components trong thư mục con tương ứng.
  - Ví dụ: `src/components/dashboard/fl/bo-import/` tách thành:
    - `types.ts`: Chứa type, interface, hằng số và helper format.
    - `bo-file-dropzone.tsx`: Chỉ đảm nhiệm khu vực kéo thả và bắt lỗi file.
    - `bo-file-list.tsx`: Chỉ hiển thị danh sách file và thao tác xóa.
    - `bo-statement-form.tsx`: Khối form tương tác chính.
    - `bo-statement-import.tsx`: Component gốc điều phối Tabs và URL params.
- **Bảo toàn Logic khi Refactor UI:**
  - Tuyệt đối không thay đổi logic nghiệp vụ (business rules, query params handling, validation criteria, data flow) khi thực hiện tái cấu trúc giao diện hoặc đổi sang shadcn/ui.
- **Quy trình Kiểm thử trước khi hoàn thành công việc:**
  1. `pnpm lint`: Đảm bảo 0 lỗi lint và format chuẩn theo Biome.
  2. `npx tsc --noEmit`: Kiểm tra 100% type safety.
  3. `pnpm build`: Xác nhận Next.js production build thành công.
