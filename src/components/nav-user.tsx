"use client";

import {
  BadgeCheckIcon,
  BellIcon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  LogOutIcon,
  SparklesIcon,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
}) {
  const { isMobile } = useSidebar();
  const initials = (user.name || user.email || "MX")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-12 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 data-open:bg-muted/60 transition-all p-2 gap-2.5 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent"
              />
            }
          >
            <Avatar className="size-7 rounded-lg ring-1 ring-border/80 shrink-0">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-xs leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold text-foreground">
                {user.name}
              </span>
              <span className="truncate text-[10px] text-muted-foreground font-mono">
                {user.email}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-3.5 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 p-1.5"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2.5 p-2 text-left text-xs">
                  <Avatar className="size-8 rounded-lg ring-1 ring-border/80 shrink-0">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg bg-emerald-500/10 text-emerald-600 font-semibold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
                    <span className="truncate font-semibold text-foreground">
                      {user.name}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground font-mono">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2 p-2 rounded-lg text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                <SparklesIcon className="size-3.5 text-amber-500" />
                MatureX Workspace Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2 p-2 rounded-lg text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                <BadgeCheckIcon className="size-3.5" />
                Tài khoản & Phân quyền
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 p-2 rounded-lg text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                <CreditCardIcon className="size-3.5" />
                Gói dịch vụ & Chi phí
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 p-2 rounded-lg text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                <BellIcon className="size-3.5" />
                Thông báo hệ thống
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={async () => {
                await logoutAction();
              }}
              className="gap-2 p-2 rounded-lg text-xs cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
            >
              <LogOutIcon className="size-3.5" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
