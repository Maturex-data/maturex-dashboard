process.env.USE_NATIVE_PRISMA = "true";

import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

import { runMicromProviderToSheetSync } from "@/lib/microm/sync-provider-to-sheet";

async function main() {
  const daysString = process.env.SYNC_DAYS || process.argv[2] || "14";
  const days = parseInt(daysString, 10);
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceDate = from.toISOString().slice(0, 10);

  console.log(`Starting Microm Provider-to-Sheet sync for the last ${days} days (since: ${sinceDate})...`);
  const startTime = Date.now();

  try {
    const result = await runMicromProviderToSheetSync({
      triggerType: "SCHEDULED",
      actor: "github_actions_runner",
      sinceDate,
    });

    console.log("Sync Status:", result.status);
    console.log("Is Reconciled:", result.isReconciled);
    console.log("Sources Summary:", JSON.stringify(result.sources, null, 2));

    if (result.errors && result.errors.length > 0) {
      console.error("Errors encountered:", result.errors);
    }

    if (!result.isReconciled || result.status !== "SUCCESS") {
      console.error("Sync did not reconcile completely.");
      process.exit(1);
    }

    console.log(`Microm Provider-to-Sheet sync completed successfully in ${Date.now() - startTime}ms.`);
  } catch (error) {
    console.error("Failed to run Microm Provider-to-Sheet sync:", error);
    process.exit(1);
  }
}

main();
