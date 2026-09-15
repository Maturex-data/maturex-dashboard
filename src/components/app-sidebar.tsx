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
    },
    {
      name: "Flowa",
      logo: <SparklesIcon className="size-4 text-purple-400" />,
      plan: "Digital / Media",
    },
    {
      name: "Microm",
      logo: <LayersIcon className="size-4 text-sky-400" />,
      plan: "Micro SaaS",
    },
    {
      name: "Pocdy",
      logo: <CreditCardIcon className="size-4 text-amber-400" />,
      plan: "Cross-border Brand",
    },
  ],
  navMain: [
    {
      title: "Báo Cáo Tài Chính",
      url: "#",
      icon: <BarChart3Icon />,
      isActive: true,
      items: [
        {
          title: "Dữ liệu EC (Active)",
          url: "#",
        },
        {
          title: "Shopify & Payout",
          url: "#",
        },
        {
          title: "Chi phí Ads",
          url: "#",
        },
        {
          title: "Product Cost (COGS)",
          url: "#",
        },
        {
          title: "App & Dịch vụ",
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
        },
        {
          title: "PG Print 1",
          url: "#",
        },
        {
          title: "Sheet LPro",
          url: "#",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
