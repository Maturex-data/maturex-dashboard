"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: React.ReactNode;
    isActive?: boolean;
    badge?: string;
    items?: {
      title: string;
      url: string;
      isActive?: boolean;
      badge?: string;
    }[];
  }[];
}) {
  return (
    <SidebarGroup className="p-2">
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">
        Workspace Navigation
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1 mt-1">
        {items.map((item) => {
          const hasSubmenu = item.items && item.items.length > 0;

          if (!hasSubmenu) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={item.isActive}
                  className={`gap-2.5 px-3 py-2 h-9 text-xs font-medium rounded-lg transition-all cursor-pointer group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center ${
                    item.isActive
                      ? "bg-foreground/10 text-foreground font-semibold"
                      : "text-foreground/80 hover:text-foreground hover:bg-muted/60"
                  }`}
                  render={
                    <Link
                      href={item.url}
                      className="flex w-full items-center group-data-[collapsible=icon]:justify-center"
                    >
                      <span className="size-4 shrink-0 text-muted-foreground transition-colors flex items-center justify-center">
                        {item.icon}
                      </span>
                      <span className="truncate ml-2.5 group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                      {item.badge ? (
                        <span className="ml-auto rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono font-medium group-data-[collapsible=icon]:hidden">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  }
                />
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible
              key={item.title}
              defaultOpen={item.isActive}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="gap-2.5 px-3 py-2 h-9 text-xs font-medium rounded-lg text-foreground/80 hover:text-foreground hover:bg-muted/60 data-[state=open]:text-foreground data-[state=open]:bg-muted/40 transition-all cursor-pointer group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
                  />
                }
              >
                <span className="size-4 shrink-0 text-muted-foreground group-hover/collapsible:text-foreground transition-colors flex items-center justify-center">
                  {item.icon}
                </span>
                <span className="truncate ml-2.5 group-data-[collapsible=icon]:hidden">
                  {item.title}
                </span>
                {item.badge ? (
                  <span className="ml-auto mr-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono font-medium group-data-[collapsible=icon]:hidden">
                    {item.badge}
                  </span>
                ) : null}
                <ChevronRightIcon className="ml-auto size-3.5 text-muted-foreground/60 transition-transform duration-200 group-data-open/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="mx-3.5 my-1 border-l border-border/60 pl-3 pr-1 py-1 space-y-0.5">
                  {item.items?.map((subItem) => {
                    const isCurrentActive = subItem.isActive;
                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          isActive={isCurrentActive}
                          className={`h-8 px-2.5 rounded-md text-xs transition-all flex items-center justify-between group/sub ${
                            isCurrentActive
                              ? "bg-foreground/5 font-semibold text-foreground border border-foreground/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-normal"
                          }`}
                          render={
                            <Link href={subItem.url} className="w-full">
                              <span className="flex items-center gap-2 truncate">
                                <span
                                  className={`size-1.5 rounded-full shrink-0 transition-colors ${
                                    isCurrentActive
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground/30 group-hover/sub:bg-foreground/60"
                                  }`}
                                />
                                <span className="truncate">
                                  {subItem.title}
                                </span>
                              </span>
                              {subItem.badge ? (
                                <span className="ml-auto rounded px-1.5 py-0.2 text-[9px] font-mono font-medium bg-muted text-muted-foreground">
                                  {subItem.badge}
                                </span>
                              ) : null}
                            </Link>
                          }
                        />
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
