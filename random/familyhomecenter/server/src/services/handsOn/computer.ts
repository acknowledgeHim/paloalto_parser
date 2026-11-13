/** 💻 Hands-on: computer hardware and electronics — gets you ready for CompTIA A+, ETA International and IPC soldering certification (format: ../mathLessonsParse.ts; right choice starred). */
export const HO_COMPUTER = `
@ hw-certs | 💻 Computer hardware | 🎓 CompTIA A+, ETA and IPC: credentials for fixing and building electronics
Computers, phones, cars, TVs and robots are all built from the same electronics. These credentials show employers you can build, test and repair them.

## CompTIA A+ (computer support technician)
- The best-known first certificate for **IT support** jobs: help desk, PC repair, field technician.
- **Two exams** (Core 1 and Core 2): hardware, laptops and phones, networking basics, operating systems (Windows, Linux, macOS), security, and the **troubleshooting method**.
- Taken at a testing center or online with a proctor. Teens can take it (with a parent's consent if under 18). Many high-school IT programs give it.
- Good for **3 years**; you renew it by taking classes (continuing education) or a higher exam.
- A starter exam, **CompTIA Tech+**, covers the basics if you want a first step.

## ETA International (electronics technician)
ETA gives electronics certificates like **Student Electronics Technician** and **Electronics Technician Associate**: Ohm's law, components, reading schematics, using meters and scopes.

## IPC soldering (J-STD-001 and IPC-A-610)
Factories that build circuit boards (for airplanes, medical devices, phones) hire people certified to the **IPC J-STD-001** soldering standard and the **IPC-A-610** inspection standard. You take a hands-on class at an IPC-licensed training center.

## The engineering path
An **electrical or computer engineering** degree (4 years of college, lots of math and physics) leads to designing chips, circuit boards and computers. Engineers can later earn a **PE (Professional Engineer)** license.
? CompTIA A+ is made of … | *two exams (Core 1 and Core 2) | one 10-question quiz | a typing test
? The IPC J-STD-001 certificate is about … | *soldering circuit boards | driving trucks | painting houses
? CompTIA A+ is good for … before renewing | *3 years | 3 days | the rest of your life
? A degree in electrical or computer engineering leads to … | *designing chips, boards and computers | becoming a plumber | flying planes

@ hw-inside | 💻 Computer hardware | What's inside a computer
Every computer — a laptop, a phone, a game console, the Raspberry Pi — has the same main parts.

## The parts
- **CPU (processor)** — the "brain"; runs the program's instructions, billions per second. It gets hot, so it has a **heat sink and fan** (with thermal paste between).
- **RAM (memory)** — fast, short-term memory for what's running right now. It's **erased when the power goes off**.
- **Storage** — keeps files when it's off: an **SSD** (chips, fast, no moving parts) or an **HDD** (spinning platters, cheaper per gigabyte, slower). **NVMe** SSDs plug right into the motherboard.
- **Motherboard** — the big board everything plugs into; its wires (traces) connect the parts.
- **GPU (graphics card)** — draws the picture; great at doing many small math jobs at once (games, AI).
- **PSU (power supply)** — turns 120 volts AC from the wall into low-voltage DC (12 V, 5 V, 3.3 V) for the parts.
- **Ports** — USB, HDMI/DisplayPort, Ethernet, audio.

## Input → process → output → storage
A keyboard press (input) goes to the CPU (process), the result shows on the screen (output), and you save it (storage).
? Which part is erased when the power goes off? | *RAM | SSD | hard drive
? An SSD is faster than a hard drive because it … | *uses chips with no moving parts | is bigger | spins faster
? The power supply turns wall power into … | *low-voltage DC for the parts | radio waves | more AC
? Thermal paste goes between … | *the CPU and its heat sink | the keyboard and the desk | two RAM sticks

@ hw-binary | 💻 Computer hardware | Bits, bytes and binary
Inside a computer, everything — numbers, letters, pictures, music — is stored as **on** and **off**: **1** and **0**. One 1-or-0 is a **bit**.

## Counting in binary
We count in tens (ones, tens, hundreds). Binary counts in **twos**. In an 8-bit number, the places are worth:
**128 · 64 · 32 · 16 · 8 · 4 · 2 · 1**
So **00000101** = 4 + 1 = **5**, and **11111111** = **255** (the biggest 8-bit number).

## Bytes and bigger
- **8 bits = 1 byte** (one letter of text)
- **Kilobyte (KB)** ≈ a thousand bytes, **megabyte (MB)** ≈ a million, **gigabyte (GB)** ≈ a billion, **terabyte (TB)** ≈ a trillion

## Letters are numbers
In the **ASCII** code, "A" is **65**, "B" is 66, "a" is 97. Emoji use a bigger code called **Unicode**.

## Hexadecimal
Programmers write bytes in **hex** (base 16): 0–9 then A–F. 255 is **FF**. Web colors like **#FF0000** (red) are three hex bytes: red, green, blue.
🧪 lab: binary
? Binary 00000110 is … | *6 | 110 | 3
? How many bits are in a byte? | *8 | 10 | 2
? The biggest number 8 bits can hold is … | *255 | 256 | 100
? In hex, the number 255 is written … | *FF | 99 | ZZ

@ hw-components | 💻 Computer hardware | Electronic parts: resistors, LEDs, capacitors and more
These are the parts you'll use on a **breadboard** (a board with holes that connects parts without soldering — each short row of 5 holes is connected inside).

## The parts
- **Resistor** — limits current. Its value (in **ohms, Ω**) is shown by **color bands**: black 0, brown 1, red 2, orange 3, yellow 4, green 5, blue 6, violet 7, gray 8, white 9. The last band (gold = ±5%) is the tolerance. Brown-black-red = 1, 0, two zeros = **1,000 Ω (1 kΩ)**.
- **LED** (light-emitting diode) — lights up, but only one way: the **longer leg (anode, +)** goes toward positive. It **always needs a resistor** or it burns out.
- **Diode** — lets current flow only one direction (the stripe marks the minus side).
- **Capacitor** — stores a little charge, smooths out power. Big ones (electrolytic) have a **minus stripe** and can pop if put in backward.
- **Transistor** — an electronic **switch** (or amplifier): a tiny current on one leg controls a bigger current. A CPU has **billions** of them.
- **Push buttons, switches, potentiometers** (a knob that's a variable resistor).

## Reading a schematic
A **schematic** is a map of a circuit using symbols: a zig-zag for a resistor, a triangle with a line for a diode, arrows coming out for an LED, long and short lines for a battery.
? An LED's longer leg is the … | *anode (+), toward positive | minus side | it doesn't matter
? A resistor with bands brown, black, red is … | *1,000 Ω | 102 Ω | 10 Ω
? A transistor works like … | *an electronic switch | a battery | a speaker
? Why does an LED need a resistor? | *Without one, too much current burns it out | to make it blink | to change its color

@ hw-ohm | 💻 Computer hardware | Ohm's law on the breadboard: picking an LED resistor
**V = I × R** works for tiny circuits just like house wiring.

## Picking the resistor for an LED
An LED "uses up" a set voltage — its **forward voltage**: about **2 volts** for red, about **3 volts** for blue or white. Most small LEDs want about **10–20 milliamps** (0.010–0.020 amps).

**R = (supply volts − LED volts) ÷ amps**

Example: a 5-volt supply, a red LED (2 V), 15 mA:
(5 − 2) ÷ 0.015 = **200 Ω** → use the next bigger common size, **220 Ω**.

## Power in the resistor
P = V × I = 3 × 0.015 = 0.045 watts — a tiny ¼-watt resistor is plenty.

## Milli means thousandths
1 milliamp (mA) = 0.001 amp. 20 mA = 0.020 A.
🧪 lab: ohm
? With a 5 V supply and a 2 V red LED at 0.015 A, the resistor is about … | *200 Ω | 7 Ω | 5,000 Ω
? 20 milliamps is … | *0.020 amps | 20 amps | 2 amps
? Blue and white LEDs need about … volts | *3 | 0.5 | 12
? If the resistor is too small, the LED … | *gets too much current and burns out | gets dimmer | turns blue

@ hw-logic | 💻 Computer hardware | Logic gates: how a computer thinks
A computer is built from **logic gates** — tiny circuits made of transistors that take 1s and 0s in and give a 1 or 0 out.

## The main gates
- **AND** — 1 only if **both** inputs are 1 (both switches on to light the lamp)
- **OR** — 1 if **either** input is 1
- **NOT** — flips it: 1 becomes 0, 0 becomes 1
- **XOR** (exclusive or) — 1 if the inputs are **different**
- **NAND** — "not AND"; you can build **every** other gate from NAND gates alone!

## Truth tables
A truth table lists every input and the output. For AND: 0,0→0 · 0,1→0 · 1,0→0 · 1,1→1.

## Gates add numbers
An XOR and an AND together make a **half adder**: XOR gives the sum digit, AND gives the carry. Chain adders and you get the part of a CPU that does math (the **ALU**).
🧪 lab: gates
? An AND gate outputs 1 when … | *both inputs are 1 | either input is 1 | both inputs are 0
? NOT 1 is … | *0 | 1 | 2
? XOR outputs 1 when the inputs are … | *different | both 1 | both 0
? Which gate can be used to build all the others? | *NAND | OR | NOT

@ hw-solder | 💻 Computer hardware | Soldering electronics (safely)
Soldering joins parts to a circuit board with melted metal (**solder**).

## Tools
A temperature-controlled **soldering iron** (around **600–700°F**, 315–370°C), a stand, a damp sponge or brass wool to clean the tip, **solder** with flux inside (rosin core), **flush cutters**, tweezers, a **solder sucker** or wick to fix mistakes, and a **fume fan**.

## How to make a good joint
1. Clean and **tin** the tip (a little shiny solder on it).
2. Touch the tip to **both** the pad and the part's leg for 1–2 seconds to heat them.
3. Feed solder into the joint (not onto the iron). It flows around the leg.
4. Pull the solder away, then the iron. Don't move it while it cools.
5. A good joint is **shiny and shaped like a little volcano**. A dull blob is a **cold joint** — reheat it.
6. Snip the extra leg.

## Safety
- ⚠️ The iron is hot enough to burn instantly — always put it **back in the stand**. Never catch a falling iron.
- **Safety glasses**: snipped legs fly and solder can spit.
- Use a **fan or fume extractor** — flux smoke irritates your lungs.
- If the solder has **lead**, wash your hands after and never eat while soldering. **Lead-free** solder is safer (it melts a little hotter).
? A good solder joint looks … | *shiny, like a little volcano | dull and lumpy | black
? You heat … then feed in solder | *the pad and the leg together | only the solder | the plastic part
? If a soldering iron falls you should … | *let it fall — never catch it | catch it fast | grab the tip
? Why use a fume fan? | *Flux smoke irritates your lungs | to cool the iron | to blow away solder

@ hw-build | 💻 Computer hardware | Building a computer
## Before you start
- Check the parts fit: the **CPU socket** matches the motherboard, the RAM type (like DDR5) matches, and the **power supply** has enough watts.
- **ESD (static electricity)** can kill chips without you feeling a thing. Wear an **anti-static wrist strap** or touch bare metal on the case often. Work on a hard table, not carpet.
- Hold boards by the **edges**.

## The steps
1. Put the **CPU** in the socket on the motherboard (match the little triangle; no force — it drops in). Close the lever.
2. Put in the **RAM** sticks (check the manual for which slots) and the **NVMe SSD**.
3. Mount the **cooler** (thermal paste on the CPU if the cooler doesn't have it already).
4. Put the motherboard in the case on its **standoffs** (little posts so it doesn't touch the metal).
5. Mount the **power supply**; plug in the big 24-pin and the CPU 8-pin cables.
6. Install the **graphics card** if there is one and connect its power.
7. Front-panel wires (power button, USB), then **cable management** for airflow.
8. Power on: you should see the **BIOS/UEFI** screen. Then install the operating system from a USB stick.

## Never open a power supply
⚠️ Its capacitors can hold a **dangerous charge** even unplugged. If it's bad, replace the whole thing.
? ESD can damage parts … | *even when you don't feel a spark | only if you see sparks | never
? Motherboard standoffs keep the board from … | *touching the metal case | getting cold | moving the fan
? Why never open a power supply? | *Its capacitors can hold a dangerous charge unplugged | it voids the screws | it has no parts inside
? The first screen you see on a new build is the … | *BIOS/UEFI setup | the internet | a game

@ hw-troubleshoot | 💻 Computer hardware | The troubleshooting method (on the A+ test)
Techs don't guess — they follow steps. This is CompTIA's **6-step troubleshooting method**:

1. **Identify the problem** — ask the user questions, ask what changed, back up data if you can.
2. **Establish a theory** of what's wrong — **question the obvious** (is it plugged in?).
3. **Test the theory** — if wrong, make a new theory.
4. **Make a plan** and fix it.
5. **Verify** everything works, and prevent it happening again.
6. **Document** what you found and did.

## Common problems
- **Won't turn on at all**: power cable, power strip switch, the PSU switch on the back, the front-panel button wire.
- **Fans spin but no picture**: monitor cable in the graphics card (not the motherboard)? RAM seated? Listen for **beep codes** or look at the board's debug lights.
- **Slow**: too many programs at startup, a full drive, overheating (dust in the fans), or malware.
- **Random shutdowns**: overheating or a failing power supply.
? The first step of the troubleshooting method is … | *identify the problem | replace the motherboard | document
? "Question the obvious" means … | *check simple things first, like is it plugged in | ask a friend | read the box
? The last step is to … | *document what you found and did | throw it away | buy a new one
? A computer that shuts off randomly may be … | *overheating or have a bad power supply | out of ink | too clean
`;
