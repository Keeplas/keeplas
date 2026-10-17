// Hermes has neither WebCrypto nor WebAssembly. react-native-quick-crypto
// installs `globalThis.crypto` (subtle AES-GCM, SHA-256, getRandomValues)
// natively, its OpenSSL Argon2 replaces hash-wasm in @keeplas/crypto, and its
// OpenSSL ML-KEM-768 / ML-DSA-65 replace @noble/post-quantum's pure-JS
// implementations, which would otherwise freeze the JS thread.
import QuickCrypto, { install } from "react-native-quick-crypto";
import { setArgon2idImplementation } from "@keeplas/crypto/kdf";
import { setMlKemImplementation } from "@keeplas/crypto/kem";
import { setMlDsaImplementation } from "@keeplas/crypto/sig";

import { createArgon2idEngine, type Argon2Fn } from "./argon2";
import { nativeMlKem, nativeMlDsa } from "./pq-native";

install();
setArgon2idImplementation(
  createArgon2idEngine(QuickCrypto.argon2 as unknown as Argon2Fn),
);
setMlKemImplementation(nativeMlKem);
setMlDsaImplementation(nativeMlDsa);
