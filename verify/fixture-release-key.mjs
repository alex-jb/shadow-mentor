// FIXTURE RELEASE KEY — NOT a production secret. Safe to be public: it exists ONLY to sign the
// verify-acceptance manifest + test fixtures so they are reproducible and re-verifiable in CI.
// A real release uses an approved signing key held outside the repo; anything signed with THIS
// key must be labeled FIXTURE RELEASE KEY / 测试发布密钥 and never presented as production-signed.
export const FIXTURE_RELEASE_LABEL = "FIXTURE RELEASE KEY";

export const FIXTURE_RELEASE_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAqEUmIuPWQhhRKpOB34ICb++uwx9r8aLVEdXNzWNcHgs=
-----END PUBLIC KEY-----`;

export const FIXTURE_RELEASE_PRIVATE_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIApxdM5jomLXbbrHPPGq6BuA61UcXOSRxnfpoagsiJtw
-----END PRIVATE KEY-----`;
