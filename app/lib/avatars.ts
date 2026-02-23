export const OPEN_DOODLE_AVATARS = [
  "/avatars/ba.webp",
  "/avatars/ball.webp",
  "/avatars/bear.webp",
  "/avatars/camaleon.webp",
  "/avatars/eagle.webp",
  "/avatars/fish-blue.webp",
  "/avatars/fish-gold.webp",
  "/avatars/fox.webp",
  "/avatars/frog.webp",
  "/avatars/lion.webp",
  "/avatars/lucertola.webp",
  "/avatars/owl.webp",
  "/avatars/panda.webp",
  "/avatars/parrot.webp",
  "/avatars/ra.webp",
  "/avatars/rose.webp",
  "/avatars/shoes.webp",
  "/avatars/spinoso.webp",
  "/avatars/tiger.webp",
  "/avatars/toyduck.webp",
  "/avatars/ufo.webp",
  "/avatars/wolf.webp",
  "/avatars/world.webp",
] as const;

export const NO_AVATAR_VALUE = "__none__";

export function isValidOpenDoodleAvatar(value: string) {
  return OPEN_DOODLE_AVATARS.includes(value as (typeof OPEN_DOODLE_AVATARS)[number]);
}
