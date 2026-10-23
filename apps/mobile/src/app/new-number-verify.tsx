import { PhoneCodeStep } from "@/features/phone-change";

/** The new number's code: once verified, the stage gate moves on. */
export default function NewNumberVerify() {
  return <PhoneCodeStep />;
}
