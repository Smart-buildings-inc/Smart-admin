import type { Need } from "@/lib/types";

export type Vec3 = [number, number, number];

export type CharacterRole =
  | "water-engineer"
  | "energy-engineer"
  | "farmer"
  | "doctor"
  | "resident"
  | "chef"
  | "air-tech"
  | "concierge"
  | "pool-attendant"
  | "greeter"
  | "maintenance";

export interface CharacterProfile {
  id: string;
  name: string;
  emoji: string;
  role: CharacterRole;
  purpose: string;
  homeFloorKey: string;
  color: string;
  variant: "resident" | "greeter" | "engineer";
  tasks: string[];
  /** Waypoints relative to floor origin — characters patrol these in order */
  waypoints: Vec3[];
  /** Floors this character visits (floorKey + purpose) */
  visits: { floorKey: string; purpose: string }[];
  /** Speed multiplier */
  speed: number;
  /** Which floor need this character is associated with */
  need: Need | "all";
}

const FLOOR_H = 1.5;
const SLAB_T = 0.16;

export function characterYOffset(level: number): number {
  return level * (FLOOR_H + SLAB_T);
}

export const characters: CharacterProfile[] = [
  // ── Reclamation Core ────────────────────────────────────────────────
  {
    id: "marcus",
    name: "Marcus",
    emoji: "🔧",
    role: "water-engineer",
    purpose: "Maintains the bulk water reservoir, greywater treatment tanks, and pump skid — keeps the closed-loop water system flowing",
    homeFloorKey: "reclamation-core",
    color: "#4ea8ff",
    variant: "engineer",
    tasks: [
      "Inspect reservoir levels",
      "Calibrate greywater treatment sensors",
      "Test pump B failover",
      "Log water quality readings",
    ],
    waypoints: [
      [0, 0, -1.9],
      [-1.4, 0, -1.6],
      [1.4, 0, -1.6],
      [0.8, 0, 1.4],
      [0, 0, 0],
    ],
    visits: [
      { floorKey: "power-ops-core", purpose: "Report energy-water nexus metrics" },
    ],
    speed: 0.8,
    need: "water",
  },

  // ── Power & Ops Core ────────────────────────────────────────────────
  {
    id: "yuki",
    name: "Yuki",
    emoji: "⚡",
    role: "energy-engineer",
    purpose: "Monitors the battery wall, manages solar-direct load switching, and keeps the microgrid island-ready",
    homeFloorKey: "power-ops-core",
    color: "#f0b84f",
    variant: "engineer",
    tasks: [
      "Monitor battery state of charge",
      "Balance solar-direct vs. grid loads",
      "Run ESS fire-compliance check",
      "Tune demand-response algorithms",
    ],
    waypoints: [
      [-1.7, 0, -1.7],
      [-0.5, 0, -1.7],
      [0.7, 0, -1.7],
      [1.9, 0, -1.7],
      [0, 0, 1.4],
      [0, 0, 0],
    ],
    visits: [
      { floorKey: "the-lung", purpose: "Check air handling power draw" },
      { floorKey: "reclamation-core", purpose: "Coordinate pump energy scheduling" },
    ],
    speed: 0.7,
    need: "energy",
  },

  // ── Aquaponics Bay ──────────────────────────────────────────────────
  {
    id: "zara",
    name: "Zara",
    emoji: "🐟",
    role: "farmer",
    purpose: "Tilapia husbandry and aquaponics — balances fish feed, water chemistry, and grow-bed nutrient cycling",
    homeFloorKey: "aquaponics-bay",
    color: "#4cc56a",
    variant: "resident",
    tasks: [
      "Feed the tilapia",
      "Test pH and ammonia levels",
      "Harvest basil from grow beds",
      "Clean drum filter",
    ],
    waypoints: [
      [-0.9, 0, 0],
      [-0.9, 0, -1.0],
      [-1.1, 0, 0.8],
      [1.2, 0, 0],
      [0, 0, 0],
    ],
    visits: [
      { floorKey: "vertical-farm", purpose: "Share nutrient-rich water with vertical farm" },
      { floorKey: "commons-clinic", purpose: "Deliver fresh produce to kitchen" },
    ],
    speed: 0.9,
    need: "food",
  },

  // ── Vertical Farm ───────────────────────────────────────────────────
  {
    id: "elena",
    name: "Elena",
    emoji: "🌱",
    role: "farmer",
    purpose: "Operates the vertical grow system — manages photoperiod, irrigation cycles, and harvest rotation across three tiers",
    homeFloorKey: "vertical-farm",
    color: "#67e08a",
    variant: "resident",
    tasks: [
      "Adjust grow-light photoperiod",
      "Inspect tier 1 leafy greens",
      "Harvest tier 3 microgreens",
      "Refill nutrient reservoir",
    ],
    waypoints: [
      [-1.5, 0, -0.6],
      [-1.5, 0, 0.3],
      [0, 0, -0.6],
      [1.5, 0, -0.6],
      [0, 0, 0],
    ],
    visits: [
      { floorKey: "commons-clinic", purpose: "Deliver daily harvest to kitchen" },
    ],
    speed: 0.85,
    need: "food",
  },

  // ── Commons & Clinic ────────────────────────────────────────────────
  {
    id: "dr-adebayo",
    name: "Dr. Adebayo",
    emoji: "🏥",
    role: "doctor",
    purpose: "Runs the community clinic — telehealth consultations, first aid, and weekly health screenings for all residents",
    homeFloorKey: "commons-clinic",
    color: "#ff5d5d",
    variant: "resident",
    tasks: [
      "Telehealth consultation block",
      "Stock exam room supplies",
      "Review vital-sign trends",
      "Health screening walk-in hours",
    ],
    waypoints: [
      [0.6, 0, 1.4],
      [-1.4, 0, -1.4],
      [0, 0, -1.4],
      [1.4, 0, -1.4],
      [0, 0, 0],
    ],
    visits: [
      { floorKey: "residences-a", purpose: "Home visit for resident checkup" },
      { floorKey: "residences-b", purpose: "Follow-up appointment" },
    ],
    speed: 0.7,
    need: "health",
  },
  {
    id: "nurse-park",
    name: "Nurse Park",
    emoji: "💉",
    role: "doctor",
    purpose: "Assists in the clinic — manages patient intake, vitals, and after-care instructions",
    homeFloorKey: "commons-clinic",
    color: "#ff7b7b",
    variant: "resident",
    tasks: [
      "Take patient vitals",
      "Prepare exam rooms",
      "Update health records",
      "Coordinate with Dr. Adebayo",
    ],
    waypoints: [
      [1.4, 0, -1.4],
      [0.6, 0, 1.4],
      [0, 0, -1.4],
      [-0.6, 0, 1.0],
    ],
    visits: [],
    speed: 0.9,
    need: "health",
  },

  // ── Residences A ────────────────────────────────────────────────────
  {
    id: "hana",
    name: "Hana",
    emoji: "🏠",
    role: "resident",
    purpose: "Lives in Residences A — works remotely, enjoys the Skydeck pool, participates in community events",
    homeFloorKey: "residences-a",
    color: "#ffd9a0",
    variant: "resident",
    tasks: [
      "Morning walk in The Lung",
      "Remote work at desk",
      "Lunch in the Commons",
      "Evening swim on Skydeck",
    ],
    waypoints: [
      [-1.4, 0, -1.2],
      [1.4, 0, -1.2],
      [0, 0, 1.4],
      [-1.0, 0, -1.2],
    ],
    visits: [
      { floorKey: "the-lung", purpose: "Morning walk in the atrium" },
      { floorKey: "skydeck-reservoir", purpose: "Evening swim" },
      { floorKey: "commons-clinic", purpose: "Community dinner" },
    ],
    speed: 0.6,
    need: "shelter",
  },
  {
    id: "kenji",
    name: "Kenji",
    emoji: "🎮",
    role: "resident",
    purpose: "Lives in Residences A — runs the building's social events board and indie game night in the Commons",
    homeFloorKey: "residences-a",
    color: "#c0a4ff",
    variant: "resident",
    tasks: [
      "Plan weekly game night",
      "Update events board",
      "Browse the aquaponics bay",
      "Host trivia in Commons",
    ],
    waypoints: [
      [0, 0, 1.4],
      [-1.4, 0, -1.2],
      [0.4, 0, 1.4],
    ],
    visits: [
      { floorKey: "commons-clinic", purpose: "Host community events" },
      { floorKey: "aquaponics-bay", purpose: "Relax by the fish tanks" },
    ],
    speed: 0.75,
    need: "shelter",
  },

  // ── Residences B ────────────────────────────────────────────────────
  {
    id: "amelia",
    name: "Amelia",
    emoji: "🎨",
    role: "resident",
    purpose: "Lives in Residences B — paints landscapes of the city skyline from the Skydeck",
    homeFloorKey: "residences-b",
    color: "#ff9d4d",
    variant: "resident",
    tasks: [
      "Morning sketching on Skydeck",
      "Work on commission",
      "Art supply inventory",
      "Exhibition in Commons",
    ],
    waypoints: [
      [-1.4, 0, -1.2],
      [1.4, 0, -1.2],
      [0, 0, 1.4],
    ],
    visits: [
      { floorKey: "skydeck-reservoir", purpose: "Paint the city skyline" },
      { floorKey: "commons-clinic", purpose: "Art exhibition setup" },
    ],
    speed: 0.65,
    need: "shelter",
  },
  {
    id: "carlos",
    name: "Carlos",
    emoji: "📚",
    role: "resident",
    purpose: "Lives in Residences B — tutors math and science to resident kids in the Commons afternoons",
    homeFloorKey: "residences-b",
    color: "#7fe7e0",
    variant: "resident",
    tasks: [
      "Prepare lesson plans",
      "Tutoring session",
      "Grade practice problems",
      "Read in The Lung",
    ],
    waypoints: [
      [1.4, 0, -1.2],
      [0, 0, 1.4],
      [-1.4, 0, -1.2],
    ],
    visits: [
      { floorKey: "commons-clinic", purpose: "Tutor residents" },
      { floorKey: "the-lung", purpose: "Read by the tree" },
    ],
    speed: 0.7,
    need: "shelter",
  },

  // ── Residences C ────────────────────────────────────────────────────
  {
    id: "sakura",
    name: "Sakura",
    emoji: "🍳",
    role: "chef",
    purpose: "Lives in Residences C — runs the Commons kitchen, cooking fresh harvest from the Vertical Farm and aquaponics",
    homeFloorKey: "residences-c",
    color: "#ff7be0",
    variant: "resident",
    tasks: [
      "Plan weekly menu from harvest",
      "Prep ingredients in kitchen",
      "Cook community dinner",
      "Compost food scraps",
    ],
    waypoints: [
      [0, 0, 1.4],
      [-1.4, 0, -1.2],
      [1.4, 0, -1.2],
    ],
    visits: [
      { floorKey: "commons-clinic", purpose: "Cook in the community kitchen" },
      { floorKey: "vertical-farm", purpose: "Pick fresh herbs" },
      { floorKey: "aquaponics-bay", purpose: "Harvest tilapia for dinner" },
    ],
    speed: 0.8,
    need: "shelter",
  },
  {
    id: "ollie",
    name: "Ollie",
    emoji: "🐕",
    role: "resident",
    purpose: "Lives in Residences C with his dog — tests the building as a pet-friendly habitat, walks the atrium daily",
    homeFloorKey: "residences-c",
    color: "#f1c9a5",
    variant: "resident",
    tasks: [
      "Morning dog walk in The Lung",
      "Pet-friendly community check",
      "Afternoon nap at home",
      "Evening stroll on plaza",
    ],
    waypoints: [
      [-1.4, 0, -1.2],
      [0, 0, 1.4],
      [1.4, 0, -1.2],
    ],
    visits: [
      { floorKey: "the-lung", purpose: "Walk his dog in the atrium" },
      { floorKey: "skydeck-reservoir", purpose: "Evening relaxation" },
    ],
    speed: 0.55,
    need: "shelter",
  },

  // ── Residences D ────────────────────────────────────────────────────
  {
    id: "ida",
    name: "Ida",
    emoji: "🌿",
    role: "resident",
    purpose: "Lives in Residences D — volunteers in the Vertical Farm and teaches resident workshops on growing food",
    homeFloorKey: "residences-d",
    color: "#3aa56a",
    variant: "resident",
    tasks: [
      "Volunteer farm shift",
      "Teach growing workshop",
      "Seed-starting for next rotation",
      "Garden planning",
    ],
    waypoints: [
      [1.4, 0, -1.2],
      [0, 0, 1.4],
      [-1.4, 0, -1.2],
    ],
    visits: [
      { floorKey: "vertical-farm", purpose: "Volunteer farming" },
      { floorKey: "commons-clinic", purpose: "Teach gardening workshop" },
    ],
    speed: 0.7,
    need: "shelter",
  },

  // ── The Lung ─────────────────────────────────────────────────────────
  {
    id: "rivka",
    name: "Rivka",
    emoji: "🌬️",
    role: "air-tech",
    purpose: "Monitors the Lung's CO₂ scrubbers, HVAC balance, and PM2.5 filters — keeps the air pristine for all 128 residents",
    homeFloorKey: "the-lung",
    color: "#5ddc7a",
    variant: "engineer",
    tasks: [
      "Check CO₂ scrubber efficiency",
      "Balance HVAC zone dampers",
      "Replace PM2.5 pre-filters",
      "Log air quality trends",
    ],
    waypoints: [
      [0, 0, 0],
      [-2, 0, -2],
      [2, 0, -2],
      [-2, 0, 2],
      [2, 0, 2],
    ],
    visits: [
      { floorKey: "power-ops-core", purpose: "Check air handling unit power" },
    ],
    speed: 0.75,
    need: "air",
  },

  // ── The Penthouses ───────────────────────────────────────────────────
  {
    id: "james",
    name: "James",
    emoji: "🥂",
    role: "concierge",
    purpose: "Manages the penthouse level — coordinates Skydeck reservations, hosts resident events, and ensures premium service",
    homeFloorKey: "penthouses",
    color: "#e9eef5",
    variant: "greeter",
    tasks: [
      "Skydeck reservation check",
      "Coordinate events calendar",
      "Welcome penthouse guests",
      "Evening wine service on Skydeck",
    ],
    waypoints: [
      [0, 0, 1.4],
      [-1.4, 0, -1.2],
      [1.4, 0, -1.2],
    ],
    visits: [
      { floorKey: "skydeck-reservoir", purpose: "Host Skydeck events" },
      { floorKey: "commons-clinic", purpose: "Coordinate with kitchen" },
    ],
    speed: 0.8,
    need: "shelter",
  },

  // ── Skydeck & Reservoir ──────────────────────────────────────────────
  {
    id: "kai",
    name: "Kai",
    emoji: "🏊",
    role: "pool-attendant",
    purpose: "Keeps the rooftop Skydeck pool clean, safe, and inviting — manages water chemistry and lounge setup",
    homeFloorKey: "skydeck-reservoir",
    color: "#3aa0ff",
    variant: "resident",
    tasks: [
      "Test pool water chemistry",
      "Arrange lounge chairs",
      "Wipe down pool coping",
      "Monitor pool occupancy",
    ],
    waypoints: [
      [0, 0, 0],
      [1.9, 0, -0.7],
      [-1.9, 0, -0.7],
      [2.2, 0, -1.4],
      [0, 0, 1.0],
    ],
    visits: [],
    speed: 0.7,
    need: "restoration",
  },
  {
    id: "lena",
    name: "Lena",
    emoji: "🧘",
    role: "resident",
    purpose: "Leads sunrise yoga on the Skydeck every morning — helps residents find restoration through movement and breath",
    homeFloorKey: "skydeck-reservoir",
    color: "#c0a4ff",
    variant: "resident",
    tasks: [
      "Lead sunrise yoga session",
      "Meditation circle",
      "Stretch and cool-down",
      "Plan next wellness event",
    ],
    waypoints: [
      [0, 0, 0],
      [-1.9, 0, -0.7],
      [1.9, 0, 0.7],
    ],
    visits: [
      { floorKey: "commons-clinic", purpose: "Wellness workshop" },
    ],
    speed: 0.5,
    need: "restoration",
  },

  // ── Plaza Greeter ────────────────────────────────────────────────────
  {
    id: "atlas-greeter",
    name: "Atlas",
    emoji: "🤖",
    role: "greeter",
    purpose: "The building's AI concierge — welcomes visitors, gives directions, and represents ATLAS's mission at the entrance",
    homeFloorKey: "commons-clinic",
    color: "#7fe7e0",
    variant: "greeter",
    tasks: [
      "Welcome visitors at entrance",
      "Provide building orientation",
      "Announce community events",
      "Guide deliveries to correct floor",
    ],
    waypoints: [
      [0, 0, 0],
      [3.4, 0, 7.5],
    ],
    visits: [
      { floorKey: "penthouses", purpose: "Escort VIP guests" },
    ],
    speed: 1.0,
    need: "all",
  },

  // ── Maintenance ──────────────────────────────────────────────────────
  {
    id: "rico",
    name: "Rico",
    emoji: "🛠️",
    role: "maintenance",
    purpose: "Building-wide maintenance — responds to incidents, fixes pump faults, replaces filters, keeps ATLAS-01 humming",
    homeFloorKey: "power-ops-core",
    color: "#f0b84f",
    variant: "engineer",
    tasks: [
      "Respond to active incidents",
      "Routine equipment inspection",
      "Replace worn parts",
      "Log maintenance tickets",
    ],
    waypoints: [
      [0, 0, 1.4],
      [-0.5, 0, -1.7],
      [1.3, 0, -1.7],
      [0, 0, 0],
    ],
    visits: [
      { floorKey: "reclamation-core", purpose: "Inspect pump B fault" },
      { floorKey: "vertical-farm", purpose: "Fix grow-light bank 3" },
      { floorKey: "the-lung", purpose: "Replace air pre-filters" },
    ],
    speed: 1.2,
    need: "all",
  },
];

export function getCharactersForFloor(floorKey: string): CharacterProfile[] {
  return characters.filter(
    (c) => c.homeFloorKey === floorKey || c.visits.some((v) => v.floorKey === floorKey),
  );
}
