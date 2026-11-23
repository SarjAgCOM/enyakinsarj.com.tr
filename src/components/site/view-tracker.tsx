"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";

export function ViewTracker({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const { mutate } = useMutation(trpc.blog.view.mutationOptions());
  useEffect(() => {
    const t = setTimeout(() => mutate({ slug }), 3000);
    return () => clearTimeout(t);
  }, [slug, mutate]);
  return null;
}
