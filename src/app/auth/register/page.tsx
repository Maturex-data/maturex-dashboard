import { ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản | MatureX Financial OS",
  description:
    "Yêu cầu cấp quyền truy cập hệ thống quản trị dữ liệu tài chính MatureX",
};

export default function RegisterPage() {
  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full items-center">
        {/* Left Col: Workspace Role & Onboarding Information */}
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
                Team Onboarding
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-heading leading-tight">
              Phân quyền thông minh cho mọi bộ phận vận hành.
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
              Truy cập dữ liệu tài chính chuẩn hóa theo vai trò: Quản lý chi phí
              quảng cáo Ads, kiểm soát giá vốn hàng bán COGS, hoặc đối soát ngân
              hàng Airwallex.
            </p>
          </div>

          {/* Teams pill overview */}
          <div className="space-y-2.5 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Các nhóm kinh doanh hỗ trợ:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 backdrop-blur-xs">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">
                    EC Team:
                  </span>
                  <span className="text-muted-foreground ml-1">
                    Shopify & POD
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 backdrop-blur-xs">
                <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Flowa:</span>
                  <span className="text-muted-foreground ml-1">
                    Digital & Media
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 backdrop-blur-xs">
                <span className="size-2 rounded-full bg-sky-500 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Microm:</span>
                  <span className="text-muted-foreground ml-1">
                    Micro SaaS Platform
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 backdrop-blur-xs">
                <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Pocdy:</span>
                  <span className="text-muted-foreground ml-1">
                    Brand E-Commerce
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-emerald-500 shrink-0" />
            <span>
              Tài khoản đăng ký sẽ được Admin phê duyệt trong vòng 2 giờ làm
              việc.
            </span>
          </div>
        </div>

        {/* Right Col: Standard Shadcn RegisterForm */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
