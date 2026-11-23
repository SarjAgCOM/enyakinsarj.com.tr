"use client";

import { AdminPageTitle } from "@/components/admin/page-title";
import { MediaGrid } from "@/components/admin/media-library";

export default function MediaPage() {
  return (
    <>
      <AdminPageTitle title="Medya" description="Görseller Oracle Cloud Object Storage bucket'ına yüklenir." />
      <MediaGrid />
    </>
  );
}
