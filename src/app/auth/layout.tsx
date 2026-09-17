import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MatureX - Xác thực tài khoản",
  description: "Cổng đăng nhập hệ thống quản trị nội bộ MatureX",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-black">
      {/* Dynamic Taste Ambient Glows (Fintech Luxury Deep Palette) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Emerald Glow - Top Left */}
        <div className="absolute -top-32 -left-32 size-[500px] rounded-full bg-emerald-500/10 blur-[130px]" />
        {/* Violet/Indigo Glow - Center Right */}
        <div className="absolute top-1/3 -right-24 size-[550px] rounded-full bg-violet-600/10 blur-[140px]" />
        {/* Deep Slate Glow - Bottom */}
        <div className="absolute -bottom-32 left-1/3 size-[600px] rounded-full bg-teal-500/8 blur-[150px]" />

        {/* Minimal Precision Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </div>

      {/* Main Form Viewport */}
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 relative z-10">
        {children}
      </div>

      {/* Sleek Minimal Footer */}
      <footer className="w-full py-5 px-6 border-t border-white/5 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-4xl mx-auto font-mono text-[11px] gap-2">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
          <span className="text-slate-400 font-medium tracking-tight">
            MatureX Internal Operations
          </span>
        </div>
        <div className="text-slate-500">
          © {new Date().getFullYear()} MatureX. Encrypted Session.
        </div>
      </footer>
    </div>
  );
}
