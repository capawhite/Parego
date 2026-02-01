// Gender-neutral memorable names for guest users
const PLANETS = [
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Neptune",
  "Uranus",
  "Pluto",
  "Ceres",
  "Eris",
  "Titan",
  "Europa",
  "Io",
  "Callisto",
  "Ganymede",
  "Triton",
]

const ANIMALS = [
  "Panda",
  "Koala",
  "Falcon",
  "Dolphin",
  "Penguin",
  "Eagle",
  "Otter",
  "Whale",
  "Owl",
  "Fox",
  "Bear",
  "Wolf",
  "Hawk",
  "Raven",
  "Seal",
  "Lynx",
  "Moose",
  "Bison",
  "Crane",
  "Heron",
  "Robin",
  "Swift",
  "Finch",
  "Wren",
  "Starling",
]

const OBJECTS = [
  "Comet",
  "Star",
  "Moon",
  "Nova",
  "Aurora",
  "Eclipse",
  "Nebula",
  "Galaxy",
  "Meteor",
  "Orbit",
  "Photon",
  "Quasar",
  "Pulsar",
  "Cosmos",
  "Prism",
  "Crystal",
  "Thunder",
  "Lightning",
  "Cloud",
  "Storm",
  "Breeze",
  "Frost",
  "Rain",
  "Snow",
]

const ALL_NAMES = [...PLANETS, ...ANIMALS, ...OBJECTS]

/**
 * Generate a memorable guest username like "Guest_Mars" or "Guest_Panda"
 * Falls back to numbered format if all names are exhausted
 */
export function generateGuestUsername(existingNames: string[] = []): string {
  // Try to find an unused name from our lists
  const availableNames = ALL_NAMES.filter((name) => !existingNames.includes(`Guest_${name}`))

  if (availableNames.length > 0) {
    // Pick a random name from available ones
    const randomName = availableNames[Math.floor(Math.random() * availableNames.length)]
    return `Guest_${randomName}`
  }

  // Fallback: if all names are taken, use numbered format
  let counter = 1
  while (existingNames.includes(`Guest_${counter}`)) {
    counter++
  }
  return `Guest_${counter}`
}
