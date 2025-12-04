/**
 * Helper to check if a wallet address is an exempt admin/dev/marketer
 * These accounts are always considered to have an 'active' license.
 */
export function isExemptAdmin(address: string): boolean {
    if (!address) return false;

    const admins = [
        process.env.VITE_ADMIN_ADDRESS,
        process.env.VITE_DEV_ADDRESS,
        process.env.VITE_MARKETER1_ADDRESS,
        process.env.VITE_MARKETER2_ADDRESS,
        process.env.ADMIN_PUBKEY, // Also check server-side env vars if they differ
        process.env.MARKETER_1_PUBKEY,
        process.env.MARKETER_2_PUBKEY
    ]
        .filter((a): a is string => !!a)
        .map(a => a.trim());

    return admins.includes(address);
}
