import { createCallerFactory, createTRPCRouter } from "./trpc";
import { aiRouter, blogRouter, providerRouter, stationRouter } from "./routers/public";
import { adminRouter } from "./routers/admin";

export const appRouter = createTRPCRouter({
  station: stationRouter,
  provider: providerRouter,
  ai: aiRouter,
  blog: blogRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
