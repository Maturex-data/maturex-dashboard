import {
  ArrowRightIcon,
  CreditCardIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const workspaces = [
    {
      title: "EC Team",
      description:
        "Báo cáo hiệu quả kinh doanh, chu kỳ payout, COGS và quảng cáo thương mại điện tử.",
      href: "/ec",
      tag: "Shopify / POD / Ads",
      icon: <ShoppingBagIcon className="size-5 text-emerald-400" />,
      accentBorder: "hover:border-emerald-500/40",
      accentBg: "hover:bg-emerald-500/[0.03]",
      badge: "Active",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Flowa",
      description:
        "Bảng dữ liệu Etsy, quản lý tệp import, phân tích đơn hàng và đồng bộ Google Drive.",
      href: "/flowa",
      tag: "Digital / Media",
      icon: <SparklesIcon className="size-5 text-purple-400" />,
      accentBorder: "hover:border-purple-500/40",
      accentBg: "hover:bg-purple-500/[0.03]",
      badge: "Etsy Ops",
      badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
    {
      title: "Microm",
      description:
        "Báo cáo tài chính P&L tổng hợp cho các sản phẩm Micro SaaS và dịch vụ số.",
      href: "/microm",
      tag: "Micro SaaS",
      icon: <LayersIcon className="size-5 text-sky-400" />,
      accentBorder: "hover:border-sky-500/40",
      accentBg: "hover:bg-sky-500/[0.03]",
      badge: "P&L",
      badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    },
    {
      title: "Pocdy",
      description:
        "Quản lý hoạt động kinh doanh thương hiệu xuyên biên giới và kênh thanh toán.",
      href: "/dashboard?team=pocdy",
      tag: "Cross-border Brand",
      icon: <CreditCardIcon className="size-5 text-amber-400" />,
      accentBorder: "hover:border-amber-500/40",
      accentBg: "hover:bg-amber-500/[0.03]",
      badge: "Brand Ops",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
  ];

  return (
    <>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-3 sm:px-6 backdrop-blur-md sticky top-0 z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground shrink-0" />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate hidden xs:inline">
              MatureX
            </span>
            <span className="text-muted-foreground/40 hidden xs:inline">/</span>
            <span className="text-xs font-medium text-foreground truncate">
              Workspace Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono">System Online</span>
          </div>

          <Avatar className="size-7 ring-1 ring-border/80">
            <AvatarImage src="https://github.com/shadcn.png" alt="Admin" />
            <AvatarFallback className="text-[11px] font-semibold bg-muted">
              MX
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8 max-w-6xl mx-auto w-full min-w-0">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <LayoutDashboardIcon className="size-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading">
                MatureX Workspace
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
              Cổng điều hành trung tâm quản lý tài chính, kinh doanh và đồng bộ
              dữ liệu cho các đội ngũ MatureX.
            </p>
          </div>
        </div>

        {/* Workspaces Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Các Workspace trực thuộc
            </h2>
            <span className="text-[11px] text-muted-foreground font-mono">
              {workspaces.length} teams
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspaces.map((ws) => (
              <Link
                key={ws.title}
                href={ws.href}
                className={`group relative flex flex-col justify-between p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs transition-all duration-200 ${ws.accentBorder} ${ws.accentBg} shadow-xs hover:shadow-md`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-muted/40 group-hover:scale-105 transition-transform duration-200">
                      {ws.icon}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono font-medium ${ws.badgeClass}`}
                    >
                      {ws.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                      {ws.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {ws.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {ws.tag}
                  </span>
                  <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-1 font-medium transition-colors">
                    Truy cập
                    <ArrowRightIcon className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section placeholder for User's upcoming Home UI */}
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            Khu vực sẵn sàng để bạn tùy biến và phát triển giao diện trang chủ
            theo nhu cầu.
          </p>
        </div>
      </main>
    </>
  );
}
