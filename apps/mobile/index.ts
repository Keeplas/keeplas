// Entry point. Polyfills first: WebCrypto + native Argon2id must be in place
// before any module touches `crypto` (@keeplas/crypto, @noble/post-quantum).
import "./src/crypto/install";
import "expo-router/entry";
