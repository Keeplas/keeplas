import { Redirect } from "expo-router";

/**
 * A link the app claims but can't use (e.g. a pairing or capture link
 * without its fragment): open the app where the session stands instead of
 * "Unmatched Route". `index` sends on to the stage's first screen.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
