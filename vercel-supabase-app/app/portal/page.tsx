import { redirect } from "next/navigation";

// Overall and By-agent are merged into one master-detail "Agent insights"
// screen (see app/portal/agents/page.tsx). The portal root lands there.
export default function PortalIndex() {
  redirect("/portal/agents");
}
