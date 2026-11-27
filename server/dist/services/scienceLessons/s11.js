/** 🔬 11th grade science — mostly physics (format: ../mathLessonsParse.ts; the right choice is starred). */
export const S_11 = `
@ kinematics | ⚡ Physics | Motion equations
For constant acceleration:
- v = v₀ + at
- x = v₀t + ½at²
- v² = v₀² + 2ax
? A car starts at rest and accelerates at 3 m/s² for 4 s. Its speed is … | *12 m/s | 7 m/s | 48 m/s
? Same car — how far did it go? | *24 m | 12 m | 48 m
? Velocity includes speed and … | *direction | mass

@ free-fall | ⚡ Physics | Free fall
Without air resistance, everything falls with **g = 9.8 m/s²**. Drop time from height h: **t = √(2h/g)**. With air, light spread-out objects reach **terminal velocity** quickly.

🧪 lab: fall
? A ball dropped for 2 s (no air) is going … | *19.6 m/s | 9.8 m/s | 4.9 m/s
? Dropped from 20 m (no air), it lands in about … | *2 s | 4 s | 1 s
? Terminal velocity is reached when air resistance equals … | *weight | zero

@ projectile-motion | ⚡ Physics | Projectile motion
Horizontal and vertical motion are **independent**: horizontal speed stays constant; vertical speed changes by g. Range on flat ground: **R = v² sin(2θ) / g** — max at **45°**, and complementary angles (30° and 60°) land at the same spot.

🧪 lab: projectile
? A ball launched at 20 m/s and 45° lands about … away | *40.8 m | 20 m | 81.6 m
? Which angle lands at the same spot as 25°? | *65° | 50° | 35°
? At the top of its path, a projectile's vertical velocity is … | *zero | maximum

@ friction-forces | ⚡ Physics | Friction and net force
**Friction = μ × normal force** (on flat ground, normal force = mg). Net force = applied − friction; then **a = F_net / m**.

🧪 lab: push
? A 5 kg box on wood (μ = 0.2) has friction of about … | *9.8 N | 1 N | 49 N
? Pushing that box with 20 N gives acceleration about … | *2 m/s² | 4 m/s² | 0.5 m/s²
? Ice has a … coefficient of friction | *small | large

@ circular-motion | ⚡ Physics | Circular motion
Moving in a circle needs a **centripetal** force toward the center: **F = mv²/r**. Swing a ball on a string — the string's pull keeps it circling. Let go and it flies off in a **straight line** (tangent).
? Centripetal force points … | *toward the center | outward
? Doubling the speed makes the needed force … | *4 times bigger | twice as big
? On a car turning a curve, the centripetal force comes from … | *friction on the tires | the engine

@ gravitation | ⚡ Physics | Universal gravitation
**F = G m₁m₂ / r².** Double the distance → **¼** the force. Surface gravity depends on a planet's mass and radius — that's why you'd weigh 2.5× as much on Jupiter.

🧪 lab: weight
? Doubling the distance between two masses makes gravity … | *1/4 as strong | 1/2 as strong
? An 60 kg person on Mars (g = 3.71) weighs about … | *223 N | 588 N | 60 N
? Gravity between two objects depends on … | *both masses and the distance | only the bigger mass

@ work-power | ⚡ Physics | Work and power
- **Work = force × distance** (joules), when the force is along the motion.
- **Power = work ÷ time** (watts).
? Lifting a 10 N box 2 m does … of work | *20 J | 5 J | 12 J
? Doing 600 J of work in 3 s is … of power | *200 W | 1,800 W | 603 W
? Holding a box still (no motion) does … work | *no | lots of

@ energy-11 | ⚡ Physics | Conservation of mechanical energy
**PE = mgh**, **KE = ½mv²**. With no friction, PE + KE stays constant. A ball dropped from h hits the ground at **v = √(2gh)**.

🧪 lab: pendulum
? A 2 kg ball 5 m up has PE of … | *98 J | 10 J | 49 J
? A 2 kg ball moving 3 m/s has KE of … | *9 J | 6 J | 18 J
? A pendulum released from rest reaches its highest speed at … | *the lowest point | the highest point

@ momentum-11 | ⚡ Physics | Impulse and momentum
**Impulse = F × Δt = Δp.** Airbags and padding **increase the time** of a collision, so the force is smaller. In collisions, total momentum is conserved.
? Airbags reduce injury by … | *increasing the stopping time | increasing the force
? A 2 kg cart at 3 m/s hits a stuck-together 1 kg cart at rest. Their speed after is … | *2 m/s | 3 m/s | 1.5 m/s
? Impulse equals the change in … | *momentum | energy

@ shm | ⚡ Physics | Springs and simple harmonic motion
A mass on a spring bounces with period **T = 2π√(m/k)**. Stiffer spring → faster bouncing; heavier mass → slower.

🧪 lab: spring
? A stiffer spring makes the bounce … | *faster | slower
? Quadrupling the mass makes the period … | *twice as long | four times as long
? Hooke's law says F = … | *kx | mg/x

@ pendulum-11 | ⚡ Physics | The pendulum period
For small swings: **T = 2π√(L/g)**. It doesn't depend on mass or (small) amplitude. To double the period, make the string **4×** as long.

🧪 lab: pendulum
? A 1 m pendulum on Earth has a period of about … | *2.0 s | 1.0 s | 6.3 s
? To double the period, the length must be … | *4× longer | 2× longer
? On the Moon (g ≈ 1.6), the same pendulum's period is … | *longer | shorter

@ doppler | ⚡ Physics | Sound and the Doppler effect
A source moving **toward** you sounds **higher** (waves bunch up); moving **away**, lower. Loudness is measured in **decibels** — every +10 dB is 10× the intensity.

🧪 lab: sound
? An ambulance coming toward you sounds … | *higher pitched | lower pitched
? 80 dB is how many times more intense than 60 dB? | *100 | 20 | 2
? Sound travels faster in … | *water | air

@ refraction | ⚡ Physics | Reflection and refraction
- **Reflection:** angle in = angle out.
- **Refraction:** light bends when its speed changes between materials. **n = c / v**; light slows in glass (n ≈ 1.5).
- **Total internal reflection** keeps light inside optical fibers.
? Light entering glass from air bends … | *toward the normal | away from the normal
? Light travels slowest in a material with … | *a high index of refraction | a low index
? Fiber optics depend on … | *total internal reflection | diffraction

@ coulomb | ⚡ Physics | Electric charge and Coulomb's law
**F = k q₁q₂ / r².** Like charges repel; opposite charges attract. Like gravity, doubling the distance makes the force **¼**.
? Two electrons … | *repel | attract
? Tripling the distance makes the electric force … | *1/9 | 1/3
? Charge is measured in … | *coulombs | newtons

@ ohms-law | ⚡ Physics | Ohm's law and circuits
**V = IR.** Series: resistances add (R = R₁ + R₂). Parallel: 1/R = 1/R₁ + 1/R₂. **Power P = VI = I²R.**

🧪 lab: circuit
? A 9 V battery across 3 Ω gives a current of … | *3 A | 27 A | 6 A
? Two 3 Ω bulbs in series have a total resistance of … | *6 Ω | 1.5 Ω
? Two 3 Ω bulbs in parallel have a total resistance of … | *1.5 Ω | 6 Ω

@ induction | ⚡ Physics | Magnetism and induction
Currents make magnetic fields; **changing** magnetic fields make currents (**electromagnetic induction**). Generators spin magnets near coils to make electricity; transformers change voltage.
? A generator turns … into electricity | *motion | light
? Induction needs a magnetic field that is … | *changing | constant
? A motor turns electricity into … | *motion | heat only

@ thermo | ⚡ Physics | Heat and specific heat
**Q = mcΔT.** Water's specific heat is high (4.18 J/g·°C) — it warms and cools slowly, which is why coasts have milder weather. When hot and cold mix, heat lost = heat gained.

🧪 lab: mix
? 100 g of 80°C water mixed with 300 g of 20°C water ends at … | *35°C | 50°C | 60°C
? Heating 10 g of water by 5°C takes about … | *209 J | 50 J | 4.18 J
? Coastal cities have milder weather because water has a high … | *specific heat | density

@ kinetic-theory | 🧪 Chemistry | Kinetic theory of gases
Gas pressure comes from particles **colliding** with walls. Temperature (in kelvin) is proportional to the particles' average **kinetic energy**. At 0 K (absolute zero), particle motion is at its minimum.

🧪 lab: gas
? Absolute zero is … | *0 K (−273°C) | 0°C
? Heating a gas makes its particles … | *move faster | get bigger
? Gas pressure comes from … | *particles hitting the walls | particles touching each other

@ seismic-waves-11 | 🌍 Earth & space | Seismic waves and Earth's interior
**P waves** (compression) travel through solids and liquids; **S waves** (shear) can't go through liquids. The **S-wave shadow zone** showed scientists that Earth's **outer core is liquid**.

🧪 lab: quake
? S waves can't travel through … | *liquids | solids
? The S-wave shadow zone shows the outer core is … | *liquid | solid
? P waves are … waves | *compression | surface only

@ biomechanics | 🧬 Biology | Physics in the body
Your arm is a **lever**: the elbow is the fulcrum and the biceps pulls close to it, so muscles must pull **much harder** than the weight in your hand — but your hand moves fast and far.

🧪 lab: lever
? In your forearm, the fulcrum is the … | *elbow | hand
? Because the biceps attaches close to the elbow, it must pull … than the load | *harder | more gently
? A weight 30 cm from the elbow, biceps 3 cm from it: the biceps pulls about … the weight | *10× | 3×
`;
