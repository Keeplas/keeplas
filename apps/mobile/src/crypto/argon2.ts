import type { Argon2idImplementation } from "@keeplas/crypto/kdf";

/** Node-style Argon2 entry point (react-native-quick-crypto, Node ≥ 24.7). */
export type Argon2Fn = (
  algorithm: "argon2id",
  params: {
    message: string;
    nonce: Uint8Array;
    passes: number;
    memory: number;
    parallelism: number;
    tagLength: number;
  },
  callback: (err: Error | null, result: Uint8Array) => void,
) => void;

/**
 * Adapt a Node-style `argon2` to `@keeplas/crypto`'s engine contract:
 * Argon2id, `iterations` → passes, `memorySize` (KiB) → memory, raw digest.
 * Must reproduce the shared vector in packages/crypto/__tests__/argon2.test.ts.
 */
export function createArgon2idEngine(argon2: Argon2Fn): Argon2idImplementation {
  return ({
    password,
    salt,
    iterations,
    memorySize,
    parallelism,
    hashLength,
  }) =>
    new Promise((resolve, reject) => {
      argon2(
        "argon2id",
        {
          message: password,
          nonce: salt,
          passes: iterations,
          memory: memorySize,
          parallelism,
          tagLength: hashLength,
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(new Uint8Array(result));
        },
      );
    });
}
