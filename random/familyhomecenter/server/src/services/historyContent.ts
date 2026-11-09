import type { LessonSeed, QuizItem } from './lessonContent.js';

/**
 * 🇺🇸 US History: the starting curriculum. A parent can change any of it in the app (📚 Learning →
 * 🇺🇸 US History → ✏️ Edit): what's read and what's quizzed. Each lesson's grade is the top of the
 * grades it's written for — K–2 → 2nd, 3–5 → 5th, 6–8 → 8th, 9–10 → 10th, 11–12 → 12th — so every
 * kid in that range can earn tokens from it. Higher grades go into more detail, piece by piece.
 */
const Q = (q: string, choices: string[], answer: number, why?: string): QuizItem => ({ q, choices, answer, why });
const H = (id: string, grade: number, topic: string, title: string, body: string, quiz: QuizItem[]): LessonSeed => ({ id: `h-${id}`, subject: 'history', grade, topic, title, body, quiz });

const DEC = '📜 Declaration of Independence';
const CON = '🏛️ The Constitution';
const REV = '🥁 Revolutionary War';
const CIV = '⚔️ Civil War';
const WW1 = '🪖 World War I';
const WW2 = '✈️ World War II';

export const HISTORY_LESSONS: LessonSeed[] = [
  // ======================= K–2 =======================
  H('k2-dec', 2, DEC, 'Our country’s birthday', `Long ago, America was **13 colonies** ruled by the **King of England**. Many people felt the king's rules were not fair.

Leaders from the colonies met in **Philadelphia**. **Thomas Jefferson** wrote a letter telling the king that the colonies would now be a free country. It is called the **Declaration of Independence**.

It was approved on **July 4, 1776**. That's why we celebrate the **Fourth of July** — America's birthday — with fireworks and parades!

It says that **all people are created equal** and have the right to **life, liberty** (being free) **and the pursuit of happiness**.`, [
    Q('What holiday is America’s birthday?', ['Thanksgiving', 'The Fourth of July', 'New Year’s Day'], 1),
    Q('Who wrote most of the Declaration of Independence?', ['Thomas Jefferson', 'Abraham Lincoln', 'George Washington'], 0),
    Q('How many colonies were there?', ['13', '50', '5'], 0),
  ]),
  H('k2-con', 2, CON, 'The rules for our country', `After America became free, it needed **rules** for how the country would work. In **1787**, leaders met in Philadelphia and wrote the **Constitution**.

It starts with the words **"We the People"** — because in America, the people are in charge.

The Constitution says we have:
- a **President** who leads the country,
- **Congress**, who make the laws,
- **judges and courts**, who decide what the laws mean.

**George Washington** led the meeting and later became our **first President**.`, [
    Q('What are the first three words of the Constitution?', ['We the People', 'Once upon a', 'Hear ye, hear'], 0),
    Q('Who was the first President?', ['George Washington', 'Thomas Jefferson', 'Benjamin Franklin'], 0),
    Q('Who makes the laws?', ['the President', 'Congress', 'the King'], 1),
  ]),
  H('k2-rev', 2, REV, 'The fight to be free', `The colonies and England had a war called the **Revolutionary War**. It started in **1775**.

- The American soldiers were led by **George Washington**.
- Before the first battle, **Paul Revere** rode his horse at night to warn, **"The British are coming!"**
- The Americans won, and the **United States** became its own country.`, [
    Q('Who led the American soldiers?', ['George Washington', 'Paul Revere', 'the King'], 0),
    Q('Who rode at night to warn people?', ['Paul Revere', 'Thomas Jefferson', 'Abraham Lincoln'], 0),
    Q('Who won the war?', ['England', 'the Americans'], 1),
  ]),
  H('k2-civ', 2, CIV, 'When the country split in two', `About 160 years ago, the **North** and the **South** of our country fought a war called the **Civil War** (1861–1865).

A big reason was **slavery** — some people were owned by others and forced to work. Many people in the North wanted slavery to end.

**Abraham Lincoln** was President. He worked to keep the country together and to **end slavery**. The North won, the country stayed together, and slavery ended.

**Harriet Tubman** was a brave woman who helped many enslaved people escape to freedom.`, [
    Q('Who was President during the Civil War?', ['George Washington', 'Abraham Lincoln', 'Thomas Jefferson'], 1),
    Q('The Civil War was between …', ['the North and the South', 'America and England', 'the East and the West'], 0),
    Q('Who helped many enslaved people escape?', ['Harriet Tubman', 'Paul Revere', 'Betsy Ross'], 0),
  ]),
  H('k2-wars', 2, WW2, 'The two World Wars', `In the 1900s there were two very big wars, called **World Wars** because many countries around the world fought in them.

- **World War I** ended on **November 11, 1918**. We remember everyone who served in the military on **Veterans Day**, November 11.
- In **World War II**, America joined after Japan attacked **Pearl Harbor** in Hawaii in **1941**. Many soldiers, sailors and pilots served, and people at home helped too — saving food and working in factories. It ended in **1945**.`, [
    Q('What day do we honor people who served in the military?', ['Veterans Day', 'Valentine’s Day', 'Earth Day'], 0),
    Q('Where was Pearl Harbor?', ['Hawaii', 'Texas', 'Alaska'], 0),
    Q('Why are they called World Wars?', ['many countries fought', 'they were short', 'only America fought'], 0),
  ]),

  // ======================= 3–5 =======================
  H('35-dec', 5, DEC, 'The Declaration of Independence', `By 1776, many colonists were angry at **King George III** and Britain's **Parliament**, which taxed them without letting them vote ("**no taxation without representation**").

The **Second Continental Congress** met in **Philadelphia**. A team of five — including **Thomas Jefferson**, **John Adams** and **Benjamin Franklin** — was chosen to write a declaration. Jefferson wrote the first draft.

Congress approved it on **July 4, 1776**. **John Hancock** signed first, with a big signature. **56** men signed it in all.

## What it says
- **All men are created equal** and have rights that can't be taken away: **life, liberty and the pursuit of happiness**.
- Governments get their power from the **people**.
- A long **list of complaints** against the king.
- The colonies are now **free and independent states**.`, [
    Q('What year was the Declaration approved?', ['1776', '1787', '1492'], 0),
    Q('Who wrote the first draft?', ['John Hancock', 'Thomas Jefferson', 'George Washington'], 1),
    Q('Whose signature is famously the biggest?', ['John Hancock', 'Benjamin Franklin', 'John Adams'], 0),
    Q('Where do governments get their power, according to the Declaration?', ['from the king', 'from the people', 'from the army'], 1),
    Q('"No taxation without representation" means …', ['no taxes ever', 'no taxes unless we get a vote', 'only the king pays taxes'], 1),
  ]),
  H('35-con', 5, CON, 'The Constitution and the three branches', `The first plan for the new country, the **Articles of Confederation**, made the national government too weak. So in **1787**, leaders met in Philadelphia at the **Constitutional Convention** and wrote the **Constitution**. **James Madison** did so much of the work he's called the **"Father of the Constitution."**

The Constitution splits power into **three branches**, so no one has too much:
- **Legislative** — **Congress** (the Senate and the House of Representatives) makes laws.
- **Executive** — the **President** carries out the laws.
- **Judicial** — the **Supreme Court** and other courts decide what laws mean.

Each branch can check the others — this is called **checks and balances**. For example, the President can **veto** (say no to) a law.

The first ten changes, called **amendments**, are the **Bill of Rights**. They protect freedoms like **speech** and **religion**.`, [
    Q('Which branch makes laws?', ['Executive', 'Legislative', 'Judicial'], 1),
    Q('Who is called the "Father of the Constitution"?', ['James Madison', 'Thomas Jefferson', 'John Hancock'], 0),
    Q('What are the first ten amendments called?', ['the Preamble', 'the Bill of Rights', 'the Articles'], 1),
    Q('The two parts of Congress are …', ['the Senate and the House of Representatives', 'the President and the Vice President', 'the Supreme Court and the jury'], 0),
    Q('Why have checks and balances?', ['so no branch gets too much power', 'to make laws faster', 'to choose the king'], 0),
  ]),
  H('35-rev', 5, REV, 'The Revolutionary War', `After the **French and Indian War**, Britain taxed the colonies to pay its debts — the **Stamp Act** (1765) and a tax on tea. In **1773**, colonists dumped British tea into the harbor: the **Boston Tea Party**.

## Key events
- **April 19, 1775** — the first shots at **Lexington and Concord**. Paul Revere and others warned that British soldiers were coming.
- **George Washington** led the **Continental Army**.
- **Christmas night, 1776** — Washington **crossed the Delaware River** and surprised enemy soldiers at **Trenton**.
- **1777** — the American win at **Saratoga** convinced **France** to help America.
- **Winter 1777–78** — a cold, hungry winter at **Valley Forge**, where the army trained hard.
- **1781** — the British general **Cornwallis** surrendered at **Yorktown**.
- **1783** — the **Treaty of Paris** made peace; Britain recognized American independence.

Colonists who wanted independence were **Patriots**; those loyal to the king were **Loyalists**.`, [
    Q('Where were the first shots fired?', ['Yorktown', 'Lexington and Concord', 'Gettysburg'], 1),
    Q('Which country helped America after Saratoga?', ['France', 'Spain', 'Germany'], 0),
    Q('Where did the army spend a hard winter?', ['Valley Forge', 'Boston', 'Pearl Harbor'], 0),
    Q('Where did Cornwallis surrender?', ['Trenton', 'Yorktown', 'Saratoga'], 1),
    Q('Colonists loyal to the king were called …', ['Patriots', 'Loyalists', 'Minutemen'], 1),
  ]),
  H('35-civ', 5, CIV, 'The Civil War', `The **Civil War** (1861–1865) was fought between the **Union** (the North) and the **Confederacy** (11 Southern states that left the country).

## Why
The biggest issue was **slavery** — whether it would be allowed to spread to new states in the West. After **Abraham Lincoln** was elected President in 1860, Southern states began to **secede** (leave).

## Key events
- **April 1861** — the war began at **Fort Sumter** in South Carolina.
- **1863** — Lincoln's **Emancipation Proclamation** declared enslaved people in the rebelling states free.
- **July 1863** — the Union won the huge **Battle of Gettysburg**. Later Lincoln gave the short, famous **Gettysburg Address**.
- **April 1865** — Confederate General **Robert E. Lee** surrendered to Union General **Ulysses S. Grant** at **Appomattox Court House**.
- Days later, **Lincoln was assassinated**.

In **1865** the **13th Amendment** ended slavery in the whole country.`, [
    Q('The North was called the …', ['Confederacy', 'Union', 'Colonies'], 1),
    Q('Where did the war begin?', ['Fort Sumter', 'Gettysburg', 'Boston'], 0),
    Q('What did the Emancipation Proclamation do?', ['ended the war', 'declared enslaved people in rebelling states free', 'made Lincoln President'], 1),
    Q('Who surrendered at Appomattox?', ['Ulysses S. Grant', 'Robert E. Lee', 'Abraham Lincoln'], 1),
    Q('Which amendment ended slavery?', ['1st', '13th', '19th'], 1),
  ]),
  H('35-ww1', 5, WW1, 'World War I', `**World War I** lasted from **1914 to 1918**. It started in Europe after **Archduke Franz Ferdinand** of Austria-Hungary was killed.

Two sides fought:
- the **Allies** — including **Britain, France and Russia**, and later the **United States**
- the **Central Powers** — including **Germany** and **Austria-Hungary**

Soldiers fought from long ditches called **trenches**. New weapons like **tanks**, **airplanes** and **submarines** were used for the first time in a big war.

America stayed out at first. After German submarines sank ships carrying Americans, the US **joined in 1917**, under **President Woodrow Wilson**.

The fighting stopped on **November 11, 1918** — first called **Armistice Day**, now **Veterans Day**.`, [
    Q('When did World War I end?', ['1918', '1945', '1865'], 0),
    Q('Soldiers fought from long ditches called …', ['trenches', 'forts', 'tunnels'], 0),
    Q('Who was the US President?', ['Woodrow Wilson', 'Abraham Lincoln', 'Franklin D. Roosevelt'], 0),
    Q('Which side did the US join?', ['the Allies', 'the Central Powers'], 0),
    Q('November 11 is now called …', ['Memorial Day', 'Veterans Day', 'Labor Day'], 1),
  ]),
  H('35-ww2', 5, WW2, 'World War II', `**World War II** lasted from **1939 to 1945** — the biggest war in history.

- The **Axis**: **Germany** (led by **Adolf Hitler**), **Italy** and **Japan**.
- The **Allies**: including **Britain**, the **Soviet Union**, **China** and the **United States**.

On **December 7, 1941**, Japan attacked the US Navy at **Pearl Harbor**, Hawaii. The next day the US entered the war. **Franklin D. Roosevelt** was President.

At home, families **rationed** food and gas, bought **war bonds**, and millions of women worked in factories (**"Rosie the Riveter"**).

On **D-Day, June 6, 1944**, Allied soldiers landed on the beaches of **Normandy**, France. Germany surrendered in **May 1945**, and Japan in **August–September 1945**.

During the war, the Nazis murdered six million Jewish people and millions of others. This is called the **Holocaust**.`, [
    Q('What happened on December 7, 1941?', ['D-Day', 'the attack on Pearl Harbor', 'the war ended'], 1),
    Q('Who was the US President when America entered the war?', ['Franklin D. Roosevelt', 'George Washington', 'Woodrow Wilson'], 0),
    Q('On D-Day, Allied soldiers landed in …', ['Normandy, France', 'Hawaii', 'England'], 0),
    Q('"Rosie the Riveter" stands for …', ['women working in factories', 'a famous general', 'a battleship'], 0),
    Q('Which country was on the Axis side?', ['Britain', 'Germany', 'China'], 1),
  ]),

  // ======================= 6–8 =======================
  H('68-dec', 8, DEC, 'Inside the Declaration: its five parts', `The Declaration of Independence has five parts.

## 1. Introduction
When a people must break from another, "a decent respect to the opinions of mankind" requires them to explain **why**.

## 2. The preamble (the big ideas)
"We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain **unalienable Rights**, that among these are **Life, Liberty and the pursuit of Happiness**."
- Governments are created to protect these rights, and get their **"just powers from the consent of the governed."**
- When a government destroys these rights, the people may **alter or abolish** it.

## 3. The grievances
A list of **27 complaints** against King George III — for example, taxes without consent, keeping soldiers in the colonies in peacetime, cutting off trade, and taking away trial by jury.

## 4. Earlier warnings
The colonists had asked Britain for fairness many times and been ignored.

## 5. The conclusion
The colonies "are, and of Right ought to be **Free and Independent States**." The signers pledged their "Lives, our Fortunes and our sacred Honor."

Congress actually voted for independence on **July 2, 1776** (the **Lee Resolution**) and approved the Declaration's wording on **July 4**.`, [
    Q('"Unalienable" rights are rights that …', ['the king gives', 'cannot be taken away', 'only adults have'], 1),
    Q('Governments get their just powers from …', ['the consent of the governed', 'the king', 'the army'], 0),
    Q('How many grievances are listed against the king?', ['10', '27', '56'], 1),
    Q('On what date did Congress vote for independence?', ['July 2, 1776', 'July 4, 1776', 'September 17, 1787'], 0),
    Q('What did the signers pledge?', ['their land and slaves', 'their Lives, Fortunes and sacred Honor', 'to obey the king'], 1),
  ]),
  H('68-con-articles', 8, CON, 'The Preamble and the seven Articles', `## The Preamble
"We the People of the United States, in Order to form a more perfect **Union**, establish **Justice**, insure domestic **Tranquility**, provide for the common **defence**, promote the general **Welfare**, and secure the Blessings of **Liberty** to ourselves and our Posterity, do ordain and establish this Constitution for the United States of America."

## The seven Articles
- **I** — the **Legislative** branch: **Congress** (House and Senate) and its powers.
- **II** — the **Executive** branch: the **President**.
- **III** — the **Judicial** branch: the **Supreme Court**.
- **IV** — the **states**: how they treat each other, and adding new states.
- **V** — how to **amend** (change) the Constitution.
- **VI** — the Constitution is the **"supreme Law of the Land."**
- **VII** — **ratification**: it took effect once **9 of the 13** states approved.

It was signed on **September 17, 1787** (now **Constitution Day**) and took effect in **1788–1789**.

## The Great Compromise
Big states wanted seats in Congress by population; small states wanted equal seats. The compromise: the **House** by **population**, the **Senate** with **two senators per state**.`, [
    Q('Which Article creates the presidency?', ['Article I', 'Article II', 'Article III'], 1),
    Q('Which Article explains how to amend the Constitution?', ['Article IV', 'Article V', 'Article VII'], 1),
    Q('How many states had to ratify it?', ['9', '13', '7'], 0),
    Q('In the Great Compromise, the Senate has …', ['seats by population', 'two senators per state', 'one senator per state'], 1),
    Q('"Supreme Law of the Land" is in …', ['Article VI', 'the Preamble', 'Article II'], 0),
  ]),
  H('68-con-rights', 8, CON, 'The Bill of Rights', `Many people would only support the Constitution if it protected individual rights. So the first **10 amendments** — the **Bill of Rights** — were added in **1791**. James Madison wrote them.

1. Freedom of **religion, speech, the press, assembly** and to **petition** the government
2. The right to **keep and bear arms**
3. No **soldiers housed** in people's homes in peacetime without consent
4. No **unreasonable searches and seizures**; warrants need probable cause
5. Rights of the accused: no **double jeopardy**, no being forced to **testify against yourself**, **due process** of law
6. A **speedy, public trial** by jury, with a **lawyer**
7. **Jury trials** in many civil (non-criminal) cases
8. No **excessive bail** or **cruel and unusual punishment**
9. People have **other rights** too, even if they aren't listed
10. Powers not given to the national government belong to the **states or the people**`, [
    Q('Which amendment protects freedom of speech?', ['1st', '2nd', '5th'], 0),
    Q('The 4th Amendment protects against …', ['unreasonable searches and seizures', 'cruel punishment', 'soldiers in your home'], 0),
    Q('"Pleading the Fifth" means using the right to …', ['a lawyer', 'not testify against yourself', 'a speedy trial'], 1),
    Q('The right to a lawyer and a speedy trial is in the …', ['3rd', '6th', '10th'], 1),
    Q('The 10th Amendment gives powers not given to the national government to …', ['the President', 'the states or the people', 'the Supreme Court'], 1),
  ]),
  H('68-rev', 8, REV, 'The road to revolution, and how the war was won', `## Causes
- **1763** — Britain wins the **French and Indian War** but is deep in debt, and bans settlement west of the Appalachians (**Proclamation of 1763**).
- **1765** — the **Stamp Act** taxes printed paper. Colonists protest and boycott; it's repealed.
- **1767** — the **Townshend Acts** tax glass, paint, paper and tea.
- **1770** — the **Boston Massacre**: British soldiers kill five colonists.
- **1773** — the **Boston Tea Party** protests the Tea Act.
- **1774** — the **Intolerable Acts** punish Boston; the **First Continental Congress** meets.

## The war (1775–1783)
- **Lexington and Concord** (April 1775) — "the shot heard round the world."
- **Bunker Hill** (June 1775) — a costly British victory that showed colonists could fight.
- **Common Sense** (January 1776) — Thomas Paine's pamphlet persuades many to want independence.
- **Trenton** (December 1776) — after crossing the Delaware, a morale-saving win.
- **Saratoga** (1777) — the **turning point**: France signs an **alliance** in 1778.
- **Valley Forge** — Baron **von Steuben** drills the army into a stronger force.
- **Yorktown** (1781) — American and French troops, with the French navy blocking escape, force **Cornwallis** to surrender.
- **Treaty of Paris** (1783) — independence recognized; the border moves west to the Mississippi River.`, [
    Q('Why did Britain start taxing the colonies?', ['to pay war debts', 'to build roads', 'to fund the colonies’ schools'], 0),
    Q('Which battle is called the turning point?', ['Bunker Hill', 'Saratoga', 'Trenton'], 1),
    Q('Who wrote "Common Sense"?', ['Thomas Paine', 'John Adams', 'Paul Revere'], 0),
    Q('What helped trap Cornwallis at Yorktown?', ['the French navy', 'a snowstorm', 'the Spanish army'], 0),
    Q('The Boston Massacre happened in …', ['1765', '1770', '1776'], 1),
  ]),
  H('68-civ', 8, CIV, 'The Civil War: causes, turning points and results', `## Causes
The North and South argued for decades about **slavery** spreading into new western territories.
- **Missouri Compromise** (1820), **Compromise of 1850** (with a harsh **Fugitive Slave Act**)
- **Kansas-Nebraska Act** (1854) lets settlers vote on slavery → violence in "Bleeding Kansas"
- **Dred Scott decision** (1857) — the Supreme Court says enslaved people aren't citizens
- **Lincoln's election** (1860) → South Carolina **secedes**; 11 states form the **Confederate States of America** under **Jefferson Davis**

## Turning points
- **Antietam** (September 1862) — the bloodiest single day in American history; afterwards Lincoln announces the **Emancipation Proclamation** (in effect **January 1, 1863**). Black men can join the Union army — about **180,000** serve.
- **Gettysburg** (July 1–3, 1863) — Lee's invasion of the North fails.
- **Vicksburg** (July 4, 1863) — the Union controls the **Mississippi River**, splitting the Confederacy.
- **Sherman's March to the Sea** (1864) destroys Southern supplies.

## Results
- **Appomattox**, April 9, 1865 — Lee surrenders to Grant.
- About **620,000** or more soldiers died — more than in any other American war.
- **Reconstruction** (1865–1877) and three amendments: the **13th** (ends slavery), **14th** (citizenship and equal protection), **15th** (voting regardless of race).`, [
    Q('What was the bloodiest single day in American history?', ['Gettysburg', 'Antietam', 'Fort Sumter'], 1),
    Q('Why was Vicksburg important?', ['Union control of the Mississippi River', 'it was the Confederate capital', 'Lincoln spoke there'], 0),
    Q('Who was President of the Confederacy?', ['Robert E. Lee', 'Jefferson Davis', 'Stonewall Jackson'], 1),
    Q('The 14th Amendment guarantees …', ['citizenship and equal protection', 'women’s right to vote', 'freedom of speech'], 0),
    Q('The Dred Scott decision said enslaved people …', ['were free', 'were not citizens', 'could vote'], 1),
  ]),
  H('68-ww1', 8, WW1, 'World War I and America', `## Causes — remember **MAIN**
- **M**ilitarism — countries built huge armies
- **A**lliances — promises to defend each other pulled many countries in
- **I**mperialism — competition for colonies
- **N**ationalism — strong pride, and groups wanting their own nations

The spark: **Archduke Franz Ferdinand** was assassinated in **Sarajevo** on **June 28, 1914**.

## America joins
President **Woodrow Wilson** kept the US **neutral** at first.
- **1915** — a German submarine sank the passenger ship **Lusitania**; 128 Americans died.
- **1917** — Germany restarted **unrestricted submarine warfare**, and the **Zimmermann Telegram** revealed Germany asking **Mexico** to fight the US.
- **April 6, 1917** — the US declared war. General **John J. Pershing** led the American forces.

## The end
- The **armistice** began at 11 a.m. on **November 11, 1918**.
- The **Treaty of Versailles** (1919) punished Germany. Wilson's **Fourteen Points** proposed a **League of Nations**, but the US Senate voted not to join.`, [
    Q('What does the A in MAIN stand for?', ['Armies', 'Alliances', 'America'], 1),
    Q('What did the Zimmermann Telegram ask?', ['for Mexico to fight the US', 'for peace talks', 'for Britain to surrender'], 0),
    Q('Which ship’s sinking angered Americans in 1915?', ['Titanic', 'Lusitania', 'Maine'], 1),
    Q('Who led the American forces in Europe?', ['John J. Pershing', 'Dwight D. Eisenhower', 'Ulysses S. Grant'], 0),
    Q('Did the US join the League of Nations?', ['Yes', 'No'], 1),
  ]),
  H('68-ww2', 8, WW2, 'World War II: Europe, the Pacific and the home front', `## How it started
After WWI, **Adolf Hitler** and the **Nazi** party took power in Germany. Germany invaded **Poland** on **September 1, 1939**, and Britain and France declared war.

## America enters
- The US first sent supplies to the Allies (**Lend-Lease**).
- **December 7, 1941** — Japan attacked **Pearl Harbor**. President **Franklin D. Roosevelt** called it "a date which will live in infamy." The US declared war the next day.

## In Europe
- **D-Day**, **June 6, 1944** — the largest seaborne invasion in history, at **Normandy**, led by General **Dwight D. Eisenhower**.
- **Battle of the Bulge** (winter 1944–45) — Germany's last big attack.
- **V-E Day**, **May 8, 1945** — victory in Europe.

## In the Pacific
- **Midway** (June 1942) — the turning point in the Pacific.
- **"Island hopping"** toward Japan; **Iwo Jima** and **Okinawa** (1945).
- In August 1945 the US dropped **atomic bombs** on **Hiroshima** and **Nagasaki**. Japan surrendered; the formal surrender was **September 2, 1945**.

## At home
**Rationing**, war bonds, and women and Black Americans taking factory jobs. Unfairly, about **120,000 Japanese Americans** were forced into **incarceration camps**. The **Tuskegee Airmen** (Black pilots) and **Navajo Code Talkers** served with honor.`, [
    Q('What event started the war in Europe?', ['Pearl Harbor', 'Germany invading Poland', 'D-Day'], 1),
    Q('Who commanded the D-Day invasion?', ['Dwight D. Eisenhower', 'George Patton', 'Douglas MacArthur'], 0),
    Q('Which battle was the turning point in the Pacific?', ['Midway', 'Iwo Jima', 'the Bulge'], 0),
    Q('What does V-E Day mark?', ['victory in Europe', 'victory over Japan', 'the D-Day landing'], 0),
    Q('Who were the Navajo Code Talkers?', ['Marines who sent messages in an unbreakable code', 'British spies', 'factory workers'], 0),
  ]),

  // ======================= 9–10 =======================
  H('910-dec-ideas', 10, DEC, 'The ideas behind the Declaration', `The Declaration drew on **Enlightenment** thinkers, especially **John Locke**, who wrote that people have **natural rights** to life, liberty and property, and that governments are a **social contract**: people agree to be governed in exchange for protection of their rights.

Jefferson changed Locke's "property" to **"the pursuit of Happiness."**

## The argument, step by step
1. People have natural, **unalienable** rights.
2. Governments exist to **secure** those rights.
3. A government's power comes from the **consent of the governed**.
4. When a government becomes destructive of these ends, the people may **alter or abolish** it — not "for light and transient causes," but after "a long train of abuses."
5. King George III has committed such abuses (the grievances).
6. So the colonies are free and independent.

## A promise not kept for all
"All men are created equal" was written while about one in five people in the colonies was **enslaved**, and women and Native Americans were left out. Jefferson's draft attacked the slave trade, but Congress removed it. Later movements — **abolitionists**, the **Seneca Falls** women's rights convention (1848), and **Martin Luther King Jr.** — called on the nation to live up to these words.`, [
    Q('Which thinker most influenced the Declaration?', ['John Locke', 'Karl Marx', 'Isaac Newton'], 0),
    Q('In Jefferson’s version, "property" became …', ['liberty', 'the pursuit of Happiness', 'equality'], 1),
    Q('The idea that people agree to be governed for protection of their rights is the …', ['social contract', 'divine right of kings', 'separation of powers'], 0),
    Q('What did Congress remove from Jefferson’s draft?', ['an attack on the slave trade', 'the list of grievances', 'the word "equal"'], 0),
    Q('The Declaration says governments shouldn’t be changed for …', ['light and transient causes', 'any reason', 'religious reasons'], 0),
  ]),
  H('910-rev', 10, REV, 'Strategy and alliances in the Revolution', `Britain had the world's strongest navy and a professional army. How did the colonies win?

## American advantages
- Fighting on **home ground**; Britain had to ship troops and supplies 3,000 miles.
- **Washington's strategy**: keep the army alive and avoid one decisive loss — a war of endurance.
- **Foreign help**: **France** (money, troops under **Rochambeau**, the fleet of **de Grasse**), **Spain** and the **Netherlands**. The **Marquis de Lafayette** became Washington's trusted general.
- Belief in the cause — and Britain's growing war-weariness.

## British strategy
- **1776–77**: capture cities and cut off New England (the plan failed at **Saratoga**, where General **Burgoyne** surrendered).
- **1778–81**: the **Southern strategy**, hoping Loyalists would rise up. Victories at Charleston were followed by American wins at **Cowpens** and costly battles like **Guilford Courthouse**, which pushed Cornwallis to **Yorktown**.

## Many Americans
About a third of colonists were Patriots, a third Loyalists, and the rest neutral. Thousands of **Black Americans** fought — on both sides, often for the promise of freedom. Many **Native American** nations sided with Britain, hoping to stop settlers moving west.`, [
    Q('Who surrendered at Saratoga?', ['Cornwallis', 'Burgoyne', 'Howe'], 1),
    Q('Washington’s main strategy was to …', ['win one big battle quickly', 'keep the army alive and outlast Britain', 'invade Britain'], 1),
    Q('Who commanded the French fleet at Yorktown?', ['de Grasse', 'Lafayette', 'Rochambeau'], 0),
    Q('Britain’s Southern strategy hoped that …', ['Loyalists would rise up', 'France would stay out', 'the navy would be unneeded'], 0),
    Q('Why did many Native nations side with Britain?', ['to stop settlers moving west', 'they were paid in tea', 'Britain promised them Boston'], 0),
  ]),
  H('910-civ', 10, CIV, 'Reconstruction (1865–1877)', `After the war, the nation had to rebuild the South and decide what freedom would mean for about **4 million** formerly enslaved people.

## Plans
- **Lincoln** wanted lenient terms ("with malice toward none"). After his assassination, **Andrew Johnson** let Southern states pass **Black Codes** restricting freed people.
- **Radical Republicans** in Congress took over Reconstruction, put the South under military districts, and impeached Johnson (he was acquitted by one vote).

## Gains
- **13th Amendment** (1865) — abolished slavery.
- **14th Amendment** (1868) — citizenship for all born here; **equal protection of the laws**; **due process**.
- **15th Amendment** (1870) — the vote can't be denied because of race.
- The **Freedmen's Bureau** built schools; Black Americans were elected to Congress for the first time, like Senator **Hiram Revels**.

## Ending
Violence by groups like the **Ku Klux Klan**, and Northern loss of interest, weakened Reconstruction. The **Compromise of 1877** removed the last federal troops. Southern states then passed **Jim Crow** laws, poll taxes and literacy tests, denying many Black citizens their rights until the **civil rights movement** of the 1950s–60s.`, [
    Q('What did Black Codes do?', ['restricted freed people', 'freed enslaved people', 'built schools'], 0),
    Q('Which amendment guarantees equal protection of the laws?', ['13th', '14th', '15th'], 1),
    Q('What ended Reconstruction?', ['the Compromise of 1877', 'Lincoln’s death', 'the 15th Amendment'], 0),
    Q('Hiram Revels was …', ['the first Black US senator', 'a Confederate general', 'Johnson’s vice president'], 0),
    Q('What happened when Johnson was impeached?', ['he was removed', 'he was acquitted by one vote', 'he resigned'], 1),
  ]),
  H('910-ww1', 10, WW1, 'The Great War: home front and the peace', `## The fighting
On the **Western Front**, armies dug **trench lines** from the North Sea to Switzerland. **Machine guns**, **artillery** and **poison gas** made attacks deadly; battles like the **Somme** and **Verdun** cost hundreds of thousands of lives with little ground gained. American troops helped stop Germany's 1918 offensives and fought at **Belleau Wood** and the **Meuse-Argonne**.

## The home front
- The **Selective Service Act** (1917) created the draft.
- **Liberty Bonds** paid for the war; the **Committee on Public Information** made propaganda.
- The **Espionage** and **Sedition Acts** limited criticism of the war. In **Schenck v. United States** (1919), the Supreme Court said speech creating a "**clear and present danger**" could be restricted.
- The **Great Migration**: hundreds of thousands of Black Southerners moved north for factory jobs.
- Women's war work helped win the **19th Amendment** (1920) — women's right to vote.

## The peace
- Wilson's **Fourteen Points**: open diplomacy, freedom of the seas, self-determination, and a **League of Nations**.
- The **Treaty of Versailles** made Germany accept blame, pay **reparations** and give up land — anger that helped lead to World War II.
- The Senate rejected the treaty, and the US never joined the League.

About **116,000** Americans died, many from the **1918 influenza pandemic**.`, [
    Q('"Clear and present danger" comes from which case?', ['Marbury v. Madison', 'Schenck v. United States', 'Brown v. Board'], 1),
    Q('The movement of Black Southerners to Northern cities is called …', ['the Great Migration', 'Reconstruction', 'the Dust Bowl'], 0),
    Q('Which amendment did women’s war work help win?', ['15th', '19th', '26th'], 1),
    Q('What did the Treaty of Versailles require of Germany?', ['reparations and accepting blame', 'joining the League', 'nothing'], 0),
    Q('What made attacks on the Western Front so deadly?', ['machine guns, artillery and gas', 'cavalry charges', 'bad weather only'], 0),
  ]),
  H('910-ww2', 10, WW2, 'World War II: causes and consequences', `## Road to war
- The **Great Depression** and anger over **Versailles** helped dictators rise: **Hitler** (Germany), **Mussolini** (Italy), militarists in **Japan**.
- **Appeasement**: at **Munich** (1938), Britain and France let Hitler take part of Czechoslovakia, hoping to avoid war.
- The **Nazi–Soviet Pact** (1939) let Germany invade Poland without fighting the USSR — until Germany invaded the Soviet Union in 1941.
- The US passed **Neutrality Acts**, then **Lend-Lease** (1941) to arm the Allies.

## Turning points
- **Battle of Britain** (1940) — the Royal Air Force stops a German invasion.
- **Stalingrad** (1942–43) — the Soviet victory begins Germany's retreat in the east.
- **Midway** (1942) — the US Navy sinks four Japanese carriers.
- **D-Day** (1944) — a second front in Western Europe.

## The atomic bomb
The secret **Manhattan Project** built the first atomic bombs. President **Harry Truman**, who took office when Roosevelt died in April 1945, ordered them used on **Hiroshima** (August 6) and **Nagasaki** (August 9). People still debate that decision.

## Consequences
- The **Holocaust** led to the **Nuremberg trials**.
- The **United Nations** was founded in **1945**.
- The **GI Bill** sent millions of veterans to college.
- The US and the Soviet Union became rival **superpowers** — the start of the **Cold War**.`, [
    Q('What was appeasement?', ['giving Hitler what he wanted to avoid war', 'a US law', 'a battle'], 0),
    Q('Which battle began Germany’s retreat in the east?', ['Stalingrad', 'Midway', 'Normandy'], 0),
    Q('The secret program to build the atomic bomb was the …', ['Lend-Lease Act', 'Manhattan Project', 'Marshall Plan'], 1),
    Q('Who was President when the atomic bombs were used?', ['Franklin D. Roosevelt', 'Harry Truman', 'Dwight D. Eisenhower'], 1),
    Q('Which organization was founded in 1945 to keep peace?', ['the League of Nations', 'the United Nations', 'NATO'], 1),
  ]),

  // ======================= 11–12: the Constitution, piece by piece =======================
  H('1112-art1', 12, CON, 'Article I: Congress', `## The House of Representatives
- Seats by **population** (counted every 10 years by the **census**); today **435** members.
- **2-year** terms; must be **25** years old, a citizen for **7** years, and live in the state.
- Starts all **tax (revenue) bills**; has the power to **impeach** (charge) officials.

## The Senate
- **Two senators per state**; **6-year** terms, staggered so a third are elected every two years.
- Must be **30**, a citizen for **9** years.
- Originally chosen by state legislatures; the **17th Amendment** (1913) made them elected by the people.
- **Approves treaties** (two-thirds) and confirms appointments; **tries impeachments** (two-thirds to convict).
- The **Vice President** is President of the Senate and votes only to break a tie.

## Powers of Congress (Section 8)
Tax, borrow money, regulate **commerce** between states and with other nations, coin money, set up post offices, declare **war**, raise an army and navy — and make all laws "**necessary and proper**" for these powers (the **elastic clause**).

## How a bill becomes a law
Passes both houses → President **signs** it or **vetoes** it → Congress can **override** a veto with **two-thirds** of both houses.

## Limits (Section 9)
Congress can't suspend **habeas corpus** (except in rebellion or invasion), or pass **bills of attainder** or **ex post facto** laws.`, [
    Q('How long is a senator’s term?', ['2 years', '4 years', '6 years'], 2),
    Q('Where must tax bills start?', ['the Senate', 'the House', 'the White House'], 1),
    Q('What vote overrides a veto?', ['a majority of both houses', 'two-thirds of both houses', 'three-fourths of the states'], 1),
    Q('The "elastic clause" is the …', ['necessary and proper clause', 'commerce clause', 'supremacy clause'], 0),
    Q('Which amendment made senators directly elected?', ['16th', '17th', '19th'], 1),
  ]),
  H('1112-art2', 12, CON, 'Article II: the President', `## Who can be President
- At least **35** years old, a **natural-born citizen**, and a US resident for **14** years.
- A **4-year** term. The **22nd Amendment** (1951) limits a President to **two** elected terms.

## How the President is chosen
The **Electoral College**: each state gets electors equal to its senators + representatives (DC gets 3 under the **23rd Amendment**) — **538** in all; **270** wins. If no one has a majority, the **House** chooses.

## Powers
- **Commander in Chief** of the armed forces
- Make **treaties** (with two-thirds of the Senate)
- **Appoint** ambassadors, judges and officers (with the Senate's consent)
- **Pardon** federal crimes (except impeachment)
- **Veto** bills; give the **State of the Union**; "take Care that the Laws be faithfully executed"

## Succession and removal
- The President can be removed by **impeachment** and conviction for "Treason, Bribery, or other high Crimes and Misdemeanors."
- The **25th Amendment** (1967) explains succession and what happens if a President can't do the job.`, [
    Q('Minimum age for President?', ['30', '35', '40'], 1),
    Q('How many electoral votes win the presidency?', ['270', '218', '538'], 0),
    Q('Which amendment limits the President to two terms?', ['20th', '22nd', '25th'], 1),
    Q('A treaty needs approval from …', ['two-thirds of the Senate', 'a majority of the House', 'the Supreme Court'], 0),
    Q('Who chooses the President if no one has an electoral majority?', ['the Senate', 'the House', 'the Supreme Court'], 1),
  ]),
  H('1112-art3', 12, CON, 'Article III and judicial review', `## The courts
- Creates **one Supreme Court**; Congress creates the lower federal courts.
- Federal judges are appointed by the President with the Senate's consent and serve "during **good Behaviour**" — in practice, for **life** — so they can rule without political pressure.
- The Constitution doesn't set the number of justices; Congress set it at **nine** in **1869**.

## What federal courts hear
Cases about the **Constitution**, federal laws and treaties; cases between states; cases involving ambassadors; and some others.

## Treason
The only crime defined in the Constitution: **levying war** against the US or **giving aid and comfort** to its enemies — proven by **two witnesses** to the same act, or a confession in open court.

## Judicial review
In **Marbury v. Madison** (**1803**), Chief Justice **John Marshall** ruled that the Supreme Court can strike down laws that conflict with the Constitution. This power, **judicial review**, isn't written in the Constitution — it comes from this case.

## Landmark cases
- **Brown v. Board of Education** (1954) — school segregation is unconstitutional
- **Miranda v. Arizona** (1966) — suspects must be told their rights
- **Tinker v. Des Moines** (1969) — students keep free speech rights at school`, [
    Q('Which case established judicial review?', ['Brown v. Board', 'Marbury v. Madison', 'Miranda v. Arizona'], 1),
    Q('How long do federal judges serve?', ['10 years', 'during good behaviour (in practice, for life)', 'until age 70'], 1),
    Q('Who set the number of justices at nine?', ['the Constitution', 'Congress', 'the President'], 1),
    Q('What is the only crime defined in the Constitution?', ['treason', 'murder', 'bribery'], 0),
    Q('Brown v. Board of Education ruled that …', ['school segregation is unconstitutional', 'students have free speech', 'suspects must be told their rights'], 0),
  ]),
  H('1112-art4-7', 12, CON, 'Articles IV–VII: states, amendments and supremacy', `## Article IV — the states
- **Full Faith and Credit**: states respect each other's laws, records and court rulings.
- **Privileges and Immunities**: a state can't unfairly treat citizens of other states.
- **Extradition**: a person who flees to another state can be returned.
- Congress admits **new states**; the US guarantees each state a **republican** form of government.

## Article V — amending
**Propose** an amendment: two-thirds of **both houses** of Congress (or a convention called by two-thirds of the states — never used).
**Ratify** it: **three-fourths** of the states (38 of 50).
There are **27** amendments; the last, about congressional pay, was ratified in **1992** — over 200 years after it was proposed.

## Article VI — supremacy
- The Constitution, federal laws and treaties are the **"supreme Law of the Land"** — they win over conflicting state laws (the **Supremacy Clause**).
- Officials swear an oath to support the Constitution; there can be **no religious test** for office.

## Article VII — ratification
Nine states were needed. The **Federalists** (Hamilton, Madison, Jay — who wrote **The Federalist Papers**) argued for ratification; the **Anti-Federalists** feared a strong central government and demanded a bill of rights. **New Hampshire** became the ninth state, in **June 1788**.`, [
    Q('How many states must ratify an amendment?', ['two-thirds', 'three-fourths', 'all of them'], 1),
    Q('Which clause makes federal law win over conflicting state law?', ['Supremacy Clause', 'Full Faith and Credit', 'Elastic Clause'], 0),
    Q('Who wrote The Federalist Papers?', ['Jefferson, Adams and Franklin', 'Hamilton, Madison and Jay', 'Washington and Lafayette'], 1),
    Q('Article VI says there can be no …', ['religious test for office', 'national army', 'income tax'], 0),
    Q('Which state was the ninth to ratify?', ['Delaware', 'Virginia', 'New Hampshire'], 2),
  ]),
  H('1112-amend', 12, CON, 'The later amendments', `After the Bill of Rights, **17** more amendments changed the country.

- **11th** (1795) — limits lawsuits against states in federal court
- **12th** (1804) — separate electoral votes for President and Vice President
- **13th** (1865) — abolishes slavery
- **14th** (1868) — citizenship by birth; **due process** and **equal protection** apply to the states
- **15th** (1870) — voting can't be denied by race
- **16th** (1913) — federal **income tax**
- **17th** (1913) — senators elected by the people
- **18th** (1919) — **Prohibition** of alcohol … **21st** (1933) repeals it, the only amendment to undo another
- **19th** (1920) — **women's right to vote**
- **20th** (1933) — terms start in January (the "lame duck" amendment)
- **22nd** (1951) — two-term limit for Presidents
- **23rd** (1961) — electoral votes for Washington, D.C.
- **24th** (1964) — bans **poll taxes** in federal elections
- **25th** (1967) — presidential succession and disability
- **26th** (1971) — voting age lowered to **18**
- **27th** (1992) — congressional pay raises take effect only after the next election`, [
    Q('Which amendment gave women the right to vote?', ['15th', '19th', '26th'], 1),
    Q('Which amendment repealed Prohibition?', ['18th', '21st', '24th'], 1),
    Q('The voting age became 18 with the …', ['24th', '25th', '26th'], 2),
    Q('Which amendment banned poll taxes in federal elections?', ['24th', '16th', '12th'], 0),
    Q('The 16th Amendment allowed …', ['an income tax', 'direct election of senators', 'term limits'], 0),
  ]),
  H('1112-federalism', 12, CON, 'Federalism, separation of powers and checks', `The Constitution protects liberty by **dividing power** two ways.

## Separation of powers (across)
Legislative, executive and judicial powers belong to different branches, each with **checks** on the others:
- President → Congress: **veto**. Congress → President: **override**, **impeach**, control **spending**, Senate **confirms** appointments and **ratifies** treaties.
- President → courts: **nominates** judges. Senate → courts: **confirms** them. Congress → courts: sets their size and some of their jurisdiction; can **impeach** judges.
- Courts → Congress and President: **judicial review** — striking down unconstitutional laws and actions.

## Federalism (up and down)
Power is shared between the **national** government and the **states**.
- **Delegated (enumerated)** powers: national — war, treaties, money, interstate commerce.
- **Reserved** powers (10th Amendment): states — schools, local governments, most criminal law, licenses.
- **Concurrent** powers: both — taxing, borrowing, courts.

Madison explained the idea in **Federalist No. 51**: "**Ambition must be made to counteract ambition.**"`, [
    Q('Which is a check the courts have on Congress?', ['veto', 'judicial review', 'impeachment'], 1),
    Q('Powers shared by the national and state governments are …', ['reserved', 'concurrent', 'delegated'], 1),
    Q('Running schools is mainly a … power of the states.', ['reserved', 'delegated', 'implied'], 0),
    Q('"Ambition must be made to counteract ambition" is from …', ['the Declaration', 'Federalist No. 51', 'the Gettysburg Address'], 1),
    Q('Who confirms federal judges?', ['the House', 'the Senate', 'the Supreme Court'], 1),
  ]),
  H('1112-civ-lincoln', 12, CIV, 'Lincoln’s words: the Gettysburg Address', `On **November 19, 1863**, at the dedication of a cemetery at Gettysburg, **Abraham Lincoln** spoke for about **two minutes** — 272 words that redefined the war.

"**Four score and seven years ago** our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that **all men are created equal**."

- "Four score and seven" = 87 years → back to **1776**: Lincoln tied the war to the **Declaration**, not just the Constitution.
- The war is a test of whether a nation "so conceived and so dedicated, can long endure."
- The living must finish the "unfinished work" so that the dead "shall not have died in vain."
- The nation shall have "**a new birth of freedom**" — the war is now about ending slavery as well as saving the Union.
- "**government of the people, by the people, for the people, shall not perish from the earth.**"

In his **Second Inaugural Address** (March 1865) he asked the nation to rebuild "**with malice toward none, with charity for all**."`, [
    Q('How many years is "four score and seven"?', ['47', '87', '107'], 1),
    Q('Counting back 87 years from 1863 points to …', ['the Constitution (1787)', 'the Declaration (1776)', 'Jamestown (1607)'], 1),
    Q('What does "a new birth of freedom" suggest?', ['the war is also about ending slavery', 'a new capital city', 'freedom for Britain'], 0),
    Q('"With malice toward none" comes from …', ['the Gettysburg Address', 'the Second Inaugural Address', 'the Emancipation Proclamation'], 1),
    Q('About how long was the Gettysburg Address?', ['two minutes', 'two hours', 'twenty minutes'], 0),
  ]),
];
