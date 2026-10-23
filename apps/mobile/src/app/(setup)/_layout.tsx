import { Stack } from "expo-router";

import { useResumeOnUnlock } from "@/lib/use-resume-on-unlock";

export default function SetupLayout() {
  useResumeOnUnlock();
  return <Stack screenOptions={{ headerShown: false }} />;
}
