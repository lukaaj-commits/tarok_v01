// Slike igralcev (enako kot na zaslonih Aktivna igra in Zgodovina)
const PLAYER_IMAGES: Record<string, string> = {
  "Filip": "https://i.postimg.cc/jW6qppPX/filip01.png",
  "Luka M": "https://i.postimg.cc/FHDntBY5/luka-M02.png",
  "Luka Š": "https://i.postimg.cc/CZCM33kc/luka-S01.png",
  "Mark": "https://i.postimg.cc/t1dRKKWr/mark01.png",
  "Metka": "https://i.postimg.cc/67V6kknj/metka01.png",
  "Miha": "https://i.postimg.cc/8Fdk22M0/miha01.png",
  "Nejc": "https://i.postimg.cc/ph2VRsJQ/nejc01.png",
  "Sara": "https://i.postimg.cc/wy6xgwQQ/sara01.png",
  "Tiffany": "https://i.postimg.cc/7GxPwKnN/tiff01.png",
  "Tina": "https://i.postimg.cc/tZXRpBN5/tina01.png"
};

export const getAvatarUrl = (name: string) => {
  const cleanName = name.trim();
  if (PLAYER_IMAGES[cleanName]) return PLAYER_IMAGES[cleanName];
  return `https://api.dicebear.com/8.x/lorelei/png?seed=${encodeURIComponent(cleanName)}&backgroundColor=transparent`;
};
