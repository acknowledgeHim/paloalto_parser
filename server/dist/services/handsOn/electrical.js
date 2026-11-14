/** ⚡ Hands-on: electrical — gets you ready for NCCER Electrical Level 1 and an electrical apprenticeship (format: ../mathLessonsParse.ts; right choice starred). */
export const HO_ELECTRICAL = `
@ elec-path | ⚡ Electrical | 🎓 Becoming an electrician: the license path
Electrical work is **licensed** in most states because mistakes cause fires and kill people. The path:

1. **Learn the basics** — NCCER **Core** and **Electrical Level 1** (safety, Ohm's law, electrical theory, the **NEC**, wiring devices, conduit bending, hand bending, test equipment). Many high schools and trade schools offer it.
2. **Apprentice** — about **4 years**, usually around **8,000 hours** of paid on-the-job work plus classroom hours, under a licensed electrician. Union (IBEW/NECA "JATC") and non-union (IEC, ABC) programs both exist.
3. **Journeyman license** — pass your state's exam, which is mostly about the **National Electrical Code (NEC)**.
4. **Master electrician** / contractor license — more years of experience and another exam.

## The NEC
The **National Electrical Code** is **NFPA 70**, updated every **3 years**. States and cities adopt a version (sometimes with changes). The exam is **open-book** in many states — so you must know **how to find** things in the code fast.

## Also useful
**OSHA 10**, and **NFPA 70E** (electrical safety in the workplace) training.
⚠️ These lessons teach how it works. Real wiring should be done by (or with) a **licensed electrician** and a **permit**.
? The National Electrical Code is also called … | *NFPA 70 | OSHA 10 | ASE A6
? An electrical apprenticeship usually takes about … | *4 years | 4 weeks | 20 years
? The NEC is updated every … | *3 years | 50 years | month
? After an apprenticeship, you take an exam to become a … | *journeyman electrician | master plumber | welding inspector

@ elec-theory | ⚡ Electrical | Volts, amps, ohms and watts
## Think of water in a hose
- **Voltage (V)** — the push, like water **pressure**
- **Current (I, amps)** — how much flows, like **gallons per minute**
- **Resistance (R, ohms Ω)** — what slows it, like a **narrow hose**

## Ohm's law
**V = I × R**. So **I = V ÷ R** and **R = V ÷ I**.
Example: a 120-volt heater with 12 ohms of resistance draws 120 ÷ 12 = **10 amps**.

## Power
**Watts = Volts × Amps** (P = V × I). A 1,500-watt hair dryer on 120 volts draws 1,500 ÷ 120 = **12.5 amps** — that's why two of them on one 15-amp circuit trips the breaker.

## AC and DC
Batteries make **DC** (flows one way). Homes get **AC** (alternating — 60 times a second in the U.S., **60 Hz**). U.S. homes get **120 volts** for outlets and **240 volts** for big things (dryers, ovens, A/C).
? Ohm's law is … | *V = I × R | V = I + R | P = R ÷ I
? A 1,200-watt microwave on 120 volts draws … | *10 amps | 1,440 amps | 1 amp
? Current is measured in … | *amps | volts | ohms
? U.S. household AC alternates at … | *60 Hz | 5 Hz | 1,000 Hz

@ elec-safety | ⚡ Electrical | Electrical safety: test before you touch
⚠️ Current through the chest as small as **0.1 amp (100 milliamps)** can stop a heart. A normal 15-amp circuit can kill you many times over. Water and sweat make it worse.

## Lockout / tagout (LOTO)
1. Turn off the breaker for the circuit.
2. **Lock** it (a breaker lock) and **tag** it with your name so nobody turns it back on.
3. **Test** that it's really dead.

## Test-before-touch: "live–dead–live"
1. Test your tester on a circuit you **know is live** (it works?).
2. Test the circuit you'll work on (it should be **dead**).
3. Test the known live circuit **again** (your tester didn't fail in between).
Use a **non-contact voltage tester** to check, then a **multimeter** to be sure. Breakers are sometimes mislabeled — always test.

## Other rules
Insulated tools, dry hands and dry floor, no metal ladders, one hand in your pocket when testing high voltage if you can. Never touch **downed power lines** — stay 35 feet away and call the utility.
? "Live–dead–live" testing means … | *test the tester on a live circuit, test your circuit, then test the tester again | touch the wire twice | turn the breaker on and off
? Lockout/tagout is done so … | *nobody can turn the circuit back on while you work | the breaker looks nice | the wires stay warm
? About how much current across the chest can be deadly? | *0.1 amp (100 milliamps) | 100 amps | 1,000 amps
? Why test even after turning off the labeled breaker? | *Breakers are sometimes mislabeled | it's the law to test twice a day | testers need exercise

@ elec-wire | ⚡ Electrical | Wire, colors and circuits
## Wire colors (U.S. homes)
- **Black** (and red) — **hot**, carries power from the panel
- **White** — **neutral**, the return path
- **Green or bare copper** — **ground**, a safety path that only carries current if something goes wrong

## Wire size (copper)
Smaller **AWG** number = **bigger** wire:
- **15-amp** circuit → **14 AWG**
- **20-amp** circuit → **12 AWG**
- **30-amp** circuit → **10 AWG**
The breaker protects the **wire** from overheating — never put a bigger breaker on a small wire.

## Series and parallel
- **Series** — one path; if one bulb goes out, they all go out (old Christmas lights).
- **Parallel** — each thing gets its own path. **Outlets and lights in houses are parallel**, so each one gets the full 120 volts.
? The white wire in a home circuit is the … | *neutral | hot | ground
? A 20-amp circuit uses at least … copper wire | *12 AWG | 14 AWG | 18 AWG
? Can you put a 30-amp breaker on 14 AWG wire? | *No — the wire could overheat and start a fire | Yes, for more power | Only in winter
? Outlets in a house are wired in … | *parallel | series | a loop with no neutral

@ elec-gfci | ⚡ Electrical | Breakers, GFCIs and AFCIs
## Circuit breakers
A breaker **trips** on an **overload** (too many things plugged in) or a **short circuit** (hot touching neutral or ground). Reset it once. If it trips again right away, there's a real problem — find it before resetting again.

## GFCI (ground-fault circuit interrupter)
Compares the current going out on the hot with the current coming back on the neutral. If about **5 milliamps** is missing — maybe flowing through a person — it shuts off in a fraction of a second. Required near water: **bathrooms, kitchens, laundry, garages, outdoors, basements**, and more. Press **TEST** monthly; it should click off. Press **RESET**.

## AFCI (arc-fault circuit interrupter)
Detects the crackling **arcs** of damaged or loose wires that start fires. Required for most living areas and bedrooms under newer codes.

## Panels
The main panel has a **main breaker** that shuts off the whole house. ⚠️ The big wires coming in **above the main breaker stay live** even when it's off — only the utility can shut those off.
? A GFCI trips when … | *current goes missing (maybe through a person) | the lights are on | it gets dark
? A breaker that trips again right after reset means … | *a real problem to find before resetting again | the breaker likes to click | add a bigger breaker
? AFCIs are made to stop … | *fires from arcing wires | water leaks | power bills
? With the main breaker off, the service wires above it are … | *still live | safe to touch | unplugged

@ elec-outlet | ⚡ Electrical | How an outlet and a switch are wired
## A standard outlet (receptacle)
- **Brass** (gold) screws → **hot** (black)
- **Silver** screws → **neutral** (white). The neutral slot is the **taller** one.
- **Green** screw → **ground** (bare or green)
Wrap the wire **clockwise** around the screw (the way it tightens). Better to use the screws than the "backstab" holes.

## Replacing an outlet (with an adult, breaker off)
1. Turn off the breaker, lock/tag it, and **test the outlet dead** (both halves).
2. Unscrew and pull out the outlet; note (take a photo of) which wire goes where.
3. Move wires one at a time to the new outlet: hot to brass, neutral to silver, ground to green.
4. Fold the wires back, mount it, cover plate on, breaker on, test with a **plug-in outlet tester** (its lights show if it's wired right).

## A single-pole switch
A switch breaks the **hot** wire only — never the neutral. **Three-way switches** (two switches, one light — like the top and bottom of stairs) use special "traveler" wires.

## Tools of the trade
Non-contact voltage tester, multimeter, wire strippers, lineman's pliers, needle-nose pliers, insulated screwdrivers, fish tape, conduit bender.
? On an outlet, the black (hot) wire goes on the … screw | *brass | silver | green
? A light switch should switch the … | *hot wire | neutral wire | ground wire
? Wrap wire around a terminal screw … | *clockwise | counter-clockwise | in a knot
? Two switches controlling one light (top and bottom of stairs) are … | *three-way switches | GFCIs | dimmers only

@ elec-meter | ⚡ Electrical | Using a multimeter to find problems
## Settings
- **V~** (AC volts) for outlets; **V⎓** (DC volts) for batteries and cars
- **Ω** (ohms) for resistance — **only with the power off**
- **Continuity** (beep) — is there an unbroken path? Checks fuses, wires and switches, power off.
- **Amps** — use a **clamp meter** around **one** wire to measure current safely.

## Reading an outlet
Hot to neutral ≈ **120 V**. Hot to ground ≈ 120 V. Neutral to ground ≈ **0 V**. A big neutral-to-ground voltage points to a loose neutral.

## Finding a dead outlet
1. Check the breaker and any **GFCI** upstream (one GFCI can protect outlets in other rooms).
2. Test the outlet; if dead, check the one before it in the chain — a **loose connection** in one box can kill everything after it.
3. Look for burnt or melted spots — a sign of a bad connection that needs a pro.
? Resistance (ohms) should be measured … | *with the power off | on a live circuit | only on batteries
? Hot to neutral at a U.S. outlet should read about … | *120 volts | 12 volts | 0 volts
? To measure current safely, put a clamp meter around … | *one wire | the whole cord | nothing
? A dead outlet in the bathroom may be caused by … | *a tripped GFCI somewhere upstream | the moon | a full fridge
`;
