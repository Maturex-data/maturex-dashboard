import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Xác thực tài khoản | MatureX Financial OS",
  description: "Cổng đăng nhập và phân quyền bảo mật cho MatureX Financial OS",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden bg-background">
      {/* Background Ambience / Taste Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-linear-to-b from-primary/10 via-emerald-500/5 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)_0%,transparent_70%)] opacity-[0.03]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center">{children}</div>

      {/* Clean Financial OS Footer */}
      <footer className="w-full py-4 px-6 border-t border-border/40 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground tracking-tight">
            MatureX
          </span>
          <span>•</span>
          <span>Financial Operations & Analytics</span>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0 font-mono text-[11px]">
          <span className="hover:text-foreground transition-colors cursor-pointer">
            Bảo mật SOC-2
          </span>
          <span>•</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">
            Điều khoản dịch vụ
          </span>
          <span>•</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">
            Hỗ trợ 24/7
          </span>
        </div>
      </footer>
    </div>
  );
}
