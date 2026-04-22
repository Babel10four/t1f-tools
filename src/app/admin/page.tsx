import { redirect } from "next/navigation";

/** Admin entry — hub lives at dashboard (ADMIN-001). */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
