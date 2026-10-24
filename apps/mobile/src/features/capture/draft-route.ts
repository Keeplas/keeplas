import { useEffect } from "react";
import { useLocalSearchParams, type Href } from "expo-router";

import { draftStore, useDrafts } from "./draft-store";

type CaptureScreen = "/capture/compose" | "/capture/scan" | "/capture/voice";

export function draftHref(pathname: CaptureScreen): Href {
  return { pathname, params: { draft: draftStore.get().id } };
}

export function useDraftParam() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const saved = useDrafts();

  useEffect(() => {
    if (draft) draftStore.open(draft);
  }, [draft, saved]);
}
