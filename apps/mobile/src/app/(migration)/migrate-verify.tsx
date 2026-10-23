import { useRouter } from "expo-router";

import { PhoneCodeStep } from "@/features/phone-change";

/** M09-7 step 2: the WhatsApp code that verifies the new sign-in number. */
export default function MigrateVerify() {
  const router = useRouter();
  return <PhoneCodeStep onVerified={() => router.replace("/move-to-phone")} />;
}
