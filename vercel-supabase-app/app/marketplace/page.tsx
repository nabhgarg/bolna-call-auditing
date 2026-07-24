import { redirect } from "next/navigation";

// The company-facing marketplace page is retired. /marketplace is the
// supply-side "work with us" page (apply + assignment).
export default function Marketplace() {
  redirect("/marketplace/join");
}
