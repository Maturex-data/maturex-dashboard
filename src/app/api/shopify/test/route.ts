import { testShopifyConnection } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await testShopifyConnection();

    return Response.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể kết nối Shopify.";

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
