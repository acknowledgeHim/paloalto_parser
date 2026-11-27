const RAW = [
    // K
    `{the|The} dog ran fast. || A sentence starts with a capital letter.
Can {i|I} have a cookie? || "I" is always a capital letter.
I see two {cat|cats}. || More than one cat: add -s.
{we|We} like to play. || A sentence starts with a capital letter.
I have {a|an} apple. || Use "an" before a vowel sound: an apple.
She has three {dog|dogs}. || More than one dog: add -s.
My friend {sam|Sam} is here. || Names start with a capital letter.
The sun {are|is} hot. || One thing: "is".
I {is|am} happy. || With "I", use "am".
He {run|runs} fast. || He, she or it: add -s to the action word.
We {is|are} friends. || More than one: "are".
That is {a|an} egg. || Use "an" before a vowel sound: an egg.
My mom and {i|I} baked a cake. || "I" is always a capital letter.
{my|My} hat is red. || A sentence starts with a capital letter.
I saw {a|an} ant. || Use "an" before a vowel sound: an ant.`,
    // 1
    `The two cats {is|are} sleeping. || More than one: "are".
I was born in {june|June}. || Months start with a capital letter.
We go to school on {monday|Monday}. || Days of the week start with a capital letter.
She {have|has} a red ball. || He, she or it: "has".
They {was|were} at the park. || More than one: "were".
I saw {a|an} owl in the tree. || Use "an" before a vowel sound: an owl.
Our dog Max {like|likes} bones. || One dog: add -s to the action word.
Tom and {me|I} went home. || Use "I" when you are one of the people doing it.
The {boxs|boxes} are heavy. || Words ending in x add -es: boxes.
{yesterday|Yesterday} we went to the zoo. || A sentence starts with a capital letter.
He {don't|doesn't} like peas. || He, she or it: "doesn't".
There {is|are} three birds on the fence. || More than one: "are".
I {seen|saw} a rainbow. || The past of "see" is "saw".
My sister {go|goes} to bed early. || One person: add -es to "go".
We live in {texas|Texas}. || Names of places start with a capital letter.`,
    // 2
    `Yesterday I {goed|went} to the store. || The past of "go" is "went".
The two {mouses|mice} ran away. || More than one mouse: mice.
I {dont|don't} want to go. || Don't = do not; it needs an apostrophe.
She is {more|} taller than her brother. || Just "taller" — never "more taller".
We {eated|ate} pizza for dinner. || The past of "eat" is "ate".
The {childs|children} played outside. || More than one child: children.
He {runned|ran} to the bus. || The past of "run" is "ran".
I {cant|can't} find my shoe. || Can't = cannot; it needs an apostrophe.
The table has four {foots|feet}. || More than one foot: feet.
My mom {buyed|bought} me a book. || The past of "buy" is "bought".
This is the {goodest|best} cake ever. || Good, better, best.
The dog wagged {it's|its} tail. || "Its" (no apostrophe) means belonging to it.
We {was|were} late for school. || With "we", use "were".
She {catched|caught} the ball. || The past of "catch" is "caught".
Sam and {me|I} played tag. || Use "I" when you are one of the people doing it.`,
    // 3
    `{Their|There} is a cat on the roof. || "There" is a place. "Their" means belonging to them.
I think {your|you're} right. || You're = you are.
The dog lost {it's|its} bone. || "Its" means belonging to it. "It's" = it is.
Can I come {to|too}? || "Too" means also.
They put {there|their} coats on the bed. || "Their" means belonging to them.
She has {to|two} brothers. || The number is "two".
{Its|It's} raining outside. || It's = it is.
Is this {you're|your} backpack? || "Your" means belonging to you.
My brother is {more|} older than I am. || Just "older" — never "more older".
The {leafs|leaves} fell from the tree. || One leaf, two leaves.
She {sung|sang} a song at the show yesterday. || Yesterday she sang; she has sung.
I have {wrote|written} a letter. || With "have": written.
{They're|Their} house is blue. || "Their" means belonging to them. They're = they are.
This box is {to|too} heavy to lift. || "Too" means more than enough.
We {was|were} glad that the pieces fit. || With "we", use "were".`,
    // 4
    `I don't have {no|any} homework. || Two "no" words cancel out. Use "any".
She sings {good|well}. || "Well" tells how you do something.
He {brang|brought} his lunch. || The past of "bring" is "brought".
My dad is taller {then|than} my uncle. || "Than" compares. "Then" is about time.
Neither of the boys {were|was} ready. || "Neither" means not one, so use "was".
Each of the girls {have|has} a pencil. || "Each" means every single one, so use "has".
We could {of|have} won the game. || It's "could have" (could've), never "could of".
The team {are|is} on the bus. || One team: "is".
I {seen|saw} that movie last week. || Use "saw" on its own; "seen" needs "have".
There {is|are} a lot of people here. || "A lot of people" is more than one: "are".
My brother and I {is|are} going. || Two people: "are".
She {don't|doesn't} know the answer. || He, she or it: "doesn't".
The cookies were burnt, so they tasted {badly|bad}. || After "taste", "feel", "look": bad.
He {laid|lay} down for a nap. || You lie down yourself (yesterday: lay); you lay something down.
We ate lunch, and {than|then} we went outside. || "Then" is about time.`,
    // 5
    `Please give the books to Ana and {I|me}. || After "to", use "me" (to me).
I should {of|have} studied more. || It's "should have" (should've).
There were {less|fewer} people at the park today. || Things you can count: fewer.
The rain will {effect|affect} our plans. || Affect is the action; effect is the result.
Everyone {excepted|accepted} the prize. || Accept means take; except means leaving out.
Between you and {I|me}, this is hard. || After "between", use "me".
The dog is {laying|lying} on the couch. || You lie down (yourself); you lay something down.
{Who's|Whose} jacket is this? || "Whose" asks who it belongs to. Who's = who is.
The {principle|principal} called my parents. || The principal is the head of a school.
My shoe is loose, so I might {loose|lose} it. || Lose means to not have anymore. Loose means not tight.
We were {suppose|supposed} to bring snacks. || It's "supposed to".
The {affect|effect} of the rain was a flood. || The effect is the result.
{Him|He} and I built a fort. || The ones doing it: "He and I".
She did {good|well} on the test. || "Well" tells how you did.
I have {less|fewer} pencils than you. || Things you can count: fewer.`,
    // 6
    `Yesterday she walked to the park and {sees|saw} a deer. || Keep the same tense: it all happened yesterday.
Everyone in the class {were|was} happy. || "Everyone" takes "was".
He finished the test {real|really} quickly. || "Really" describes how quickly.
Please send the photos to my sister or {myself|me}. || Use "myself" only when you did something to yourself.
{Who|Whom} did you invite to the party? || You invited him → whom.
The list of names {are|is} on the wall. || The subject is "list" (one): "is".
I feel {badly|bad} about the mistake. || With "feel", use "bad".
Neither the cat nor the dogs {was|were} hungry. || With "nor", match the closer one: dogs were.
The box of crayons {are|is} on the shelf. || The subject is "box" (one): "is".
There {is|are} many reasons to read. || Many reasons: "are".
The movie had {alot|a lot} of action. || "A lot" is two words.
The book {who|that} I read was long. || Use "who" for people and "that" or "which" for things.
My friend and {myself|I} went skating. || The ones doing it: "My friend and I".
If I {was|were} taller, I could reach it. || For wishes and "if" situations, use "were".
She {has|had} already left when we arrived. || Something that happened before another past event: had.`,
    // 7
    `{Their|They're} going to the game, but {there|their} car is broken. || They're = they are; their = belonging to them.
{Its|It's} clear that the team lost {it's|its} focus. || It's = it is; its = belonging to it.
I should {of|have} known that the {affect|effect} would be huge. || Should have. The effect is the result.
She has {went|gone} to the library, and {than|then} she will go home. || With "has": gone. "Then" is about time.
The data show that {less|fewer} students walk to school {then|than} before. || Countable: fewer. Comparing: than.
{Whose|Who's} coming to dinner, and {who's|whose} car is outside? || Who's = who is; whose = belonging to whom.
If I {was|were} you, I would {of|have} studied. || "If" situations: were. Would have.
The principal {excepted|accepted} our idea, {accept|except} for one part. || Accept = take; except = leaving out.
He {laid|lay} in bed all day, and his dog {laid|lay} beside him. || Lie (rest) → past "lay". Lay (put down) → past "laid".
The group of students {were|was} quiet, and the teacher thanked {they|them}. || One group: "was". After "thanked": them.
{Your|You're} going to love {you're|your} new bike. || You're = you are; your = belonging to you.
Between you and {I|me}, the test was {more|} easier than the last one. || After "between": me. Just "easier".
The {principle|principal} spoke about the {principal|principle} of fairness. || A principal leads a school; a principle is a rule or belief.
The dog {who|that} lives next door {bark|barks} all night. || "That" for animals and things. The dog (one) barks.
She sings {good|well}, and her brother plays piano {real|really} well. || "Well" and "really" describe how.`,
    // 8
    `The committee {have|has} made its decision. The decision {effects|affects} every student. || A committee acting as one: has. Affect = to change something.
Neither of the plans {were|was} perfect. We chose the {least|less} expensive of the two. || "Neither" = not one: was. Comparing two: less.
I would {of|have} called, but my phone was {laying|lying} on the counter. Its battery was dead. || Would have. A phone lies (rests) somewhere.
The museum was {real|really} interesting. My sister and {me|I} stayed for hours. || "Really" describes "interesting". The ones doing it: my sister and I.
The team lost {it's|its} first game. Every player {feel|feels} disappointed. || Its = belonging to it. Every player (one): feels.
She gave the tickets to Marcus and {I|me}, but {us|we} couldn't go. || After "to": me. The ones doing it: we.
There {is|are} many reasons to read. Reading {improve|improves} your vocabulary. || Many reasons: are. Reading (one thing): improves.
The {stationery|stationary} bike didn't move. I wrote a letter on my new {stationary|stationery}. || Stationary = not moving; stationery = writing paper.
He {complemented|complimented} her drawing. The colors {compliment|complement} each other well. || Compliment = praise; complement = go well together.
{Who|Whom} should I ask? The person {whom|who} answered the phone was kind. || Ask him → whom. He answered → who.
The city council gave {council|counsel} to the mayor, and she {excepted|accepted} it. || Counsel = advice. Accept = take.
When we arrived, the movie had already {began|begun}. We {seen|saw} only the ending. || With "had": begun. "Saw" on its own.
Each of the students {have|has} a locker. The lockers {is|are} painted blue. || Each (one) has. Lockers (many) are.
I'm {to|too} tired to go, and {its|it's} too late anyway. || Too = more than enough. It's = it is.
The coach told us to run {fast|fast}, so we ran {quick|quickly} around the track. || "Quickly" describes how we ran.`,
    // 9
    `The students inferred that phones {was|were} banned, {irregardless|regardless} of grade. || Phones were. "Regardless" is the standard word.
Each of the essays {were|was} graded. The teacher, along with her assistants, {are|is} finishing the report. || "Each" is one: was. "Along with" doesn't add to the subject: is.
The storm was {eminent|imminent}, so we drove {further|farther} inland. || Imminent = about to happen; eminent = famous. Farther is for distance.
The detective tried to {illicit|elicit} a confession, but the suspect's answers were {allusive|elusive}. || Elicit = draw out; illicit = illegal. Elusive = hard to pin down.
Neither the coach nor the players {was|were} surprised. {There|Their} strategy had worked. || With "nor", match the closer subject: players were. Their = belonging to them.
The report, which {include|includes} three charts, {are|is} due Friday. || The report (one) includes, is.
He is the student {who's|whose} project won. The judges {was|were} impressed. || Whose = belonging to whom. Judges were.
The new rules will {effect|affect} everyone, but the {affects|effects} won't be clear for months. || Affect = to change something; effects = results.
My grandmother, who lives in Ohio, {visit|visits} us every summer. She always {bring|brings} pie. || My grandmother (one) visits and brings.
The jury has reached {their|its} verdict, and the lawyers {is|are} waiting. || The jury acting as one: its. Lawyers are.
He {flaunted|flouted} the rules and then {flouted|flaunted} his new car. || Flout = ignore a rule; flaunt = show off.
If I {was|were} the captain, I would {of|have} chosen differently. || "If" situations: were. Would have.
{Its|It's} hard to {loose|lose} the habit of {loosing|losing} your keys. || It's = it is. Lose = no longer have.
There {is|are} fewer than ten students left, and {less|fewer} buses are running. || Students are. Countable buses: fewer.
The book {lays|lies} on the table, where it has been for weeks; nobody has {red|read} it. || A book lies (rests). The past of "read" is spelled "read".`,
    // 10
    `The council discussed the {capitol|capital} budget. Its members {was|were} divided. || Capital = money or main city; a capitol is a building. Members were.
The findings were {discreet|discrete} pieces of evidence, but she kept her opinion {discrete|discreet}. || Discrete = separate; discreet = careful and private.
The author often alludes to myths. The meaning {alludes|eludes} most readers, and the critics {is|are} divided. || Allude = refer to; elude = escape. Critics are.
Ms. Ruiz, {whom|who} coached the team, {insured|ensured} that they practiced daily. || She coached → who. Ensure = make sure; insure = buy insurance.
The museum is {comprised|composed} of four galleries, and the largest {display|displays} modern art. || "Composed of" (or "comprises"). The largest (one) displays.
The orchestra performed {good|well}. Neither the violinists nor the conductor {were|was} nervous. || "Well" describes how. With "nor", match the closer subject: conductor was.
We will {precede|proceed} with the plan, {irregardless|regardless} of the cost. || Proceed = go ahead; precede = come before. Regardless.
The candidate was {adverse|averse} to debating, and the {averse|adverse} weather made campaigning hard. || Averse = unwilling; adverse = harmful.
The results of the survey {was|were} surprising. Every one of the participants {were|was} under twenty. || Results were. Every one: was.
I {could|couldn't} care less about the score; the game itself was fun. || If you couldn't care less, you don't care at all.
The book {lays|lies} on the table, where {its|it's} been for weeks. || A book lies (rests). It's = it has.
The novel's themes, which {includes|include} loss and hope, {resonates|resonate} with readers. || Themes (many): include, resonate.
The coach told him and {I|me} to run laps. || After "told": him and me.
The new policy had a positive {affect|effect}, and fewer students {was|were} late. || Effect = result. Students were.
He tried to {diffuse|defuse} the argument before it {escalates|escalated}. || Defuse = calm down; diffuse = spread out. Keep the past tense.`,
    // 11
    `The speech was praised, but its {affect|effect} on voters was small. Critics said she {implies|implied} a tax increase. || Effect = result. Keep the past tense.
Neither the senator nor her advisers {was|were} available. {Whomever|Whoever} answered took a message. || With "nor", match the closer subject: advisers were. Whoever answered (he answered).
The data were analyzed carefully; however, the conclusions {was|were} disputed, and the {principle|principal} author resigned. || Conclusions were. Principal = main.
The effects of the policy {is|are} complex, and the {principle|principal} concern is cost. || Effects are. Principal = main.
The company, along with its partners, {plan|plans} to expand. Its profits {has|have} doubled. || The company (one) plans. Profits have.
A judge must be {uninterested|disinterested} to be fair, but the audience seemed {disinterested|uninterested} and left early. || Disinterested = not taking sides; uninterested = bored.
The {phenomena|phenomenon} was recorded once; other phenomena {was|were} recorded later. || One phenomenon, two phenomena.
The criteria {is|are} strict. The most important {criteria|criterion} is originality. || One criterion, two criteria.
If the experiment had worked, we would {of|have} published it, and its {affects|effects} would be known. || Would have. Effects = results.
The number of volunteers {have|has} grown, and {less|fewer} complaints {was|were} received. || "The number" is one: has. Countable: fewer complaints were.
Her style is {very|} unique, and her latest novel {have|has} won awards. || Unique means one of a kind — nothing is "very unique". The novel has.
We should try {and|to} finish today, because the deadline {are|is} close. || "Try to". The deadline is.
The essay explores how the war {effected|affected} families who lost {there|their} homes. || Affected = changed. Their = belonging to them.
The committee was split; it couldn't agree on {it's|its} chair, {irregardless|regardless} of the vote. || Its = belonging to it. Regardless.
{Laying|Lying} in the sun all day, the cat {sleep|slept} peacefully. || Lying = resting. Keep the past tense.`,
    // 12
    `When auditors finally {illicited|elicited} the truth, the board was forced to act, and the shareholders {was|were} furious. || Elicit = draw out. Shareholders were.
The professor's argument, which {rely|relies} on dated sources, {lack|lacks} rigor. Its conclusions, nonetheless, {has|have} been influential. || The argument (one) relies, lacks. Conclusions have.
Neither the defendant nor the witnesses {was|were} credible, and the jury deliberated for days before reaching {their|its} verdict. || With "nor", match the closer subject: witnesses were. The jury as one: its.
The historian warned that war was {eminent|imminent}, yet few heeded her, {irregardless|regardless} of her reputation. || Imminent = about to happen. Regardless.
The new law will affect millions, but its long-term {affects|effects} {is|are} uncertain. || Effects (results) are.
The largest survey was {comprised|composed} of 5,000 responses, and the results {has|have} been published. || Composed of. Results have.
He {lay|laid} the manuscript on the desk and then {laid|lay} down to rest. || Lay = put something down (past: laid). Lie = rest (past: lay).
The {premier|premiere} of the film was a success; the prime minister, {whom|who} critics say is a film buff, attended. || A premiere is a first showing. Who is a film buff (he is).
Each of the theories {have|has} merit, but not one of them fully {explain|explains} the anomaly. || Each (one) has. Not one explains.
The foundation's {principle|principal} goal is education; its guiding {principal|principle} is equity. || Principal = main; principle = rule or belief.
The final report was {more|} superior to the draft, and the editors {complemented|complimented} the author. || "Superior" already means better. Compliment = praise.
The council sought {council|counsel} from experts, {who's|whose} advice proved invaluable. || Counsel = advice. Whose = belonging to whom.
If I {was|were} in charge, the policy would {of|have} been different. || "If" situations: were. Would have.
Scarcely had the meeting begun {than|when} the alarm sounded, and everyone {were|was} evacuated. || "Scarcely … when". Everyone was.
The CEO {flaunted|flouted} the regulations, {inferring|implying} that rules didn't apply to him. || Flout = ignore a rule. Imply = suggest; infer = conclude.`,
];
/** Turn "The {cat|cats} sat." into tokens; a marker whose wrong and right are the same is NOT a mistake. */
export function parse(line) {
    const [text, tip = ''] = line.split('||').map((x) => x.trim());
    if (!text)
        return null;
    const tokens = [];
    // Split on spaces outside braces.
    const parts = text.match(/(?:\{[^}]*\}|\S)+/g) ?? [];
    for (const p of parts) {
        const m = /\{([^|}]*)\|([^}]*)\}/.exec(p);
        if (!m) {
            tokens.push({ shown: p, right: null });
            continue;
        }
        const shown = p.replace(m[0], m[1]);
        const right = p.replace(m[0], m[2]).trim();
        // "{more|}" = a word that shouldn't be there: its right version is "" (delete it).
        tokens.push({ shown, right: shown === right ? null : right });
    }
    return { tokens, tip };
}
export const GRAMMAR = RAW.map((block) => block
    .trim()
    .split('\n')
    .map((l) => parse(l))
    // Only items with at least one real mistake (a few lines above just show correct usage).
    .filter((x) => Boolean(x && x.tokens.some((t) => t.right !== null))));
