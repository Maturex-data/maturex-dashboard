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
