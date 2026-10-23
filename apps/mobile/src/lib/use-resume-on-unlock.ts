import { useEffect } from "react";
import { useRouter } from "expo-router";

import { useSession } from "@/providers/session-provider";

export function useResumeOnUnlock() {
  const router = useRouter();
  const { takeResume } = useSession();

  useEffect(() => {
    const target = takeResume();
    if (target) router.push(target);
  }, [router, takeResume]);
}
