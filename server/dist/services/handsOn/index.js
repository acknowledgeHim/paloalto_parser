import { parseLessons } from '../mathLessonsParse.js';
import { HO_SAFETY } from './safety.js';
import { HO_CAR } from './car.js';
import { HO_WELDING } from './welding.js';
import { HO_CARPENTRY } from './carpentry.js';
import { HO_ELECTRICAL } from './electrical.js';
import { HO_PLUMBING } from './plumbing.js';
import { HO_HVAC } from './hvac.js';
import { HO_COMPUTER } from './computer.js';
import { HO_PROGRAMMING } from './programming.js';
import { HO_NETWORKING } from './networking.js';
import { HO_ROBOTICS } from './robotics.js';
/**
 * 🔧 Hands-on: the trades — 🦺 safety (OSHA 10), 🚗 car repair (ASE, EPA 609), 🔥 welding (AWS),
 * 🪚 carpentry and 🏠 framing (NCCER), ⚡ electrical, 🚰 plumbing, ❄️ HVAC (EPA 608) — and tech: 💻 computer
 * hardware (CompTIA A+, ETA, IPC), 🧑‍💻 programming (Certiport, PCEP, AP CS), 🌐 networking (CCST, Network+,
 * CCNA) and 🤖 robotics (FIRST/VEX, FANUC/SACA), with 💻 tech labs. Each trade starts
 * with the real, industry-recognized credential it prepares for, and how to go and earn it. Grouped by
 * trade (the topic), not school grade — stored at grade 9, but every kid can earn from them
 * (routes/lessons.ts ANY_GRADE). Added once like every built-in lesson, never over a parent's edits.
 */
export const HANDSON_GRADE = 9;
export const HANDSON_LESSONS = [HO_SAFETY, HO_CAR, HO_WELDING, HO_CARPENTRY, HO_ELECTRICAL, HO_PLUMBING, HO_HVAC, HO_COMPUTER, HO_PROGRAMMING, HO_NETWORKING, HO_ROBOTICS].flatMap((t) => parseLessons('handson', HANDSON_GRADE, t, { shuffle: true }));
