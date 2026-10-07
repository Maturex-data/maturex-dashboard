import { ETSY_SHOPS, type EtsyShopCode } from "@/lib/fl/etsy-constants";

/**
 * Cấu hình nhóm BO (business owner) cho trang Import Statement theo BO.
 * BO là nhóm nghiệp vụ, không phải quyền tài khoản.
 * Thêm BO mới: bổ sung một phần tử vào `BO_GROUPS` với mã shop có trong `ETSY_SHOPS`.
 */
export interface BoGroupConfig {
  id: string;
  name: string;
  shops: readonly EtsyShopCode[];
}

export interface BoShopOption {
  code: EtsyShopCode;
  name: string;
}

export interface BoGroup {
  id: string;
  name: string;
  shops: BoShopOption[];
}

export const BO_GROUPS = [
  {
    id: "mr-phuc",
    name: "Mr. Phúc",
    shops: ["EVERNEST", "ORIVIA", "KINDLORA"],
  },
  {
    id: "ms-linh",
    name: "Ms. Linh",
    shops: ["97DECOR", "TIMOND"],
  },
  { id: "mr-nam", name: "Mr. Nam", shops: ["TIMOND"] },
] as const satisfies readonly BoGroupConfig[];

export const DEFAULT_BO_ID: string = BO_GROUPS[0].id;

export const BO_QUERY_PARAM = "bo";

/** Giới hạn chọn file, đồng bộ với giới hạn import hiện tại. */
export const BO_IMPORT_MAX_FILES = 100;
export const BO_IMPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const BO_IMPORT_ACCEPTED_EXTENSIONS = [".csv", ".xlsx"] as const;

function toBoGroup(config: BoGroupConfig): BoGroup {
  return {
    id: config.id,
    name: config.name,
    shops: config.shops.map((code) => ({
      code,
      name: ETSY_SHOPS.find((shop) => shop.code === code)?.name ?? code,
    })),
  };
}

export function getBoGroups(): BoGroup[] {
  return BO_GROUPS.map(toBoGroup);
}

/** Trả về id BO hợp lệ; thiếu hoặc sai sẽ dùng BO mặc định. */
export function resolveBoId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BO_GROUPS.some((group) => group.id === candidate)
    ? (candidate as string)
    : DEFAULT_BO_ID;
}

export function isLinhShop(code: string): boolean {
  return (
    BO_GROUPS.find((group) => group.id === "ms-linh")?.shops.some(
      (shop) => shop === code,
    ) ?? false
  );
}

/** Phạm vi các BO dùng luồng import Etsy hiện có. */
export function canImportBoShop(boId: string, shopCode: string): boolean {
  return (
    BO_GROUPS.find((group) => group.id === boId)?.shops.some(
      (shop: string) => shop === shopCode,
    ) ?? false
  );
}

export interface BoSheetDestination {
  spreadsheetId: string;
  ordersSheetId: number;
  itemsSheetId: number;
  statementSheetId: number;
  cogsHeaderRow: number;
  extendedStatement?: boolean;
}

const LINH_DESTINATION: BoSheetDestination = {
  spreadsheetId: "1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do",
  ordersSheetId: 839747432,
  itemsSheetId: 136409036,
  statementSheetId: 69264119,
  cogsHeaderRow: 2,
};
const NAM_DESTINATION: BoSheetDestination = {
  spreadsheetId: "1lljLIG41N-LGmOR0dLq1jxaNY4B9RGkGNCVVvhkiBcw",
  ordersSheetId: 11216734,
  itemsSheetId: 926543721,
  statementSheetId: 1957049761,
  cogsHeaderRow: 1,
};

const PHUC_DESTINATION: BoSheetDestination = {
  spreadsheetId: "1QFRzd6-gZ9zrjUtywnTeQMotvAVL_0nGUqhAvRZ6_BM",
  ordersSheetId: 1775631154,
  itemsSheetId: 2092427388,
  statementSheetId: 51793608,
  cogsHeaderRow: 3,
  extendedStatement: true,
};

export function getBoShopName(shopCode: string): string {
  const shop = ETSY_SHOPS.find((shop) => shop.code === shopCode);
  if (!shop) throw new Error("Shop không hợp lệ.");
  return shop.name;
}

export function getBoName(boId: string): string {
  return BO_GROUPS.find((group) => group.id === boId)?.name ?? boId;
}

export function getBoSheetDestination(boId: string): BoSheetDestination {
  if (boId === "mr-phuc") return PHUC_DESTINATION;
  if (boId === "mr-nam") return NAM_DESTINATION;
  if (boId === "ms-linh") return LINH_DESTINATION;
  throw new Error("BO chưa được cấu hình Sheet đích.");
}
