const crypto = require("crypto");

const PBKDF2_ITERATIONS = 260000;

const hashPassword = (password) => {
  if (!password) {
    throw new Error("Password cannot be empty.");
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    32,
    "sha256"
  );
  return [
    "pbkdf2_sha256",
    PBKDF2_ITERATIONS,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
};

const verifyPassword = (password, storedHash) => {
  try {
    const [scheme, iterStr, saltB64, hashB64] = storedHash.split("$");
    if (scheme !== "pbkdf2_sha256") {
      return false;
    }
    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations)) {
      return false;
    }
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      expected.length,
      "sha256"
    );
    return crypto.timingSafeEqual(derived, expected);
  } catch (error) {
    return false;
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
};
