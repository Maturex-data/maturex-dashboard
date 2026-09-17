import {
  ArrowUpRightIcon,
  CircleCheckIcon,
  Clock3Icon,
  DollarSignIcon,
  DownloadIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const metrics = [
  {
    label: "Total revenue",
    value: "$128.4K",
    change: "+12.5%",
    icon: <DollarSignIcon />,
  },
  {
    label: "Active users",
    value: "24,892",
    change: "+8.2%",
    icon: <UsersIcon />,
  },
  {
    label: "Conversion rate",
    value: "6.84%",
    change: "+1.1%",
    icon: <TrendingUpIcon />,
  },
];

const activities = [
  "New enterprise workspace upgraded",
  "Usage limit alert resolved",
  "Quarterly revenue export completed",
  "Model evaluation report published",
];

const deals = [
  {
    account: "Acme Inc",
    owner: "N. Tran",
    stage: "Negotiation",
    value: "$42,000",
  },
  {
    account: "Northstar Labs",
    owner: "M. Lee",
    stage: "Proposal",
    value: "$18,500",
  },
  {
    account: "Orbit Studio",
    owner: "A. Pham",
    stage: "Discovery",
    value: "$9,800",
  },
];

export default function Page() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Maturex</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <section className="flex flex-col gap-3 rounded-xl border bg-background p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Overview</p>
            <h1 className="font-semibold text-2xl tracking-tight">
              Revenue operations
            </h1>
          </div>
          <Button variant="outline" size="sm">
            <DownloadIcon />
            Export report
          </Button>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <article
              className="rounded-xl border bg-background p-4"
              key={metric.label}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">{metric.label}</p>
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                  {metric.icon}
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <p className="font-semibold text-3xl tracking-tight">
                  {metric.value}
                </p>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 text-xs">
                  <ArrowUpRightIcon className="size-3" />
                  {metric.change}
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="grid flex-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-xl border bg-background">
            <div className="border-b p-4">
              <h2 className="font-medium">Pipeline forecast</h2>
              <p className="text-muted-foreground text-sm">
                Weighted opportunity value by active stage
              </p>
            </div>
            <div className="space-y-5 p-4">
              {deals.map((deal) => (
                <div
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                  key={deal.account}
                >
                  <div>
                    <p className="font-medium">{deal.account}</p>
                    <p className="text-muted-foreground text-sm">
                      Owner {deal.owner}
                    </p>
                  </div>
                  <span className="w-fit rounded-md bg-muted px-2 py-1 text-sm">
                    {deal.stage}
                  </span>
                  <span className="font-medium">{deal.value}</span>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          </article>

          <aside className="rounded-xl border bg-background">
            <div className="border-b p-4">
              <h2 className="font-medium">Recent activity</h2>
              <p className="text-muted-foreground text-sm">
                Latest workspace events
              </p>
            </div>
            <div className="space-y-1 p-2">
              {activities.map((activity, index) => (
                <div
                  className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/60"
                  key={activity}
                >
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {index === 0 ? (
                      <CircleCheckIcon className="size-4" />
                    ) : (
                      <Clock3Icon className="size-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm">{activity}</p>
                    <p className="text-muted-foreground text-xs">
                      {index + 1}h ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}
