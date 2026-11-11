/** 🔬 10th grade science — mostly chemistry (format: ../mathLessonsParse.ts; the right choice is starred). */
export const S_10 = `
@ electron-config | 🧪 Chemistry | Electron shells and valence electrons
Electrons fill **shells**: 2 in the first, 8 in the second, 8 in the third (for the first 18 elements). The electrons in the outer shell are **valence electrons** — they decide how an atom bonds.

🧪 lab: atom
? Oxygen (8 electrons) has how many valence electrons? | *6 | 8 | 2
? Neon is unreactive because its outer shell is … | *full | empty
? Sodium (11 electrons) has how many valence electrons? | *1 | 11 | 8

@ periodic-trends | 🧪 Chemistry | Periodic trends
- **Atomic radius:** gets smaller → across a period, bigger ↓ down a group
- **Electronegativity:** increases → across, decreases ↓ down (fluorine is highest)
- **Reactivity:** alkali metals get more reactive going down
? The most electronegative element is … | *fluorine | francium
? Atoms get larger going … a group | *down | up
? Which is more reactive? | *potassium | lithium

@ ionic-bonds | 🧪 Chemistry | Ionic bonds
**Ionic bonds** form when a metal **gives** electrons to a nonmetal. The ions (+ and −) attract. Ionic compounds: high melting points, conduct electricity when dissolved.

- Na gives 1 electron to Cl → Na⁺ Cl⁻ (table salt)
? In NaCl, sodium becomes … | *Na⁺ | Na⁻
? Ionic bonds form between … | *metals and nonmetals | two nonmetals
? Salt water conducts electricity because it contains … | *ions | protons only

@ covalent-bonds | 🧪 Chemistry | Covalent bonds
**Covalent bonds** form when nonmetals **share** electrons. In water, oxygen shares electrons unequally with hydrogen, making a **polar** molecule.
? Covalent bonds involve … electrons | *sharing | giving away
? CO₂ and H₂O are held together by … bonds | *covalent | ionic
? A double bond shares … electrons | *4 | 2

@ naming | 🧪 Chemistry | Naming compounds
- Ionic: metal + nonmetal-**ide**: NaCl = sodium chlor**ide**, MgO = magnesium ox**ide**
- Covalent: prefixes: CO = carbon **mon**oxide, CO₂ = carbon **di**oxide, N₂O₅ = **di**nitrogen **pent**oxide
? CaCl₂ is … | *calcium chloride | calcium dichlorine
? CO₂ is … | *carbon dioxide | carbon oxide
? The prefix "tri-" means … | *3 | 2

@ mole | 🧪 Chemistry | The mole
A **mole** is **6.02 × 10²³** particles (Avogadro's number) — like a "dozen" for atoms. The **molar mass** (g/mol) comes from the periodic table: H₂O = 2(1) + 16 = **18 g/mol**.
? How many molecules are in 1 mole of water? | *6.02 × 10²³ | 18
? The molar mass of CO₂ (C = 12, O = 16) is … | *44 g/mol | 28 g/mol
? 36 g of water is … moles | *2 | 0.5

@ balancing-10 | 🧪 Chemistry | Balancing equations
Change only the **coefficients** (big numbers in front), never the subscripts. Count every element on both sides.

- CH₄ + 2O₂ → CO₂ + 2H₂O

🧪 lab: balance
? Balance: N₂ + _H₂ → 2NH₃ | *3 | 2 | 6
? Balance: _Fe + 3O₂ → 2Fe₂O₃ | *4 | 2 | 3
? When balancing, you may change … | *coefficients | subscripts

@ reaction-types | 🧪 Chemistry | Types of reactions
- **Synthesis:** A + B → AB
- **Decomposition:** AB → A + B
- **Single replacement:** A + BC → AC + B
- **Double replacement:** AB + CD → AD + CB
- **Combustion:** fuel + O₂ → CO₂ + H₂O
? 2H₂O → 2H₂ + O₂ is … | *decomposition | synthesis
? Burning propane is … | *combustion | decomposition
? Zn + 2HCl → ZnCl₂ + H₂ is … | *single replacement | synthesis

@ stoichiometry | 🧪 Chemistry | Stoichiometry
Use the **mole ratio** from the balanced equation.

- 2H₂ + O₂ → 2H₂O: 4 mol H₂ makes **4 mol** H₂O and needs **2 mol** O₂.
? In 2H₂ + O₂ → 2H₂O, 6 mol of H₂ needs … mol of O₂ | *3 | 6 | 12
? N₂ + 3H₂ → 2NH₃: 2 mol N₂ makes … mol NH₃ | *4 | 2 | 6
? Stoichiometry is based on the … | *mole ratio | color of products

@ limiting-reactant | 🧪 Chemistry | Limiting reactant
The **limiting reactant** runs out first and decides how much product forms; the other is **in excess**.
Like sandwiches: 10 slices of bread and 3 slices of cheese make only **3** sandwiches — cheese is limiting.
? 2H₂ + O₂ → 2H₂O with 4 mol H₂ and 5 mol O₂. Limiting? | *H₂ | O₂
? Same — how much water forms? | *4 mol | 5 mol | 10 mol
? The reactant left over is … | *in excess | limiting

@ ideal-gas | 🧪 Chemistry | The ideal gas law
**PV = nRT** (R = 8.314 J/(mol·K)). Temperature must be in **kelvin** (K = °C + 273).

🧪 lab: gas
? 27°C in kelvin is … | *300 K | 27 K
? At constant n and T, if V doubles, P … | *halves | doubles
? At constant V, doubling the kelvin temperature makes P … | *double | half

@ molarity | 🧪 Chemistry | Concentration: molarity
**Molarity (M) = moles of solute ÷ liters of solution.** 2 mol of salt in 1 L → **2 M**. A **saturated** solution holds as much as it can at that temperature.

🧪 lab: dissolve
? 0.5 mol in 0.25 L is … | *2 M | 0.125 M
? To dilute a solution you add more … | *solvent | solute
? A solution that can still dissolve more is … | *unsaturated | saturated

@ ph-math | 🧪 Chemistry | pH and the log scale
**pH = −log[H⁺].** Each pH step is **10×**: pH 3 is **10 times** more acidic than pH 4 and 100 times more than pH 5. **pH + pOH = 14.**

🧪 lab: ph
? pH 2 is how many times more acidic than pH 4? | *100 | 2 | 20
? [H⁺] = 10⁻⁵ M means pH … | *5 | −5 | 9
? A solution with pOH 3 has pH … | *11 | 3 | 17

@ enthalpy | 🧪 Chemistry | Energy in reactions
Breaking bonds **takes** energy; making bonds **releases** it. **ΔH < 0** → exothermic (releases heat). **ΔH > 0** → endothermic. A **catalyst** lowers the **activation energy**.
? A reaction with ΔH = −890 kJ is … | *exothermic | endothermic
? Breaking a bond … energy | *absorbs | releases
? A catalyst lowers the … | *activation energy | ΔH

@ equilibrium | 🧪 Chemistry | Equilibrium and Le Chatelier
At **equilibrium**, forward and reverse reactions run at the **same rate**. **Le Chatelier:** if you disturb it, the system shifts to **undo** the change.
? Adding more reactant shifts equilibrium toward … | *products | reactants
? At equilibrium, the forward and reverse rates are … | *equal | zero
? Removing product shifts equilibrium … | *toward products | toward reactants

@ nuclear | 🧪 Chemistry | Nuclear chemistry
- **Alpha** (helium nucleus), **beta** (electron), **gamma** (energy) radiation
- **Half-life:** time for half a sample to decay. After 3 half-lives, **1/8** remains.
- **Fission** splits nuclei (power plants); **fusion** joins them (the Sun).
? After 2 half-lives, what fraction remains? | *1/4 | 1/2 | 1/8
? The Sun is powered by … | *fusion | fission
? Which radiation is a helium nucleus? | *alpha | gamma

@ emission-spectra | 🧪 Chemistry | Emission spectra
Electrons absorb energy and jump to higher levels; when they fall back they emit light of exact **wavelengths**. Each element has a unique **line spectrum**, used in fireworks and to identify stars.

🧪 lab: flame
? Strontium in fireworks makes … | *red | green
? Emitted light comes from electrons … | *falling to lower energy levels | leaving the nucleus
? An element's line spectrum is … | *unique | the same for all elements

@ heating-curve | ⚡ Physics | Heating curves and phase changes
On a heating curve, temperature **stays flat** during melting and boiling — the energy goes into breaking attractions between particles, not speeding them up.

🧪 lab: states
? While ice is melting, its temperature … | *stays at 0°C | rises steadily
? Energy during boiling goes into … | *separating particles | speeding them up
? Steam at 100°C can burn worse than water at 100°C because it … | *releases extra energy when it condenses | is hotter

@ ocean-acidification | 🌍 Earth & space | Ocean acidification
Oceans absorb CO₂ from the air. CO₂ + H₂O → carbonic acid, so the ocean's pH **drops**. This makes it harder for corals and shellfish to build **calcium carbonate** shells.
? Ocean acidification is caused by absorbing … | *carbon dioxide | oxygen
? Lower ocean pH harms … | *shell-building animals | sharks only
? As the ocean absorbs more CO₂, its pH … | *goes down | goes up

@ biochem-10 | 🧬 Biology | Chemistry in living things
Living things are mostly **C, H, O, N, P and S**. Carbon forms **4 bonds**, so it can build long chains and rings — the backbone of sugars, fats, proteins and DNA.
? Carbon can form how many bonds? | *4 | 2 | 1
? Proteins are made mostly of C, H, O and … | *N | Fe
? The element in DNA's backbone that's rare in sugars is … | *phosphorus | carbon
`;
