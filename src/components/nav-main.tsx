"use client";

import { ChevronRightIcon } from "lucide-react";
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
    <SidebarGroup className="py-2">
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">
        Workspace Navigation
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1 mt-1">
        {items.map((item) => (
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
                  className="gap-2.5 px-3 py-2 h-9 text-xs font-medium rounded-lg text-foreground/80 hover:text-foreground hover:bg-muted/60 data-[state=open]:text-foreground data-[state=open]:bg-muted/40 transition-all cursor-pointer"
                />
              }
            >
              <span className="size-4 shrink-0 text-muted-foreground group-hover/collapsible:text-foreground transition-colors">
                {item.icon}
              </span>
              <span className="truncate">{item.title}</span>
              {item.badge ? (
                <span className="ml-auto mr-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                  {item.badge}
                </span>
              ) : null}
              <ChevronRightIcon className="ml-auto size-3.5 text-muted-foreground/60 transition-transform duration-200 group-data-open/collapsible:rotate-90" />
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
                          <a href={subItem.url} className="w-full">
                            <span className="flex items-center gap-2 truncate">
                              <span
                                className={`size-1.5 rounded-full shrink-0 transition-colors ${
                                  isCurrentActive
                                    ? "bg-emerald-500"
                                    : "bg-muted-foreground/30 group-hover/sub:bg-foreground/60"
                                }`}
                              />
                              <span className="truncate">{subItem.title}</span>
                            </span>
                            {subItem.badge ? (
                              <span className="ml-auto rounded px-1.5 py-0.2 text-[9px] font-mono font-medium bg-muted text-muted-foreground">
                                {subItem.badge}
                              </span>
                            ) : null}
                          </a>
                        }
                      />
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
