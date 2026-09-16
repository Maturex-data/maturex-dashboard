const DEFAULT_API_VERSION = "2026-07";

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export type ShopifyTestResult = {
  shop: {
    name: string;
    myshopifyDomain: string;
    currencyCode: string;
  };
  orders: Array<{
    id: string;
    name: string;
    createdAt: string;
    displayFinancialStatus: string | null;
    displayFulfillmentStatus: string | null;
    totalPrice: string;
    currencyCode: string;
    customerName: string | null;
  }>;
};

type ShopifyQueryData = {
  shop: ShopifyTestResult["shop"];
  orders: {
    nodes: Array<{
      id: string;
      name: string;
      createdAt: string;
      displayFinancialStatus: string | null;
      displayFulfillmentStatus: string | null;
      currentTotalPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
      customer: { displayName: string } | null;
    }>;
  };
};

const TEST_QUERY = `
  query ShopifyConnectionTest {
    shop {
      name
      myshopifyDomain
      currencyCode
    }
    orders(first: 10, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        currentTotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          displayName
        }
      }
    }
  }
`;

function getStoreDomain(): string {
  const configuredDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();

  if (!configuredDomain) {
    throw new Error("Thiếu biến môi trường SHOPIFY_STORE_DOMAIN.");
  }

  return configuredDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function testShopifyConnection(): Promise<ShopifyTestResult> {
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new Error("Thiếu biến môi trường SHOPIFY_ACCESS_TOKEN.");
  }

  const apiVersion = process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;
  const endpoint = `https://${getStoreDomain()}/admin/api/${apiVersion}/graphql.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query: TEST_QUERY }),
    cache: "no-store",
  });

  const payload =
    (await response.json()) as ShopifyGraphqlResponse<ShopifyQueryData>;

  if (!response.ok) {
    throw new Error(
      `Shopify trả về HTTP ${response.status}: ${
        payload.errors?.map((error) => error.message).join("; ") ||
        "Unknown error"
      }`,
    );
  }

  if (payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.map((error) => error.message).join("; ") ||
        "Shopify không trả về dữ liệu.",
    );
  }

  return {
    shop: payload.data.shop,
    orders: payload.data.orders.nodes.map((order) => ({
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      displayFinancialStatus: order.displayFinancialStatus,
      displayFulfillmentStatus: order.displayFulfillmentStatus,
      totalPrice: order.currentTotalPriceSet.shopMoney.amount,
      currencyCode: order.currentTotalPriceSet.shopMoney.currencyCode,
      customerName: order.customer?.displayName || null,
    })),
  };
}
