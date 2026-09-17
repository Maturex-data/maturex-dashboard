import { CheckCircleIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập | MatureX Financial OS",
  description:
    "Cổng đăng nhập an toàn vào nền tảng quản trị tài chính đa team MatureX",
};

export default function LoginPage() {
  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full items-center">
        {/* Left Col: Brand Story & Realtime Highlights (Taste Aesthetic) */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 lg:pr-6">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 flex items-center justify-center shadow-md font-bold font-mono text-sm border border-white/20">
              MX
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-foreground">
                MatureX
              </span>
              <span className="text-xs text-muted-foreground ml-1.5 font-mono">
                Financial OS
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-heading leading-tight">
              Hệ thống quản trị tài chính & chu kỳ payout chuẩn xác.
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
              Tập trung toàn bộ dữ liệu đơn hàng Shopify, chi phí Meta Ads, đối
              soát tài khoản Airwallex và biên lợi nhuận ròng của 4 nhóm kinh
              doanh trong một giao diện duy nhất.
            </p>
          </div>

          {/* Value Props & Trust Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border/60 bg-card/50 p-3.5 backdrop-blur-xs space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ZapIcon className="size-3.5 text-amber-500" />
                <span>Đồng bộ Neon Serverless</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Truy vấn dữ liệu hàng nghìn đơn hàng với độ trễ dưới 20ms qua
                connection pooling.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/50 p-3.5 backdrop-blur-xs space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ShieldCheckIcon className="size-3.5 text-emerald-500" />
                <span>Bảo mật cấp doanh nghiệp</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mã hóa đầu cuối SSL 256-bit, phân quyền chi tiết theo từng
                workspace nhóm kinh doanh.
              </p>
            </div>
          </div>

          {/* Social Proof / Security Metric Pill */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              Tự động đối soát Payout
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              Hỗ trợ đa tiền tệ USD / VND
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircleIcon className="size-4 text-emerald-500" />
              Báo cáo realtime 24/7
            </span>
          </div>
        </div>

        {/* Right Col: Standard Shadcn LoginForm */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
