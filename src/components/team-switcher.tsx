"use client";

import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string;
    logo: React.ReactNode;
    plan: string;
    href: string;
  }[];
}) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);

  React.useEffect(() => {
    const routeTeam = teams.find((team) => {
      if (team.href === "/") {
        return pathname === "/";
      }
      return pathname.startsWith(team.href);
    });
    if (routeTeam) {
      setActiveTeam(routeTeam);
    }
  }, [pathname, teams]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !/^[1-4]$/.test(event.key)) {
        return;
      }

      const team = teams[Number(event.key) - 1];
      if (!team) {
        return;
      }

      event.preventDefault();
      setActiveTeam(team);
      router.push(team.href);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [router, teams]);

  if (!activeTeam) {
    return null;
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-12 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 data-open:bg-muted/60 transition-all p-2 gap-2.5"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs border border-white/10 shrink-0">
              {activeTeam.logo}
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold text-foreground">
                  {activeTeam.name}
                </span>
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              </div>
              <span className="truncate text-[10px] text-muted-foreground font-mono">
                {activeTeam.plan}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-3.5 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-60 p-1.5"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={6}
          >
            <DropdownMenuGroup>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                MatureX Teams
              </div>
              {teams.map((team, index) => {
                const isSelected = team.name === activeTeam.name;
                return (
                  <DropdownMenuItem
                    key={team.name}
                    onClick={() => {
                      setActiveTeam(team);
                      router.push(team.href);
                    }}
                    className={`gap-2.5 p-2 rounded-lg cursor-pointer text-xs ${
                      isSelected
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-2xs shrink-0">
                      {team.logo}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate font-medium">{team.name}</span>
                      <span className="truncate text-[10px] text-muted-foreground font-mono">
                        {team.plan}
                      </span>
                    </div>
                    <DropdownMenuShortcut className="font-mono text-[10px]">
                      ⌘{index + 1}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-2 p-2 rounded-lg text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                <div className="flex size-6 items-center justify-center rounded-md border border-dashed border-border/80 bg-background">
                  <PlusIcon className="size-3.5" />
                </div>
                <div className="font-medium">Thêm Team mới</div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
