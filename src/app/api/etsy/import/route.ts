import { importEtsyFiles } from "@/lib/etsy-import";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const shopCode = formData.get("shopCode");
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (typeof shopCode !== "string" || !shopCode) {
      return Response.json(
        { error: "Vui lòng chọn shop Etsy." },
        { status: 400 },
      );
    }

    return Response.json(await importEtsyFiles(shopCode, files));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Etsy import failed.",
      },
      { status: 500 },
    );
  }
}
