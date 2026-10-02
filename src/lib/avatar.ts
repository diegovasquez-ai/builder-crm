export function getInitials(name: string | null | undefined, fallback = "?"): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const AVATAR_PALETTE = [
  "bg-indigo-500/15 text-indigo-700",
  "bg-emerald-500/15 text-emerald-700",
  "bg-amber-500/15 text-amber-700",
  "bg-rose-500/15 text-rose-700",
  "bg-violet-500/15 text-violet-700",
  "bg-sky-500/15 text-sky-700",
  "bg-teal-500/15 text-teal-700",
] as const;

export function avatarBg(seed: string | null | undefined): string {
  if (!seed) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
