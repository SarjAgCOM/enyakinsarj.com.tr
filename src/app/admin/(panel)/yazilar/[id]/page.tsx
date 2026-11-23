import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "Yazıyı düzenle" };

export default async function EditPostPage({ params }: PageProps<"/admin/yazilar/[id]">) {
  const { id } = await params;
  return <PostEditor postId={id} />;
}
