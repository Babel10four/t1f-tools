import { redirect } from "next/navigation";

/** Root entry → primary internal hub (TICKET-006). */
export default function Home() {
  redirect("/tools");
}
