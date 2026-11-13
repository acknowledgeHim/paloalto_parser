import type { ComponentType } from 'react';
import { AtomLab, BalanceLab, DissolveLab, FlameLab, GasLab, PhLab, StatesLab } from './chemistry.js';
import { CellLab, MothLab, PlantLab, PredatorLab, PulseLab, PunnettLab, ReactionLab } from './biology.js';
import { MoonLab, QuakeLab, RockCycleLab, SeasonsLab, WeightLab } from './earth.js';
import { BinaryLab, GatesLab, OhmLab, PwmLab, RobotLab, SubnetLab } from './tech.js';
import { CircuitLab, FallLab, FloatLab, LeverLab, LightMixLab, MixLab, PendulumLab, ProjectileLab, PushLab, SoundLab, SpringLab } from './physics.js';

/** 🧪 Every lab, by the id lessons use ("🧪 lab: pendulum"). Loaded only when a lab is shown. */
const LAB_COMPONENTS: Record<string, ComponentType> = {
  push: PushLab,
  pendulum: PendulumLab,
  projectile: ProjectileLab,
  fall: FallLab,
  lever: LeverLab,
  spring: SpringLab,
  float: FloatLab,
  mix: MixLab,
  circuit: CircuitLab,
  sound: SoundLab,
  light: LightMixLab,
  states: StatesLab,
  atom: AtomLab,
  ph: PhLab,
  dissolve: DissolveLab,
  balance: BalanceLab,
  gas: GasLab,
  flame: FlameLab,
  plant: PlantLab,
  cell: CellLab,
  punnett: PunnettLab,
  predator: PredatorLab,
  moths: MothLab,
  reaction: ReactionLab,
  pulse: PulseLab,
  moon: MoonLab,
  seasons: SeasonsLab,
  rocks: RockCycleLab,
  weight: WeightLab,
  quake: QuakeLab,
  binary: BinaryLab,
  ohm: OhmLab,
  gates: GatesLab,
  subnet: SubnetLab,
  pwm: PwmLab,
  robot: RobotLab,
};

export default function ScienceLab({ id }: { id: string }) {
  const Lab = LAB_COMPONENTS[id.toLowerCase()];
  if (!Lab) return <p className="hint">🧪 There's no lab called “{id}”.</p>;
  return <Lab />;
}
