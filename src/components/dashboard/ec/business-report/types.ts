export type MonthlyInput = {
  subscriptionCost: number;
  confirmedToolsCost: number;
  vietnamToolsCost: number;
  personnelCost: number;
  allocatedOverheadCost: number;
  welfareCost: number;
  note: string | null;
};

export type MonthReport = {
  month: string;
  inputs: MonthlyInput;
  metrics: Record<string, number>;
};

export type EcPnlApiResponse = {
  months: string[];
  reports: MonthReport[];
  error?: string;
};

export type ReportRow = {
  code: string;
  label: string;
  metric?: string;
  source: string;
  kind?: "section" | "total" | "ratio" | "standard";
};
