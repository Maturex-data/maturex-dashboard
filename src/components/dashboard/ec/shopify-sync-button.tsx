"use client";

import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { syncShopifyAction } from "@/actions/shopify";
import { Button } from "@/components/ui/button";

export function ShopifySyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync(): Promise<void> {
    setIsSyncing(true);
    setMessage(null);

    try {
      const res = await syncShopifyAction();

      if (!res.success || !res.data) {
        throw new Error(res.error || "Shopify sync failed.");
      }

      const payload = res.data;
      setMessage(
        `${payload.addedCount} added, ${payload.skippedCount} skipped across ${payload.pageCount} pages.`,
      );
      window.dispatchEvent(new Event("shopify-orders-sync"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Shopify sync failed.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        aria-label="Sync Shopify orders"
        disabled={isSyncing}
        onClick={handleSync}
        size="sm"
        title="Sync Shopify orders"
        variant="outline"
      >
        <RefreshCwIcon className={isSyncing ? "animate-spin" : undefined} />
        Sync
      </Button>
      {message ? (
        <p className="max-w-56 text-right text-muted-foreground text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
}
