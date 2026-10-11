// Hermes has neither WebCrypto nor WebAssembly. react-native-quick-crypto
// installs `globalThis.crypto` (subtle AES-GCM, SHA-256, getRandomValues)
// natively, and its OpenSSL Argon2 replaces hash-wasm in @keeplas/crypto.
// @noble/post-quantum is pure JS and runs as is on top of getRandomValues.
import QuickCrypto, { install } from "react-native-quick-crypto";
import { setArgon2idImplementation } from "@keeplas/crypto/kdf";

import { createArgon2idEngine, type Argon2Fn } from "./argon2";

install();
setArgon2idImplementation(
  createArgon2idEngine(QuickCrypto.argon2 as unknown as Argon2Fn),
);
