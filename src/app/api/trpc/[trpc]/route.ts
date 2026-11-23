import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

export const dynamic = "force-dynamic";
// Yapay zekâ ile yazı üretimi uzun sürebilir
export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => console.error(`❌ tRPC /${path ?? "?"}: ${error.message}`)
        : ({ path, error }) => {
            if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC /${path ?? "?"}`, error);
          },
  });

export { handler as GET, handler as POST };
