import { redirect } from "next/navigation";

// Retired. The Engine's front door is /portal/new-use-case (wireframe 23a/23b);
// this route only exists so older links land on the right screen.
export default function DefineRedirect() {
  redirect("/portal/new-use-case");
}
