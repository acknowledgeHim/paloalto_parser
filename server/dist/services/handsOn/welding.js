/** 🔥 Hands-on: welding — gets you ready for AWS SENSE and the AWS Certified Welder test (format: ../mathLessonsParse.ts; right choice starred). */
export const HO_WELDING = `
@ weld-aws | 🔥 Welding (AWS) | 🎓 AWS certification: proving you can weld
The **American Welding Society (AWS)** writes the welding codes and runs the best-known welder certifications.

## For students: AWS SENSE
**SENSE** (Schools Excelling through National Skills Education) is AWS's program for schools. **SENSE Level I – Entry Welder** covers safety, reading drawings and symbols, and welding with stick, MIG, flux-core and TIG, plus cutting. You take written tests and **practical tests** (you weld, they inspect).

## The real proof: AWS Certified Welder
- A **performance test**: you weld a test plate (or pipe) in a set position, often to the **AWS D1.1 Structural Welding Code – Steel**.
- It's taken at an **AWS Accredited Test Facility** (many community colleges and some high schools are one).
- The plate is cut into strips and **bent** — a good weld bends without cracking open.
- You keep it active by sending in a **continuity** form every **6 months** showing you're still welding with that process.

## Positions you'll hear about
Plate: **1G flat, 2G horizontal, 3G vertical, 4G overhead** (G = groove weld, F = fillet weld). Pipe adds **5G** and **6G** (pipe at a 45° angle — the hardest, and the best paid).
? AWS SENSE is a welding program for … | *schools and students | only aircraft mechanics | plumbers
? In an AWS weld test the strips are … to check the weld | *bent | painted | weighed
? A 3G test weld is done in the … position | *vertical | flat | overhead
? AWS D1.1 is the code for welding … | *structural steel | aluminum boats | plastic pipe

@ weld-safety | 🔥 Welding (AWS) | Welding safety: light, fire, fumes and shock
## Your eyes and skin
A welding arc gives off strong **ultraviolet (UV)** light. Looking at it even for a moment can cause **arc eye** ("welder's flash") — like sunburn on your eyes, very painful, felt hours later. It burns skin like a bad sunburn too.
- **Welding helmet** with the right shade (about **shade 10–13** for most arc welding; an auto-darkening helmet is easiest)
- **Safety glasses under the helmet** — slag and grinding chips fly when the hood is up
- **Flame-resistant (FR) clothing** — heavy cotton, wool or leather. ⚠️ **No synthetics** (polyester, nylon): they melt into your skin.
- Leather **welding gloves**, leather boots, no cuffs or open pockets (sparks land in them)
- Screens to protect people nearby

## Fire
Clear burnable things **35 feet** away, keep an extinguisher handy, and keep a **fire watch** after.

## Fumes
Weld with good **ventilation** and keep your head out of the smoke plume. ⚠️ Never weld **galvanized** (zinc-coated) steel without removing the coating and serious ventilation — zinc fumes cause **metal fume fever**. Never weld or cut containers that held fuel or chemicals.

## Shock
Stay **dry** — no welding in wet gloves or standing in water. Inspect cables and keep the ground clamp near the weld.

## Gas cylinders
Store them **upright and chained**, with caps on when not in use. Never drop them.
? "Arc eye" (welder's flash) is caused by … | *ultraviolet light from the arc | loud noise | cold air
? Why not wear polyester while welding? | *It melts onto your skin | it's too warm | it's too heavy
? Zinc fumes from galvanized steel can cause … | *metal fume fever | better welds | stronger metal
? Gas cylinders should be stored … | *upright and chained, with caps on | lying on the floor | near the welding table without caps

@ weld-processes | 🔥 Welding (AWS) | The welding processes
Welding melts two pieces of metal (usually with a filler metal) so they flow together and become one piece.

- **Stick (SMAW)** — a coated rod (electrode) melts into the joint; the coating makes gas and **slag** that protect the weld. Works outdoors and on dirty metal. Great for farms, construction, pipelines.
- **MIG (GMAW)** — a wire feeds from a spool through a gun, with **shielding gas** from a tank. Fast and the easiest to learn. Shops, car bodies, factories.
- **Flux-core (FCAW)** — like MIG, but the wire has flux inside, so it can work without gas, even in wind. Leaves slag.
- **TIG (GTAW)** — a **tungsten** electrode makes the arc, and you add filler rod by hand. Slow, clean and precise — aluminum, stainless steel, thin metal, race cars, aircraft.
- **Oxy-fuel** — an oxygen and acetylene flame for cutting, heating, brazing.
- **Plasma cutting** — a very hot jet of ionized gas cuts any metal that conducts electricity.
? Which process uses a spool of wire and shielding gas from a tank? | *MIG (GMAW) | stick (SMAW) | oxy-fuel
? Which process uses a tungsten electrode and filler added by hand? | *TIG (GTAW) | flux-core | stick
? Which process is best outdoors in the wind on dirty steel? | *stick (SMAW) | TIG | MIG with gas
? Slag is … | *a crust that protects the weld and is chipped off after | the metal you weld | a kind of helmet

@ weld-stick | 🔥 Welding (AWS) | Stick welding: electrodes and technique
## Reading an electrode: E7018
- **E** = electrode
- **70** = the weld is at least **70,000 psi** strong when pulled (tensile strength)
- **1** = can weld in **all positions** (2 = flat and horizontal only)
- **8** = the coating type and current (7018 is a **low-hydrogen** rod)
Common rods: **6010/6011** (digs deep, good on dirty metal), **6013** (smooth, easy, light jobs), **7018** (strong, used on structural steel and certification tests — keep it **dry in a rod oven**, since moisture causes cracking).

## Technique: the four things to control
1. **Current (amps)** — too low and the rod sticks; too high and it spatters and undercuts. Start with the box's range.
2. **Arc length** — about the **diameter of the rod**. Too long = spatter and porosity.
3. **Angle** — drag the rod with about a **10–15°** lean in the direction of travel. ("If there's slag, you drag.")
4. **Travel speed** — the bead should be about **2 rod-widths** wide with even ripples.

Strike the arc like a match, keep it steady, and chip the slag off when it cools (with glasses on).
? In E7018, the "70" means … | *at least 70,000 psi tensile strength | 70 amps | a 70-inch rod
? Why are 7018 rods kept in an oven? | *Moisture in the coating can cause cracking | to make them easier to see | to save money
? A good arc length is about … | *the diameter of the rod | 6 inches | touching the metal
? "If there's slag, you …" | *drag | push | stop

@ weld-mig | 🔥 Welding (AWS) | MIG welding setup and technique
## Setup
- Clean the metal to **bare, shiny steel** (grinder or flap disc) — rust, paint and oil cause **porosity** (holes).
- Wire: **ER70S-6** for mild steel, often 0.030 or 0.035 inch.
- Gas: **75% argon / 25% CO₂** ("C25") for steel, flow about 20–30 cubic feet per hour.
- Set **voltage** (heat) and **wire speed** from the chart inside the machine's door for your metal thickness.
- Attach the **ground clamp** to clean metal close to the joint.

## Technique
- Keep about **⅜ inch** of wire sticking out (stick-out).
- Gun angle about **10–15°**; push or pull — keep it steady.
- Listen: a smooth **"bacon frying"** sizzle means it's set right. Popping and spatter = wrong settings or too much stick-out.
- Watch the **puddle**, not the arc, and move at a speed that keeps it the same size.

## Practice plan
Run straight beads on flat plate → lap joints → **T-joints (fillet welds)** → butt joints → then vertical. Cut and break your practice welds to see inside them.
? Holes (porosity) in a MIG weld are often caused by … | *dirty metal or not enough shielding gas | too much practice | a new helmet
? A common shielding gas for MIG on steel is … | *75% argon / 25% CO₂ | pure oxygen | helium only
? A good MIG weld sounds like … | *bacon frying | a siren | nothing at all
? Where should the ground clamp go? | *on clean metal close to the joint | on the gas bottle | on your boot

@ weld-joints | 🔥 Welding (AWS) | Joints, weld types and welding symbols
## The five basic joints
- **Butt** — two pieces edge to edge in a line
- **Tee** — one piece standing on another like a T
- **Lap** — one piece overlapping another
- **Corner** — two pieces meeting at a corner (an L)
- **Edge** — two pieces side by side, welded along their edges

## Weld types
- **Fillet weld** — a triangle-shaped weld in a corner (tee, lap and corner joints). The most common weld.
- **Groove weld** — fills a gap between pieces (butt joints). Thick plate gets a **bevel** ground on the edge so the weld can go all the way through (**full penetration**).

## Welding symbols (on blueprints)
An arrow points to the joint. A **triangle** means fillet weld. If the symbol is **below** the line, weld the **arrow side**; **above** the line, the **other side**. A **flag** means weld it in the field (on site); a **circle** means weld **all around**.
? A triangle-shaped weld in the corner of a tee joint is a … | *fillet weld | groove weld | plug weld
? On a welding symbol, a circle at the bend of the arrow means … | *weld all the way around | don't weld | grind it smooth
? Thick plate for a butt joint is beveled so the weld gets … | *full penetration | painted | lighter

@ weld-defects | 🔥 Welding (AWS) | Inspecting welds and fixing defects
Inspectors (an AWS **Certified Welding Inspector**, CWI, is a top job) look for:
- **Porosity** — gas bubbles/holes. Cause: dirty metal, wind blowing away gas, wet rods. Fix: clean, check gas flow, block wind.
- **Undercut** — a groove melted into the base metal along the edge. Cause: too hot, too fast, wrong angle.
- **Lack of fusion** — the weld sits on top and didn't melt in. Cause: too cold, too fast. Very dangerous — it looks OK but is weak.
- **Cracks** — never acceptable. Cause: cooling too fast, moisture (hydrogen), the wrong filler.
- **Spatter** — little balls stuck around the weld. Mostly looks bad; fix settings.
- **Slag inclusions** — slag trapped inside. Clean between passes.

## Tests
**Visual** first, then **bend tests**, and in industry **X-ray** or **ultrasonic** testing that sees inside.
? A weld that sits on top of the metal without melting in has … | *lack of fusion | undercut | perfect penetration
? Cracks in a weld are … | *never acceptable | fine if they're small | a sign of a strong weld
? A groove melted into the base metal along the edge of the weld is … | *undercut | spatter | porosity

@ weld-cutting | 🔥 Welding (AWS) | Cutting metal: oxy-fuel and plasma
## Oxy-acetylene
Two hoses: **green = oxygen**, **red = fuel** (acetylene). Acetylene is never used above **15 psi** — it can become unstable.
1. Check the hoses and fittings; use **flashback arrestors**.
2. Open cylinder valves slowly (acetylene only about a half to one turn, wrench left on the valve).
3. Light the fuel with a **striker** (never a lighter), add oxygen to a sharp neutral flame.
4. Preheat the steel to cherry red, then press the **cutting oxygen** lever — the oxygen burns through the steel.
5. To shut off: close the fuel first, then oxygen (follow your shop's procedure), close the cylinders, and bleed the lines.
Oxy-fuel cuts **steel**, not aluminum or stainless.

## Plasma
Uses electricity and compressed air. Cuts **any conductive metal** (steel, stainless, aluminum) with a narrow clean cut. Wear the right shade lens too — the arc is bright.
? On an oxy-acetylene torch, the oxygen hose is … | *green | red | blue
? Acetylene should never be used above … | *15 psi | 150 psi | 1,500 psi
? Light a cutting torch with … | *a spark striker | a cigarette lighter | a match held in your hand
? Which can cut aluminum? | *plasma | oxy-acetylene | neither
`;
