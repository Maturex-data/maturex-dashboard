"use client";

import {
  BarChart3Icon,
  CreditCardIcon,
  LayersIcon,
  PackageIcon,
  Settings2Icon,
  ShoppingBagIcon,
  SparklesIcon,
} from "lucide-react";
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
      title: "Báo Cáo Tài Chính",
      url: "#",
      icon: <BarChart3Icon />,
      isActive: true,
      badge: "Active",
      items: [
        {
          title: "Dữ liệu EC Tổng quan",
          url: "/",
          isActive: true,
          badge: "Realtime",
        },
        {
          title: "Shopify Orders & Payout",
          url: "#",
        },
        {
          title: "Chi phí Meta Ads",
          url: "#",
        },
        {
          title: "Product Cost (COGS)",
          url: "#",
        },
        {
          title: "Airwallex Thu & Chi",
          url: "#",
        },
      ],
    },
    {
      title: "Cung ứng & Fulfillment",
      url: "#",
      icon: <PackageIcon />,
      items: [
        {
          title: "Printify Portal",
          url: "#",
          badge: "API",
        },
        {
          title: "PG Print 1",
          url: "#",
        },
        {
          title: "Google Sheet LPro",
          url: "#",
          badge: "Sync",
        },
      ],
    },
    {
      title: "Cài đặt Workspace",
      url: "#",
      icon: <Settings2Icon />,
      items: [
        {
          title: "Tài khoản & Phân quyền",
          url: "#",
        },
        {
          title: "API Cổng thanh toán",
          url: "#",
        },
      ],
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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="p-3">
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
