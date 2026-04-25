import { redirect } from "next/navigation";

export default function ScenarioRedirect() {
  redirect("/life-check?tab=reaction");
}
