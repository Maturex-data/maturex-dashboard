export {};
process.env.USE_NATIVE_PRISMA = "true";
async function main(){
 const {backfillBoDashboard}=await import("../src/lib/fl/dashboard-sync/backfill");
 const {prisma}=await import("../src/lib/prisma");
 try {console.log(JSON.stringify(await backfillBoDashboard(),null,2));}
 finally {await prisma.$disconnect();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
