/** 🔬 More 11th grade science — mostly physics (format: ../../mathLessonsParse.ts; the right choice is starred). */
export const SM_11 = `
@ vectors-11 | ⚡ Physics | Vectors
A **vector** has size and **direction** (displacement, velocity, force); a **scalar** has only size (distance, speed, mass).
Add vectors tip to tail. At right angles, use Pythagoras: 3 m east + 4 m north = **5 m** displacement.
? 6 m east then 8 m north gives a displacement of … | *10 m | 14 m | 2 m
? Which is a vector? | *force | mass
? Walking 5 m east then 5 m west, your displacement is … | *0 m | 10 m

@ relative-velocity-11 | ⚡ Physics | Relative velocity
Velocity depends on your **frame of reference**. A boat heading straight across a river at 4 m/s, with a 3 m/s current, moves at **5 m/s** relative to the shore.
A plane with a 50 km/h **tailwind** goes faster over the ground; a headwind slows it.

🧪 lab: projectile
? A plane flies 500 km/h with a 50 km/h headwind. Ground speed? | *450 km/h | 550 km/h | 500 km/h
? A swimmer at 1 m/s across a river with a 1 m/s current moves at about … relative to shore | *1.4 m/s | 2 m/s | 0 m/s
? Walking 1 m/s forward on a train going 20 m/s, your speed relative to the ground is … | *21 m/s | 19 m/s | 20 m/s

@ fma-11 | ⚡ Physics | Solving F = ma
1. Draw a **free-body diagram** with every force.
2. Find the **net force**.
3. Use **a = F_net ÷ m**.
A 1,200 kg car accelerating at 3 m/s² needs a net force of **3,600 N**.

🧪 lab: push
? A net 10 N on a 2 kg cart gives an acceleration of … | *5 m/s² | 20 m/s² | 0.2 m/s²
? To accelerate 50 kg at 2 m/s² needs … | *100 N | 25 N | 52 N
? A free-body diagram shows … | *all the forces on one object | the object's path

@ inclines-11 | ⚡ Physics | Inclined planes
On a slope, gravity splits into a part **along** the slope (mg sin θ) and a part **into** the slope (mg cos θ).
On a frictionless 30° ramp, a = g sin 30° = **4.9 m/s²**.
? On a frictionless 30° ramp, acceleration is about … | *4.9 m/s² | 9.8 m/s² | 0 m/s²
? A steeper ramp makes the force along the slope … | *bigger | smaller
? The normal force on a slope equals … | *mg cos θ | mg

@ apparent-weight-11 | ⚡ Physics | Elevators and apparent weight
A scale reads the **normal force**, not your true weight.
- Elevator accelerating **up**: N = m(g + a) → you feel heavier.
- Accelerating **down**: N = m(g − a) → lighter.
- **Free fall**: N = 0 → "weightless" (astronauts in orbit).
? A 50 kg person in an elevator accelerating up at 2 m/s² reads about … | *590 N | 490 N | 390 N
? Astronauts float in orbit because they are … | *in free fall | beyond gravity
? Moving up at a steady speed, the scale reads … | *your normal weight | more than your weight

@ torque-11 | ⚡ Physics | Torque
**Torque** is a twisting force: **τ = F × r** (force times lever arm). A longer wrench gives more torque with the same force.
For balance, clockwise torque = counterclockwise torque.

🧪 lab: lever
? 20 N applied 0.5 m from a bolt gives a torque of … | *10 N·m | 40 N·m | 20.5 N·m
? Door handles are far from the hinge to … | *increase torque | look nice
? A 300 N child sits 1 m from a seesaw's pivot. A 200 N child balances at … | *1.5 m | 0.67 m | 2 m

@ center-of-mass-11 | ⚡ Physics | Center of mass and stability
An object is **stable** when its **center of mass** is over its base. A **lower** center of mass and a **wider** base make it harder to tip.
Race cars are low and wide; tightrope walkers hold long poles to help balance.
? Which is harder to tip over? | *a low, wide box | a tall, narrow box
? An object tips when its center of mass moves … its base | *outside | over
? Sumo wrestlers crouch to … their center of mass | *lower | raise

@ angular-momentum-11 | ⚡ Physics | Spinning and angular momentum
**Angular momentum** (L = Iω) is conserved when there's no outside twist. A skater who pulls in their arms makes their **rotational inertia** smaller, so she **spins faster**.
Spinning tops and bike wheels resist tipping for the same reason.
? A skater pulling in their arms spins … | *faster | slower
? Pulling mass closer to the axis makes rotational inertia … | *smaller | bigger
? A spinning bike wheel … tipping over | *resists | speeds up

@ satellites-11 | ⚡ Physics | Satellites and orbits
A satellite is always **falling** toward Earth, but moving sideways so fast it keeps missing! Gravity provides the centripetal force.
- The ISS: about **7.7 km/s**, one orbit every **90 minutes**.
- **Geostationary** satellites orbit once every **24 hours**, so they stay over one spot.
Higher orbits are **slower**.

🧪 lab: projectile
? A satellite in a higher orbit moves … | *slower | faster
? Geostationary satellites orbit once every … | *24 hours | 90 minutes
? What provides the centripetal force for a satellite? | *gravity | its rockets constantly

@ efficiency-11 | ⚡ Physics | Efficiency
**Efficiency = useful energy out ÷ energy in × 100%.** No machine is 100% efficient; the rest is lost, usually as heat.
An old bulb turns only about 5% of its energy into light; an LED about **30–40%**.
? 200 J in, 50 J of useful work out. Efficiency? | *25% | 400% | 150%
? Wasted energy usually becomes … | *heat | mass
? Can a machine be more than 100% efficient? | *no | yes

@ buoyancy-11 | ⚡ Physics | Archimedes' principle
The **buoyant force** equals the **weight of the fluid displaced**. A 2-liter (0.002 m³) object fully under water displaces 2 kg of water → buoyant force ≈ **19.6 N**.
If the buoyant force beats the object's weight, it floats.

🧪 lab: float
? The buoyant force equals the weight of … | *the displaced fluid | the object
? A 1 L object fully underwater feels a buoyant force of about … | *9.8 N | 1 N | 98 N
? Ships float higher in salt water because it is … | *denser | warmer

@ standing-waves-11 | ⚡ Physics | Standing waves
A string fixed at both ends vibrates in **standing waves**: points that don't move (**nodes**) and points that move most (**antinodes**). The lowest note (**fundamental**) has wavelength **λ = 2L**.
Pressing a guitar string shortens it, so λ is shorter and the pitch higher.

🧪 lab: sound
? A 0.5 m string's fundamental wavelength is … | *1.0 m | 0.5 m | 0.25 m
? Points on a standing wave that don't move are … | *nodes | antinodes
? Shortening a string makes the pitch … | *higher | lower

@ resonance-11 | ⚡ Physics | Resonance
Every object has a **natural frequency**. Pushing at that frequency builds up huge vibrations — **resonance**.
Pushing a swing at the right times, a singer shattering a wine glass, and tuning a radio are all resonance. Engineers design buildings to avoid resonating in earthquakes.
? Pushing a swing in time with its swing is … | *resonance | friction
? A singer can shatter a glass by matching its … | *natural frequency | color
? Engineers design buildings so earthquakes don't cause … | *resonance | gravity

@ snell-11 | ⚡ Physics | Snell's law
**n₁ sin θ₁ = n₂ sin θ₂.** Light slows and bends **toward** the normal entering a denser material.
From air into glass (n = 1.5) at 30°: sin θ₂ = 0.5 ÷ 1.5 → θ₂ ≈ **19.5°**.
The **critical angle** for glass to air is about **42°** — beyond it, total internal reflection.
? Light enters water (n = 1.33) from air. It bends … the normal | *toward | away from
? The speed of light in glass (n = 1.5) is … | *2 × 10⁸ m/s | 4.5 × 10⁸ m/s | 3 × 10⁸ m/s
? Total internal reflection happens when light tries to go … | *from glass into air at a steep angle | from air into glass

@ thin-lens-11 | ⚡ Physics | The lens equation
**1/f = 1/d₀ + 1/dᵢ.** Magnification **m = −dᵢ/d₀**.
A lens with f = 10 cm and an object 30 cm away: 1/dᵢ = 1/10 − 1/30 → dᵢ = **15 cm**, m = −0.5 (smaller, upside down).
An object **inside** the focal length gives a magnified, upright, virtual image (a magnifying glass).
? f = 20 cm, object at 40 cm. Image distance? | *40 cm | 20 cm | 13.3 cm
? A negative magnification means the image is … | *upside down | larger
? A magnifying glass works with the object … the focal length | *inside | far beyond

@ curved-mirrors-11 | ⚡ Physics | Curved mirrors
- **Concave** mirrors curve inward and **converge** light: makeup mirrors, flashlight reflectors, telescopes.
- **Convex** mirrors curve outward and **diverge** light: a wider view, smaller images — car side mirrors ("objects are closer than they appear").
Focal length f = R/2.
? A car's side mirror is … | *convex | concave
? A mirror with a 40 cm radius of curvature has a focal length of … | *20 cm | 80 cm | 40 cm
? Flashlights use … mirrors to make a beam | *concave | convex

@ diffraction-11 | ⚡ Physics | Diffraction
Waves **spread out** as they pass through gaps or around obstacles. The effect is biggest when the gap is about the size of the **wavelength**.
You can **hear** around corners (sound waves are meters long) but not **see** around them (light waves are tiny). Young's double-slit experiment showed light is a **wave**.
? Diffraction is greatest when the gap is about the size of the … | *wavelength | amplitude
? We hear around corners because sound has a … wavelength | *long | short
? The double-slit experiment showed light behaves as a … | *wave | solid

@ electric-field-11 | ⚡ Physics | Electric fields
An **electric field** (E = F ÷ q, in N/C) shows the force per charge. Field lines point **away from +** and **toward −**.
A 2 C charge in a 100 N/C field feels **200 N**.
? A 3 C charge in a 50 N/C field feels … | *150 N | 53 N | 16.7 N
? Field lines point … positive charges | *away from | toward
? A field from a point charge … with distance | *gets weaker | stays the same

@ capacitors-11 | ⚡ Physics | Capacitors
A **capacitor** stores charge and energy between two plates. **C = Q ÷ V** (farads). It can release energy very fast — a camera flash or a defibrillator.
A 10 μF capacitor at 9 V holds 90 μC of charge.
? A capacitor stores … | *charge and energy | light
? A 2 F capacitor at 3 V holds … | *6 C | 1.5 C | 5 C
? Which uses a capacitor's quick burst of energy? | *a camera flash | a battery charger only

@ magnetic-force-11 | ⚡ Physics | Magnetic force on currents
A wire carrying current in a magnetic field feels a force: **F = BIL** (when perpendicular). Moving charges feel F = qvB. This force spins **motors** and steers electrons in old TVs.
A 2 m wire with 3 A in a 0.5 T field feels **3 N**.
? A 1 m wire with 4 A in a 0.5 T field feels … | *2 N | 8 N | 4.5 N
? The magnetic force is … to the current and field | *perpendicular | parallel
? This force is what makes … spin | *electric motors | water wheels

@ transformers-11 | ⚡ Physics | Transformers and the grid
**Vₛ ÷ Vₚ = Nₛ ÷ Nₚ** (turns ratio). Transformers only work with **AC** (changing current).
Power lines use **very high voltage** so the current is small and less energy is lost as heat; transformers step it down for homes.
? 120 V into 100 turns, out of 10 turns gives … | *12 V | 1,200 V | 10 V
? Transformers need … current | *alternating | direct
? Power lines use high voltage to … | *reduce energy loss | make it more dangerous

@ second-law-11 | ⚡ Physics | The second law of thermodynamics
Heat flows on its own from **hot to cold**, never the reverse. The **entropy** (spread-out-ness of energy) of an isolated system tends to **increase**.
A refrigerator moves heat from cold to hot, but only by **using energy**.
? Heat flows on its own from … | *hot to cold | cold to hot
? In an isolated system, entropy tends to … | *increase | decrease
? A refrigerator can move heat out of a cold box because it … | *uses energy | breaks physics

@ heat-engines-11 | ⚡ Physics | Heat engines
A **heat engine** turns heat into work by letting heat flow from hot to cold. The best possible efficiency is **1 − T_cold ÷ T_hot** (kelvin).
Between 500 K and 300 K: 1 − 300/500 = **40%** at most.
? Max efficiency between 600 K and 300 K is … | *50% | 100% | 30%
? A car engine is a … | *heat engine | refrigerator
? To raise a heat engine's efficiency, make the hot side … | *hotter | colder

@ latent-heat-11 | ⚡ Physics | Latent heat
Changing state takes energy without changing temperature: **Q = mL**.
- Melting ice: **334 J/g**
- Boiling water: **2,260 J/g**
That's why steam burns are so bad, and why sweating cools you.

🧪 lab: states
? Melting 10 g of ice at 0°C takes … | *3,340 J | 334 J | 22,600 J
? Boiling 1 g of water takes … than melting 1 g of ice | *much more energy | less energy
? While ice melts, its temperature … | *stays the same | rises

@ binding-energy-11 | 🧪 Chemistry | Mass defect and binding energy
A nucleus has **less mass** than its separate protons and neutrons. The missing mass became **binding energy** (E = mc²).
**Iron** is the most tightly bound, so **fusing light** nuclei or **splitting heavy** ones both release energy.
? A nucleus weighs … than its separate parts | *less | more
? Converting 1 g of mass to energy gives about … | *9 × 10¹³ J | 9 J | 300 J
? Splitting uranium releases energy because uranium is … than iron | *heavier | lighter

@ electrolysis-11 | 🧪 Chemistry | Electrolysis
**Electrolysis** uses electricity to drive a reaction that wouldn't happen on its own.
- Water → **hydrogen** and **oxygen** (2 : 1 by volume).
- Electroplating coats objects with metal.
- Aluminum is made from its ore by electrolysis.

🧪 lab: circuit
? Electrolysis of water makes hydrogen and oxygen in a … ratio by volume | *2 : 1 | 1 : 1
? Electroplating uses electricity to coat objects with … | *metal | paint
? Electrolysis needs a source of … | *electricity | sunlight only

@ blood-pressure-11 | 🧬 Biology | Pressure in the body
**Pressure = force ÷ area.** In a fluid, pressure grows with depth: P = ρgh. Every 10 m of water adds about **1 atm**.
Blood pressure "120/80" means 120 mmHg when the heart squeezes (**systolic**) and 80 when it relaxes (**diastolic**).

🧪 lab: pulse
? At 20 m deep in water, the extra pressure is about … | *2 atm | 20 atm | 0.2 atm
? In 120/80, the 120 is the … pressure | *systolic | diastolic
? Pressure equals force divided by … | *area | time

@ ultrasound-11 | 🧬 Biology | Ultrasound imaging
**Ultrasound** is sound above **20,000 Hz** — too high to hear. A probe sends pulses into the body and times the **echoes** from tissues to build an image.
It's safe for viewing babies before birth because it uses sound, not radiation.
? Ultrasound is sound above … | *20,000 Hz | 20 Hz
? Ultrasound images are built from … | *echoes | X-rays
? Ultrasound is used for unborn babies because it … | *uses no ionizing radiation | is loud

@ wind-power-11 | 🌍 Earth & space | The physics of wind power
Wind power grows with the **cube** of wind speed: P ∝ v³. Double the wind speed → **8×** the power.
Longer blades sweep a bigger area: double the blade length → **4×** the area and power.
? Doubling wind speed multiplies power by … | *8 | 2 | 4
? Doubling blade length multiplies the swept area by … | *4 | 2 | 8
? Turbines are placed on hills and offshore because … | *wind is stronger there | it's quieter

@ storm-physics-11 | 🌍 Earth & space | The energy in storms
Warm, moist air **rises**, cools and condenses, releasing **latent heat** that makes it rise even more — powering thunderstorms. Hurricanes need ocean water above about **26°C**.
A single thunderstorm can release as much energy as a small nuclear bomb.
? Thunderstorms get energy from water vapor … | *condensing | freezing
? Hurricanes need ocean water of about … or warmer | *26°C | 5°C
? Rising air … as it goes up | *cools | heats up
`;
