// Classic Survivor tribe-name mashups — each blends two real tribe names from
// past seasons. Used to name the two starting tribes instead of "red"/"blue".
// Internally the tribes are still keyed 'red'/'blue' (channels, permissions);
// these are display names only. Add more freely — the generator picks any two.
export const TRIBE_MASHUPS = [
  'Taganong',   // Tagi + Pagong
  'Nuvati',     // Nuku + Naviti
  'Zapatepe',   // Zapatera + Ometepe
  'Ogamaru',    // Ogakor + Maraamu
  'Kaladang',   // Kalabaw + Tandang
  'Espavaii',   // Espada + Savaii
  'Samburotu',  // Samburu + Rotu
  'Bikalang',   // Bikal + Galang
  'Gotaviti',   // Gota + Naviti
  'Bayonkor',   // Bayon + Angkor
  'Vokasele',   // Vokai + Sele
  'Dakama',     // Dakal + Kama
  'Manulesu',   // Manu + Lesu
  'Tikaratu',   // Tika + Ratu
  'Solaparri',  // Solana + Aparri
  'Malupolu',   // Malolo + Upolu
  'Ometuku',    // Ometepe + Nuku
  'Kuchoran',   // Kucha + Boran
  'Vanukala',   // Vanua + Kalabaw
  'Levuoko',    // Levu + Soko
];

// Pick two distinct tribe names at random — fresh flavor each season.
export function generateTribePair(rng = Math.random) {
  const pool = [...TRIBE_MASHUPS];
  const first = pool.splice(Math.floor(rng() * pool.length), 1)[0] || 'Red';
  const second = pool.splice(Math.floor(rng() * pool.length), 1)[0] || 'Blue';
  return [first, second];
}

// Map an internal tribe key to its display name for this game.
// `tribeNames` is game_state.tribe_names = [redName, blueName].
export function tribeLabel(key, tribeNames) {
  if (key === 'red') return tribeNames?.[0] || 'Red';
  if (key === 'blue') return tribeNames?.[1] || 'Blue';
  return key;
}
