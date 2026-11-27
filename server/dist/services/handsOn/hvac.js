/** ❄️ Hands-on: heating & cooling — gets you ready for EPA Section 608 and NCCER HVAC Level 1 (format: ../mathLessonsParse.ts; right choice starred). */
export const HO_HVAC = `
@ hvac-epa608 | ❄️ HVAC (EPA 608) | 🎓 EPA Section 608: the HVAC tech's must-have
Under the **Clean Air Act**, anyone who opens a system and handles **refrigerant** (air conditioners, heat pumps, fridges) must have **EPA Section 608** certification. Without it you can't legally work on those systems or buy most refrigerants. It's one of the **best first credentials** for a teen — and it **never expires**.

## The four parts
- **Core** — the laws, the ozone layer, the refrigeration cycle, recovery, safety, shipping. (Everyone takes Core.)
- **Type I** — **small appliances** with 5 pounds of refrigerant or less (window units, fridges, dehumidifiers)
- **Type II** — **high-pressure** systems (home central A/C, heat pumps, most commercial)
- **Type III** — **low-pressure** systems (big building chillers)
- Pass all four = **Universal**

## How to take it
Through an **EPA-approved certifying organization** — many HVAC schools and supply houses give it, and some offer it online with a proctor. Each section is 25 multiple-choice questions. Start with **Core + Type I**, then Type II.

## Other HVAC credentials
**NCCER HVAC Level 1** (school), **HVAC Excellence** student tests, **NATE** (for working techs), and state or city HVAC/mechanical licenses.
? To handle refrigerant legally you need … | *EPA Section 608 certification | a driver's license | OSHA 10 only
? Type I EPA 608 covers … | *small appliances with 5 pounds of refrigerant or less | big chillers | cars
? Home central air conditioning is a … system | *Type II high-pressure | Type III low-pressure | Type I small appliance
? Does EPA 608 certification expire? | *No — it's for life | Yes, every year | Yes, every month

@ hvac-cycle | ❄️ HVAC (EPA 608) | The refrigeration cycle
An air conditioner doesn't make cold — it **moves heat** from inside to outside. **Heat always flows from hot to cold**, and liquids **absorb heat when they boil** (evaporate) and **give it off when they condense**.

## The four main parts (in order)
1. **Compressor** (outside) — squeezes low-pressure refrigerant **vapor** into **high-pressure, hot vapor**.
2. **Condenser** (outside coil + fan) — the hot vapor gives its heat to the outdoor air and **condenses into a liquid**.
3. **Metering device** (expansion valve or fixed orifice) — a tiny opening; the liquid's **pressure drops** suddenly and it gets very cold.
4. **Evaporator** (inside coil, by the furnace fan) — the cold refrigerant **boils** into vapor, soaking up heat from the house air blown across it. Then back to the compressor.

The inside coil also pulls **water** out of the air (dehumidifying) — it drips into a pan and out a **condensate drain**.

## Heat pumps
A **reversing valve** runs the cycle backward in winter: it pulls heat **from the outside air** (even cold air has some) and brings it inside.
? An air conditioner works by … | *moving heat from inside to outside | making cold from nothing | adding ice to the air
? Refrigerant turns from vapor to liquid in the … | *condenser | evaporator | thermostat
? The part that drops the refrigerant's pressure is the … | *metering device (expansion valve) | compressor | air filter
? A heat pump heats in winter using its … | *reversing valve to run the cycle backward | a gas flame | the water heater

@ hvac-refrigerant | ❄️ HVAC (EPA 608) | Refrigerants and the rules
## Old to new
- **CFCs** (like R-12) — damaged the **ozone layer**; banned from new production.
- **HCFCs** (like **R-22**) — less harmful, now **phased out**; only recycled supplies.
- **HFCs** (like **R-410A**, R-134a) — don't hurt ozone; being **phased down** under federal law (the AIM Act), so new equipment is switching.
- **New A2L refrigerants** (like **R-454B** and **R-32**) — used in new equipment; **mildly flammable**, so they have extra rules (no sparks, special tools).

## The big rules (on the Core test)
- **Venting** refrigerant on purpose is **illegal** (fines can be tens of thousands of dollars a day).
- Refrigerant must be **recovered** into an approved **recovery cylinder** (gray body, yellow top) before opening a system.
- Recovery cylinders are filled no more than **80%** full (liquid expands when warm).
- Leaks above set rates in big systems must be repaired by deadlines.
? Releasing refrigerant into the air on purpose is … | *illegal | fine if it's a little | required
? Refrigerant recovery cylinders are colored … | *gray with a yellow top | red | green with white stripes
? Recovery cylinders should be filled no more than … | *80% | 100% | 10%
? R-22 has been … | *phased out | made the new standard | renamed water

@ hvac-safety | ❄️ HVAC (EPA 608) | HVAC safety
- **Electricity:** shut off the **disconnect** by the outdoor unit and the furnace switch, then **test**. A/C units use **240 volts**.
- **Capacitors** store a charge even with power off — **discharge** them safely (with an insulated tool and resistor) before touching.
- **Refrigerant:** liquid refrigerant can cause **frostbite** instantly — wear **gloves and safety glasses**. In a closed room, leaking refrigerant pushes out **oxygen** and can suffocate you.
- **Pressure:** systems run at hundreds of psi; never heat a refrigerant cylinder with a torch.
- **Carbon monoxide:** furnaces burn gas. A cracked heat exchanger or blocked flue can leak **CO** — odorless and deadly. Every home needs **CO detectors**.
- **Attics and roofs:** heat stress, fall hazards, and sharp sheet-metal edges (cut-resistant gloves).
? Why must capacitors be discharged? | *They store a charge even with the power off | they're too cold | they leak refrigerant
? Liquid refrigerant on skin can cause … | *frostbite | a tan | nothing
? Carbon monoxide from a furnace is dangerous because it's … | *odorless and deadly | bright red | always loud
? Most home A/C outdoor units run on … | *240 volts | 12 volts | 24 volts only

@ hvac-tools | ❄️ HVAC (EPA 608) | Gauges, vacuum and charging
## Tools
- **Manifold gauge set** (or digital gauges) — blue hose for the **low (suction)** side, red for the **high (liquid)** side, yellow for service
- **Vacuum pump** and a **micron gauge**
- **Recovery machine** and recovery cylinder
- **Leak detector** (electronic), bubble solution
- Thermometers / temperature clamps, **multimeter**, **clamp meter**, scale for weighing refrigerant

## Evacuating a system
Before charging a new or opened system, pull a deep **vacuum** — usually down to about **500 microns** — to boil off **moisture** and remove air. Moisture makes **acid** that destroys compressors.

## Charging
Systems are charged by **weight** (the nameplate shows how much) or checked by **superheat** (for fixed orifice) and **subcooling** (for expansion valves). Too little or too much both hurt efficiency and the compressor.
? On a manifold gauge set, the blue hose goes to the … | *low (suction) side | high side | water line
? A deep vacuum (about 500 microns) is pulled to … | *remove moisture and air | add refrigerant | test the thermostat
? Moisture left in a refrigeration system can … | *form acid and ruin the compressor | make it colder | nothing
? The nameplate tells you the refrigerant charge by … | *weight | color | smell

@ hvac-thermostat | ❄️ HVAC (EPA 608) | Thermostats and controls
Most systems use low-voltage **24-volt AC** controls from a **transformer** in the furnace or air handler.

## Thermostat wires (common colors)
- **R** — 24-volt power (red)
- **W** — **heat** (white)
- **Y** — **cooling** / compressor (yellow)
- **G** — **fan** (green)
- **C** — common (often blue or black), so smart thermostats have steady power
- **O/B** — heat pump reversing valve

When the thermostat calls for cooling, it connects **R to Y** (compressor) and **R to G** (indoor fan).

## Troubleshooting with the thermostat
Set it to cool a few degrees below the room. Nothing happens? Check thermostat batteries, the furnace power switch, the breaker, a **door safety switch** on the furnace panel, and the **condensate float switch** (shuts the system off if the drain is clogged).
? HVAC control circuits usually run on … | *24 volts AC | 120 volts DC | 480 volts
? The Y wire on a thermostat controls … | *cooling (the compressor) | the fan only | heat
? Calling for heat connects R to … | *W | Y | G

@ hvac-troubleshoot | ❄️ HVAC (EPA 608) | Diagnosing "the A/C isn't cooling"
Work from simple to complex:
1. **Thermostat** set right? Batteries? Set to cool?
2. **Air filter** — a clogged filter starves airflow. It can make the inside coil **freeze into a block of ice**. Change filters every **1–3 months**.
3. **Breakers and the outdoor disconnect** — on?
4. **Outdoor unit**: is the fan spinning? Is the compressor humming? A hum with the fan not spinning often means a bad **capacitor** (a common, cheap part — after discharging it).
5. **Condenser coil** dirty or blocked by plants? It needs about **2 feet** of clear space and a gentle rinse.
6. **Ice on the copper lines or coil** → low airflow or **low refrigerant** (a leak — a certified tech must find and fix it, not just "top it off").
7. **Water** around the furnace → clogged **condensate drain**.

## Furnace "no heat" quick checks
Filter, thermostat, gas valve on, the panel door switch, and the **flame sensor** (a dirty one makes the burners light then shut off after a few seconds — cleaned gently with fine abrasive pad).
? A frozen indoor coil is often caused by … | *a clogged filter (low airflow) or low refrigerant | too much airflow | a new thermostat
? Outdoor unit hums but the fan won't spin — a common cause is … | *a bad capacitor | too much refrigerant | the wrong filter
? Burners light then shut off after a few seconds often means … | *a dirty flame sensor | a full gas tank | a dirty window
? How often should most air filters be changed? | *every 1–3 months | every 5 years | never
`;
