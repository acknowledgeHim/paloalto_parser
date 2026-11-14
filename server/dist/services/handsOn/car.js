/** 🚗 Hands-on: car repair — gets you ready for ASE Entry-Level tests and EPA 609 (format: ../mathLessonsParse.ts; right choice starred). */
export const HO_CAR = `
@ car-ase | 🚗 Car repair (ASE) | 🎓 ASE certification: the mechanic's credential
**ASE** (the National Institute for Automotive Service Excellence) gives the certifications shops look for. Its patch on a mechanic's sleeve means they passed ASE's tests.

## For students: ASE Entry-Level
- Made for **high-school and college students** in auto programs. Tests include **Maintenance & Light Repair**, Brakes, Electrical/Electronic Systems, Engine Performance, Suspension & Steering, Engine Repair, Heating & A/C, and transmissions.
- Usually taken through a **school auto program** (ask the auto-shop teacher). Each passed test earns a certificate that's good for **2 years**.

## For pros: ASE certified (A1–A9)
The professional tests (A1 Engine Repair, A4 Suspension & Steering, A5 Brakes, A6 Electrical, A8 Engine Performance, and more) need **hands-on work experience** — about **2 years** (school can count for part). Pass A1–A8 and you're a **Master Automobile Technician**. Pro certs are renewed every **5 years**.

## Bonus: EPA Section 609
To service car **air conditioning** (and buy refrigerant in bulk) you need **EPA 609** certification. It's a short, open-book test you can take online — a great first credential.

## What these lessons cover
Shop safety and lifting, maintenance, diagnosing with a scan tool, batteries and charging, brakes, tires, cooling, and "it won't start."
? ASE Entry-Level certification is made for … | *students in auto programs | only master mechanics | car salespeople
? To work on a car's A/C refrigerant you need … | *EPA Section 609 certification | a driver's license only | OSHA 30
? Passing ASE A1 through A8 makes you a … | *Master Automobile Technician | Journeyman electrician | Welding inspector

@ car-lifting | 🚗 Car repair (ASE) | Lifting a car safely
A car weighs about **4,000 pounds**. People are killed every year by cars falling off jacks.

## Tools
- **Floor jack** (rated over the weight you're lifting)
- **Jack stands** — always in pairs, rated for the car
- **Wheel chocks**
- The owner's manual (it shows the **jack points**)

## Steps
1. Park on **flat, solid** ground (not dirt or asphalt on a hot day). Put it in Park (or in gear) with the **parking brake on**.
2. **Chock** the wheels on the end that stays on the ground.
3. Jack **only at a jack point** or a frame lift point — not the oil pan, floor pan or suspension arm.
4. Lift just high enough, then set **jack stands** under solid points and lower the car onto them.
5. Shake the car gently. If it moves, start over.

## The rule
⚠️ **Never get under a car held up only by a jack.** Jacks leak down and slip. The spare-tire jack is for changing a tire on the road — nothing else.
? What must hold the car before you go under it? | *Jack stands on solid points | the floor jack alone | the spare-tire jack
? Where should you put the jack? | *At the jack points shown in the owner's manual | under the oil pan | anywhere under the floor
? Before lifting, put wheel chocks … | *at the wheels staying on the ground | in the trunk | under the jack

@ car-oil | 🚗 Car repair (ASE) | Changing the oil and checking fluids
Oil keeps engine parts from grinding together and carries heat away. Old oil gets dirty and thin.

## Tools and parts
The right **oil** (viscosity like **0W-20** or **5W-30** — it's in the manual and often on the oil cap), the right **filter**, a wrench or socket for the drain plug, an **oil filter wrench**, a drain pan, funnel, gloves and rags.

## Steps
1. Warm the engine a few minutes (warm oil drains better — but it can be **hot**).
2. Lift safely, put the pan under the **drain plug**, remove it, let it drain.
3. Put the plug back with a **new crush washer** if it uses one. Tighten to the spec — not as hard as you can (stripped pans are expensive).
4. Remove the old filter. Wipe a little new oil on the new filter's rubber gasket; make sure the old gasket didn't stay stuck on. Spin it on **hand-tight** plus the turn the filter box says.
5. Fill with the amount in the manual, run the engine a minute, check for leaks, then check the **dipstick**: the level should be between the two marks.
6. Take used oil and filters to a **recycling** center or parts store. Never pour it out — one gallon can pollute a million gallons of water.

## Other fluids to check
Coolant (in the overflow tank, engine **cold**), brake fluid, windshield washer, power-steering (some cars), and transmission fluid (some cars have no dipstick — see the manual).
? In "5W-30", the 5W is about how the oil flows … | *when cold (winter) | at 5 miles per hour | for 5 weeks
? Before putting a new oil filter on, you should … | *put a little oil on its gasket and check the old gasket came off | fill it with grease | tighten it with a hammer
? Used motor oil should be … | *taken to a recycling center | poured in a storm drain | put in the trash
? Check the coolant level when the engine is … | *cold | running hot | just shut off

@ car-scan | 🚗 Car repair (ASE) | The check-engine light and scan tools
Since **1996**, cars sold in the U.S. have **OBD-II** — a computer system that watches the engine and emissions. When it sees a problem it stores a **trouble code** and may turn on the **check-engine light**.

## Reading codes
Plug an **OBD-II scan tool** into the port under the dash (near the steering column). Codes look like **P0301**:
- **P** = powertrain (B body, C chassis, U network)
- **0** = a standard code (1 = maker-specific)
- the rest tells the system: **P0300** random misfire, **P0301** misfire in cylinder 1, **P0171** running lean, **P0420** catalytic converter efficiency, **P0442** small evaporative (gas cap) leak

## The big lesson
⚠️ **A code points to a problem, not always a part.** P0171 (lean) could be a vacuum leak, a dirty air-flow sensor, or a weak fuel pump. Good techs **test** before replacing.

## How to diagnose (any problem)
1. **Verify** the complaint — see it or hear it yourself.
2. Read codes and **freeze-frame** data (how the car was running when the code set).
3. Check the basics and look for **service bulletins**.
4. **Test** the suspected part (wiring, voltage, pressure).
5. Fix it, clear the code, and **road-test** to confirm.

A **flashing** check-engine light means a bad misfire right now — it can overheat the catalytic converter. Ease off and get it checked soon.
? OBD-II has been on U.S. cars since … | *1996 | 1960 | 2020
? A P0301 code means … | *a misfire in cylinder 1 | low tire pressure | the radio is broken
? A trouble code tells you … | *which system has a problem — then you test to find the part | exactly which part to buy every time | nothing useful
? A flashing check-engine light means … | *a severe misfire now — get it checked soon | the bulb is loose | an oil change is due

@ car-battery | 🚗 Car repair (ASE) | Batteries, charging and jump-starting
A car battery is **12 volts**. The **alternator** recharges it while the engine runs.

## Testing with a multimeter (set to DC volts)
- Engine off, rested: **12.6 V** = fully charged, **12.4 V** ≈ 75%, **12.0 V or lower** = flat
- Engine running: about **13.7–14.7 V** means the alternator is charging. Lower = charging problem; much higher = overcharging.
- A **load test** (or a battery tester) shows whether it can still crank — a battery can show 12.6 V and still be weak.

## Cleaning terminals
White or green crust on the posts stops current. Disconnect the **negative (−) first**, clean with a brush and baking-soda water, reconnect **positive (+) first**, negative last.

## Jump-starting
1. Both cars off. **Red** clamp to the dead battery's **+**.
2. Other **red** to the good battery's **+**.
3. **Black** to the good battery's **−**.
4. Last **black** to **bare metal** on the dead car's engine, away from the battery (batteries can give off hydrogen gas — sparks there can make it explode).
5. Start the good car, wait a minute, start the dead one. Remove in reverse order.

⚠️ Wear safety glasses — batteries hold acid. Hybrids and electric cars have **high-voltage** systems (orange cables): never touch those without special training.
? A rested, fully charged car battery reads about … | *12.6 volts | 6 volts | 120 volts
? With the engine running, about 14 volts at the battery means … | *the alternator is charging | the battery is dead | the starter is bad
? When removing battery cables, take off … first | *the negative (−) | the positive (+) | either one
? The last jumper clamp goes on … | *bare metal on the dead car's engine, away from the battery | the dead battery's negative post | the good car's radiator

@ car-nostart | 🚗 Car repair (ASE) | Diagnosing "it won't start"
Listen carefully — the sound tells you where to look. An engine needs **fuel, spark, air** and **compression**, plus a battery to crank it.

## Nothing happens, or a single click
Battery or connection problem, the starter, or the car isn't in **Park/Neutral**. Check battery voltage and the cable ends first. Lights dim badly when you turn the key → weak battery.

## Rapid clicking
Almost always a **weak battery** or **loose/corroded terminals**. Try a jump.

## It cranks (turns over) but won't start
The starter works; one of the "big three" is missing:
- **Fuel** — out of gas? Listen for the fuel pump humming for 2 seconds when you turn the key on. Check fuel pressure with a gauge.
- **Spark** — check codes, a bad crank sensor can stop spark. A spark tester shows if coils fire.
- **Air** — rare, but a blocked intake can do it.
- Security light flashing? The **key chip** may not be recognized.

## Starts then dies
Often the anti-theft system, a fuel delivery problem, or an idle air problem.
? Rapid clicking when you turn the key usually means … | *a weak battery or bad connections | too much fuel | a flat tire
? If the engine cranks but won't start, the starter is … and you check fuel, spark and air | *working | broken | out of oil
? A humming for 2 seconds when you turn the key on is usually … | *the fuel pump priming | the battery boiling | the brakes

@ car-brakes | 🚗 Car repair (ASE) | Brakes: diagnosing and replacing pads
## Sounds and feelings
- **High squeal** when braking: the pads' **wear indicator** — they're getting thin.
- **Grinding:** metal on metal. Pads are gone and the rotors are being damaged — stop driving it.
- **Pulsing pedal** or shaking steering wheel: warped (uneven) rotors.
- **Spongy, soft pedal:** **air** in the brake lines, or a leak. ⚠️ Dangerous.
- **Pulls to one side:** a sticking caliper or a worn hose.

## Pad replacement (disc brakes)
Tools: jack and stands, lug wrench, socket set, C-clamp or caliper piston tool, brake cleaner, torque wrench, high-temperature brake grease.
1. Lift safely, remove the wheel. Look at pad thickness — about **3 mm (⅛ inch)** or less means replace.
2. Remove the caliper bolts, hang the caliper with wire — **don't let it hang by the hose**.
3. Swap the pads and clips; grease the **slide pins** (not the pad faces!).
4. Push the piston back slowly (watch the brake fluid level so it doesn't overflow).
5. Reinstall, torque the bolts, put the wheel on, and **pump the pedal** until it's firm **before** you drive.

## Brake fluid
Usually **DOT 3 or DOT 4**. It soaks up water over time and should be flushed on schedule. It eats paint — wipe spills right away.
⚠️ Brake dust can be harmful — use brake cleaner, not compressed air.
? Grinding when you brake means … | *the pads are worn to metal — stop driving it | the brakes are new | the radio is loud
? A soft, spongy brake pedal usually means … | *air in the lines or a leak | the pads are new | too much air in the tires
? After new pads, before driving you must … | *pump the brake pedal until it's firm | wash the car | drive fast to break them in
? Never let a brake caliper hang by … | *its brake hose | wire | a bungee cord

@ car-tires | 🚗 Car repair (ASE) | Tires and wheels
## Pressure
Use the number on the **sticker in the driver's door jamb** — not the "max" number on the tire. Check **cold** (before driving), monthly. Low tires wear the edges, waste gas and can overheat and blow out.

## Tread
Legal minimum in most states is **2/32 inch**. Penny test: put Lincoln's head down into the groove — if you can see all of his head, it's time for new tires. Uneven wear tells a story:
- Both edges worn → underinflated
- Center worn → overinflated
- One edge worn → **alignment** problem

## Changing a wheel
1. Loosen the lug nuts **a half turn while the tire is on the ground**.
2. Lift safely, remove the nuts and wheel.
3. Put the wheel on, start every nut **by hand** (cross-threading strips them).
4. Snug them in a **star (criss-cross) pattern**, lower the car, then **torque** to spec (often 80–100 ft-lb for cars) in a star pattern.
5. Re-check the torque after 50–100 miles.
? The right tire pressure is on … | *the sticker in the driver's door jamb | the tire's maximum number | the gas cap
? Tires worn on just one edge usually point to … | *an alignment problem | perfect tires | too much air
? Tighten lug nuts in … | *a star (criss-cross) pattern | a circle as tight as you can | any order with an impact gun only
? Loosen the lug nuts … | *with the tire still on the ground | after the car is in the air | never

@ car-cooling | 🚗 Car repair (ASE) | Overheating and the cooling system
The engine makes a lot of heat. **Coolant** (antifreeze mixed about **50/50** with water) is pumped by the **water pump** through the engine, then through the **radiator**, where air (and a fan) cools it. The **thermostat** opens when the engine is warm.

## If the temperature gauge climbs
Turn off the A/C and turn the **heater on full** (it pulls heat out of the engine), pull over safely, and shut it off.
⚠️ **Never open a hot radiator cap.** The coolant is under pressure and far above boiling — it can spray out and burn you badly. Wait until it's cold.

## Common causes
- **Low coolant** from a leak (look for sweet-smelling green, orange or pink puddles — and keep pets away; it's poisonous)
- **Thermostat stuck closed**
- **Cooling fan** not turning on (fuse, relay, motor)
- **Water pump** leaking or failing
- A **blown head gasket** (white sweet smoke, bubbles in the coolant) — a big job
? Antifreeze is usually mixed with water about … | *50/50 | 1/99 | 100% water
? If the engine is overheating, turning the heater on full … | *helps pull heat out of the engine | makes it worse | does nothing
? Why not open a hot radiator cap? | *Coolant under pressure can spray out and burn you | It voids the warranty | The cap will freeze
? A thermostat stuck closed causes … | *overheating | a flat tire | a dead radio
`;
