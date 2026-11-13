/**
 * 🧪 The science and 💻 tech labs, by id (names only — the labs themselves load when one is opened). A lesson
 * shows a lab where its text has a line like "🧪 lab: pendulum".
 */
export type Branch = 'physics' | 'chemistry' | 'biology' | 'earth' | 'tech';
export interface LabInfo {
  id: string;
  name: string;
  branch: Branch;
  /** what kids learn from it */
  about: string;
}
export const BRANCH_NAMES: Record<Branch, string> = {
  physics: '⚡ Physics',
  chemistry: '🧪 Chemistry',
  biology: '🧬 Biology',
  earth: '🌍 Earth & space',
  tech: '💻 Tech & robots',
};
export const LABS: LabInfo[] = [
  { id: 'push', name: '🛒 Push a cart', branch: 'physics', about: 'forces, friction and acceleration' },
  { id: 'pendulum', name: '🕰️ Pendulum', branch: 'physics', about: 'what changes how fast a pendulum swings' },
  { id: 'projectile', name: '🎯 Launch a ball', branch: 'physics', about: 'speed, angle and gravity' },
  { id: 'fall', name: '🪶 Ball and feather drop', branch: 'physics', about: 'gravity and air resistance' },
  { id: 'lever', name: '⚖️ Balance the seesaw', branch: 'physics', about: 'levers and balance' },
  { id: 'spring', name: '🪀 Stretch a spring', branch: 'physics', about: "forces and Hooke's law" },
  { id: 'float', name: '🛟 Sink or float', branch: 'physics', about: 'density and buoyancy' },
  { id: 'mix', name: '🌡️ Mixing hot and cold water', branch: 'physics', about: 'heat and temperature' },
  { id: 'circuit', name: '💡 Light bulb circuits', branch: 'physics', about: 'series and parallel circuits' },
  { id: 'sound', name: '🔊 Sound waves', branch: 'physics', about: 'pitch, loudness and wavelength' },
  { id: 'light', name: '🌈 Mixing colors of light', branch: 'physics', about: 'red, green and blue light' },
  { id: 'states', name: '🧊 Heat up some water', branch: 'chemistry', about: 'solids, liquids and gases' },
  { id: 'atom', name: '⚛️ Build an atom', branch: 'chemistry', about: 'protons, neutrons, electrons, ions and isotopes' },
  { id: 'ph', name: '🍋 Acids and bases', branch: 'chemistry', about: 'the pH scale and neutralizing' },
  { id: 'dissolve', name: '🍬 How much will dissolve?', branch: 'chemistry', about: 'solutions and saturation' },
  { id: 'balance', name: '⚖️ Balance the equation', branch: 'chemistry', about: 'conservation of mass in reactions' },
  { id: 'gas', name: '🎈 Squeeze and heat a gas', branch: 'chemistry', about: 'pressure, volume and temperature' },
  { id: 'flame', name: '🔥 Flame test', branch: 'chemistry', about: 'metals and the colors of light they give off' },
  { id: 'plant', name: '🌱 Grow a bean plant', branch: 'biology', about: 'what plants need to grow' },
  { id: 'cell', name: '🔬 Explore a cell', branch: 'biology', about: 'the parts of plant and animal cells' },
  { id: 'punnett', name: '🧬 Punnett square', branch: 'biology', about: 'dominant and recessive genes' },
  { id: 'predator', name: '🦊 Foxes and rabbits', branch: 'biology', about: 'predators, prey and food webs' },
  { id: 'moths', name: '🦋 Be the bird', branch: 'biology', about: 'camouflage and natural selection' },
  { id: 'reaction', name: '⚡ How fast are your nerves?', branch: 'biology', about: 'the nervous system and reaction time' },
  { id: 'pulse', name: '❤️ Measure your heart rate', branch: 'biology', about: 'the heart and exercise' },
  { id: 'moon', name: '🌙 Phases of the Moon', branch: 'earth', about: 'why the Moon changes shape' },
  { id: 'seasons', name: '☀️ Seasons and daylight', branch: 'earth', about: "Earth's tilt and the seasons" },
  { id: 'rocks', name: '🪨 The rock cycle', branch: 'earth', about: 'igneous, sedimentary and metamorphic rock' },
  { id: 'weight', name: '🪐 Your weight on other worlds', branch: 'earth', about: 'gravity on the planets' },
  { id: 'quake', name: '🌐 Find the earthquake', branch: 'earth', about: 'seismic waves and finding an epicenter' },
  { id: 'binary', name: '🔢 Binary switches', branch: 'tech', about: 'bits, bytes, hex and ASCII' },
  { id: 'ohm', name: "💡 Pick the LED's resistor", branch: 'tech', about: "Ohm's law on a breadboard" },
  { id: 'gates', name: '🔣 Logic gates', branch: 'tech', about: 'AND, OR, NOT, XOR and truth tables' },
  { id: 'subnet', name: '🌐 Same network?', branch: 'tech', about: 'IP addresses, subnet masks and routers' },
  { id: 'pwm', name: '⚙️ PWM: speed and angle', branch: 'tech', about: 'motor speed and servo control' },
  { id: 'robot', name: '🤖 Program the robot', branch: 'tech', about: 'algorithms, debugging and loops' },
];
export const labInfo = (id: string) => LABS.find((l) => l.id === id);
/** "🧪 lab: pendulum" → "pendulum" */
export const LAB_LINE = /^🧪\s*lab:\s*([a-z-]+)\s*$/i;
