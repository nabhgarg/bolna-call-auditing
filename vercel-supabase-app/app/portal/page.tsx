import { redirect } from "next/navigation";

// Portal home · the client lands on New use case (wireframe 23a): describe the
// job, we work out what to measure. Everything else in the nav is what happens
// after a use case exists.
export default function PortalIndex() {
  redirect("/portal/new-use-case");
}
