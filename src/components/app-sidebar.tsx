"use client";

import {
  BarChart3Icon,
  ChartNoAxesCombinedIcon,
  CloudIcon,
  CreditCardIcon,
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
      href: "/",
    },
    {
      name: "Flowa",
      logo: <SparklesIcon className="size-4 text-purple-400" />,
      plan: "Digital / Media",
      href: "/flowa",
    },
    {
      name: "Microm",
      logo: <LayersIcon className="size-4 text-sky-400" />,
      plan: "Micro SaaS",
      href: "/dashboard?team=microm",
    },
    {
      name: "Pocdy",
      logo: <CreditCardIcon className="size-4 text-amber-400" />,
      plan: "Cross-border Brand",
      href: "/dashboard?team=pocdy",
    },
  ],
  navMain: [
    {
      title: "Tổng quan dữ liệu",
      url: "/",
      icon: <BarChart3Icon />,
      badge: "Realtime",
    },
    {
      title: "Báo cáo kinh doanh",
      url: "/business-report",
      icon: <ChartNoAxesCombinedIcon />,
      badge: "P&L",
    },
    {
      title: "EC Drive Sync",
      url: "/ec-drive-sync",
      icon: <CloudIcon />,
      badge: "Raw data",
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

  const flowaNav = [
    {
      title: "Bảng dữ liệu Etsy",
      url: "/flowa",
      icon: <ShoppingBagIcon className="size-4 text-purple-500" />,
      isActive: pathname === "/flowa",
    },
    {
      title: "Import & Lịch sử file",
      url: "/flowa/import",
      icon: <UploadCloudIcon className="size-4 text-purple-500" />,
      isActive: pathname === "/flowa/import",
    },
    {
      title: "Flowa Drive Sync",
      url: "/flowa/drive-sync",
      icon: <CloudIcon className="size-4 text-purple-500" />,
      isActive: pathname === "/flowa/drive-sync",
    },
  ];

  const ecNav = data.navMain.map((item) => ({
    ...item,
    isActive: pathname === item.url,
  }));
  const navigation = pathname.startsWith("/flowa") ? flowaNav : ecNav;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/60 bg-sidebar/50 backdrop-blur-xs"
      {...props}
    >
      <SidebarHeader className="p-3">
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent className="px-2">
        <NavMain items={navigation} />
      </SidebarContent>
      <SidebarFooter className="p-3">
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
