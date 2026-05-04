import bcrypt from "bcrypt";
const SALT_ROUNDS = 12;
/**
 * Hash a plain-text password
 */
export async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}
/**
 * Compare a plain-text password against a stored hash
 */
export async function comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
//# sourceMappingURL=hash.js.map