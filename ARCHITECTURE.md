# Architecture & Guidelines

Tài liệu này mô tả cấu trúc thư mục, quy chuẩn code (coding conventions), và các quyết định kiến trúc cốt lõi của dự án `maturex-dashboard`.

## 1. Cấu trúc thư mục (Directory Structure)

Dự án tuân theo cấu trúc chuẩn của Next.js (App Router) với thư mục `src`:

```text
src/
├── app/               # Next.js App Router (Pages, Layouts, API routes). Phân trang và routing.
├── components/        # Chứa tất cả các React components.
│   ├── ui/            # UI components cơ bản, dùng chung (ví dụ: shadcn/ui components).
│   ├── shared/        # Các components dùng chung trên toàn ứng dụng (ví dụ: DataTable).
│   └── dashboard/     # Các components chuyên biệt cho từng tính năng/trang trên dashboard.
├── hooks/             # Custom React hooks (chỉ dùng cho Client Components).
├── lib/               # Các utility functions, helpers, và cấu hình dùng chung.
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
- Cần sử dụng React hooks như `useState`, `useEffect`, `useRef`...
- Cần lắng nghe các sự kiện của trình duyệt (onClick, onChange, etc.).
- Cần truy cập vào các API của trình duyệt (window, document, localStorage...).

**Lưu ý:** Hãy đẩy Client Components xuống sâu nhất có thể trong cây component (push Client Components to the leaves). Ví dụ: Thay vì biến cả một trang `page.tsx` thành Client Component chỉ vì một nút bấm, hãy tách riêng nút bấm đó ra một component riêng, khai báo `'use client'` trong component nút bấm đó, và import nó vào `page.tsx`.

## 3. Quy chuẩn Code (Coding Conventions)

- **Ngôn ngữ:** Sử dụng TypeScript 100%. Luôn định nghĩa type/interface rõ ràng cho `props`, state và return type (khi cần).
- **Linter & Formatter:** Dự án sử dụng [Biome](https://biomejs.dev/).
  - Trước khi commit code, hãy chạy lệnh `pnpm lint` để tự động check và fix các lỗi linter/format.
  - Cấu hình Biome nằm ở `biome.json`.
- **CSS / Styling:** Sử dụng Tailwind CSS. Hạn chế viết CSS thuần. Gom nhóm các class name logic bằng thư viện `cn` (clsx + tailwind-merge) để tránh xung đột class.
- **Imports:** 
  - Ưu tiên sử dụng absolute imports với alias `@/` thay vì relative imports phức tạp (vd: `import { Button } from "@/components/ui/button"` thay vì `../../../components/ui/button`).
  - Nếu chỉ import type, luôn sử dụng `import type` (để linter và bundler tối ưu hóa code tốt hơn).
