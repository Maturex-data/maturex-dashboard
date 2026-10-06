"use client";

import {
  BarChart3Icon,
  ChartNoAxesCombinedIcon,
  CloudIcon,
  FileSpreadsheetIcon,
  GaugeIcon,
  HomeIcon,
  LayersIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "Admin MatureX",
    email: "finance@maturex.com",
    avatar: "/avatars/maturex.jpg",
  },
  teams: [
    {
      name: "EC Team",
      logo: <ShoppingBagIcon className="size-4 text-emerald-400" />,
      plan: "Shopify / POD / Ads",
      href: "/ec",
    },
    {
      name: "ECOMBIUS",
      logo: <SparklesIcon className="size-4 text-purple-400" />,
      plan: "Etsy / Cross-border",
      href: "/ecombius",
    },
    {
      name: "Microm",
      logo: <LayersIcon className="size-4 text-sky-400" />,
      plan: "Micro SaaS",
      href: "/microm",
    },
  ],
};

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
}) {
  const currentUser = user || data.user;
  const pathname = usePathname();

  const homeNav = [
    {
      title: "Trang chủ",
      url: "/",
      icon: <HomeIcon className="size-4 text-emerald-400" />,
      isActive: pathname === "/",
    },
    {
      title: "EC Team",
      url: "/ec",
      icon: <ShoppingBagIcon className="size-4 text-emerald-500" />,
      isActive: pathname.startsWith("/ec"),
    },
    {
      title: "ECOMBIUS",
      url: "/ecombius",
      icon: <SparklesIcon className="size-4 text-purple-500" />,
      isActive:
        pathname.startsWith("/ecombius") || pathname.startsWith("/flowa"),
    },
    {
      title: "Microm Team",
      url: "/microm",
      icon: <LayersIcon className="size-4 text-sky-400" />,
      isActive: pathname.startsWith("/microm"),
    },
  ];

  const ecombiusNav = [
    {
      title: "Bảng dữ liệu Etsy",
      url: "/ecombius",
      icon: <ShoppingBagIcon className="size-4 text-purple-500" />,
      isActive: pathname === "/ecombius" || pathname === "/flowa",
    },
    {
      title: "Import & Lịch sử file",
      url: "/ecombius/import",
      icon: <UploadCloudIcon className="size-4 text-purple-500" />,
      isActive: pathname === "/ecombius/import" || pathname === "/flowa/import",
    },
    {
      title: "Import theo BO",
      url: "/ecombius/bo-import",
      icon: <FileSpreadsheetIcon className="size-4 text-purple-500" />,
      isActive:
        pathname === "/ecombius/bo-import" || pathname === "/flowa/bo-import",
    },
    {
      title: "ECOMBIUS Drive Sync",
      url: "/ecombius/drive-sync",
      icon: <CloudIcon className="size-4 text-purple-500" />,
      isActive:
        pathname === "/ecombius/drive-sync" || pathname === "/flowa/drive-sync",
    },
  ];

  const micromNav = [
    {
      title: "Báo cáo P&L Microm",
      url: "/microm",
      icon: <LayersIcon className="size-4 text-sky-400" />,
      isActive: pathname === "/microm",
    },
  ];

  const ecNav = [
    {
      title: "Tổng quan dữ liệu",
      url: "/ec",
      icon: <BarChart3Icon />,
      badge: "Realtime",
      isActive: pathname === "/ec",
    },
    {
      title: "Báo cáo kinh doanh",
      url: "/ec/business-report",
      icon: <ChartNoAxesCombinedIcon />,
      badge: "P&L",
      isActive: pathname === "/ec/business-report",
    },
    {
      title: "Tiến độ & KPI",
      url: "/ec/progress",
      icon: <GaugeIcon />,
      badge: "Q4 / T10",
      isActive: pathname === "/ec/progress",
    },
    {
      title: "EC Drive Sync",
      url: "/ec/drive-sync",
      icon: <CloudIcon />,
      badge: "Raw data",
      isActive: pathname === "/ec/drive-sync",
    },
  ];

  const navigation =
    pathname.startsWith("/ecombius") || pathname.startsWith("/flowa")
      ? ecombiusNav
      : pathname.startsWith("/microm")
        ? micromNav
        : pathname.startsWith("/ec")
          ? ecNav
          : pathname === "/"
            ? homeNav
            : ecNav;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/60 bg-sidebar/50 backdrop-blur-xs"
      {...props}
    >
      <SidebarHeader className="p-2">
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navigation} />
      </SidebarContent>
      <SidebarFooter className="p-2">
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
