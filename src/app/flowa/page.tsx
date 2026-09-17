import {
  ArrowUpRightIcon,
  DollarSignIcon,
  FolderKanbanIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { FlAppCostTable } from "@/components/dashboard/fl/fl-app-cost-table";
import { mockAppCostRecords } from "@/lib/mock-data";

const metrics = [
  {
    label: "Monthly revenue",
    value: "$0.00",
    icon: DollarSignIcon,
  },
  {
    label: "Active projects",
    value: "0",
    icon: FolderKanbanIcon,
  },
  {
    label: "Team members",
    value: "0",
    icon: UsersIcon,
  },
];

export default function FlowaPage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-border/50 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-purple-400">
            <SparklesIcon className="size-4" />
          </div>
          <div>
            <p className="font-semibold leading-none">Flowa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Digital / Media
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <section>
          <p className="text-sm text-muted-foreground">Workspace overview</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-semibold text-2xl tracking-tight">
              Flowa workspace
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              <ArrowUpRightIcon className="size-3" />
              Connected
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <article
              className="rounded-xl border bg-background p-4"
              key={metric.label}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <metric.icon className="size-4 text-purple-500" />
              </div>
              <p className="mt-5 font-semibold text-3xl tracking-tight">
                {metric.value}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border bg-background">
          <div className="border-b p-4">
            <h2 className="font-medium">App costs</h2>
            <p className="text-sm text-muted-foreground">
              Digital and media subscriptions for the Flowa workspace
            </p>
          </div>
          <FlAppCostTable records={mockAppCostRecords} />
        </section>
      </main>
    </>
  );
}
