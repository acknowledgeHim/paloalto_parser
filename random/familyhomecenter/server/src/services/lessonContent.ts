/**
 * 📖 Built-in lessons (📚 Learning): a rule or idea in plain words, then a short quiz. They're copied
 * into the learning_lessons table the first time the app starts with them (never over a parent's
 * edits), so a parent can change, add or hide lessons from the app.
 *
 * Body markup (rendered by the page): "## " a heading, "- " a bullet, "✅ " / "❌ " a right / wrong
 * example, **bold**, a blank line between paragraphs.
 */
export interface QuizItem {
  q: string;
  choices: string[];
  /** index of the right choice */
  answer: number;
  /** shown after answering */
  why?: string;
}
export interface LessonSeed {
  id: string;
  subject: 'grammar' | 'math' | 'history' | 'science' | 'handson';
  grade: number;
  topic: string;
  title: string;
  body: string;
  quiz: QuizItem[];
}

const Q = (q: string, choices: string[], answer: number, why?: string): QuizItem => ({ q, choices, answer, why });

export const GRAMMAR_LESSONS: LessonSeed[] = [
  {
    id: 'g-k-capitals',
    subject: 'grammar',
    grade: 0,
    topic: 'Sentences',
    title: 'Big letter at the start, dot at the end',
    body: `A sentence is a group of words that tells a whole idea.

- It starts with a **capital** (big) letter.
- It ends with a **period** (.), a **question mark** (?) or an **exclamation mark** (!).

✅ The cat is soft.
❌ the cat is soft
✅ Can I play?
✅ Look out!`,
    quiz: [
      Q('Which one is written the right way?', ['the dog ran.', 'The dog ran.', 'The dog ran'], 1, 'Big letter at the start, a dot at the end.'),
      Q('What goes at the end of a question?', ['.', '?', ','], 1),
      Q('Which word should have a capital letter? "we went home."', ['we', 'went', 'home'], 0, 'It is the first word of the sentence.'),
    ],
  },
  {
    id: 'g-k-plurals',
    subject: 'grammar',
    grade: 0,
    topic: 'Words',
    title: 'One cat, two cats',
    body: `When there is **more than one** of something, we usually add **-s** to the end of the word.

- one dog → two dog**s**
- one hat → three hat**s**

✅ I see two birds.
❌ I see two bird.`,
    quiz: [
      Q('One frog, two …', ['frog', 'frogs', 'froges'], 1),
      Q('Which is right?', ['I have three ball.', 'I have three balls.'], 1),
      Q('Which word means more than one?', ['cup', 'cups'], 1),
    ],
  },
  {
    id: 'g-1-i-names',
    subject: 'grammar',
    grade: 1,
    topic: 'Capitals',
    title: 'Capital letters for I, names, days and months',
    body: `Some words **always** start with a capital letter, even in the middle of a sentence:

- The word **I**
- People's names: **Sam**, **Mia**
- Days: **Monday**, **Friday**
- Months: **June**, **October**
- Places: **Texas**, **Chicago**

✅ On Monday, Mia and I went to Ohio.
❌ on monday, mia and i went to ohio.`,
    quiz: [
      Q('Which is right?', ['My birthday is in may.', 'My birthday is in May.'], 1, 'Months start with a capital.'),
      Q('Which is right?', ['Sam and i played.', 'Sam and I played.'], 1, '"I" is always a capital.'),
      Q('Which word needs a capital? "We swim on saturday."', ['swim', 'saturday', 'on'], 1, 'Days of the week start with a capital.'),
    ],
  },
  {
    id: 'g-1-is-are',
    subject: 'grammar',
    grade: 1,
    topic: 'Verbs',
    title: 'is / are, was / were',
    body: `Use **is** and **was** for **one** thing. Use **are** and **were** for **more than one** (and with **you** and **we**).

- The dog **is** happy. The dogs **are** happy.
- The cat **was** wet. The cats **were** wet.
- **I am** · **you are** · **we are** · **they are**

✅ We were at the park.
❌ We was at the park.`,
    quiz: [
      Q('The birds ___ singing.', ['is', 'are'], 1, 'More than one bird: are.'),
      Q('I ___ hungry.', ['is', 'am', 'are'], 1),
      Q('They ___ late yesterday.', ['was', 'were'], 1, '"They" takes were.'),
    ],
  },
  {
    id: 'g-2-past',
    subject: 'grammar',
    grade: 2,
    topic: 'Verbs',
    title: 'Words for things that already happened',
    body: `To show something already happened, most action words add **-ed**: walk → walk**ed**, play → play**ed**.

Some words are **rule-breakers** and change in their own way. Learn these by heart:

- go → **went** · see → **saw** · eat → **ate**
- run → **ran** · buy → **bought** · catch → **caught**
- bring → **brought** · think → **thought** · swim → **swam**

✅ Yesterday we went to the zoo.
❌ Yesterday we goed to the zoo.`,
    quiz: [
      Q('Yesterday I ___ a rainbow.', ['seen', 'saw', 'seed'], 1),
      Q('Last night we ___ pizza.', ['eated', 'ate', 'eat'], 1),
      Q('She ___ the ball.', ['catched', 'caught'], 1),
    ],
  },
  {
    id: 'g-2-a-an',
    subject: 'grammar',
    grade: 2,
    topic: 'Words',
    title: 'a or an?',
    body: `Listen to the **first sound** of the next word.

- If it starts with a **vowel sound** (a, e, i, o, u), use **an**: **an** apple, **an** egg, **an** owl.
- Otherwise use **a**: **a** dog, **a** banana, **a** kite.

✅ I ate an orange.
❌ I ate a orange.`,
    quiz: [
      Q('I saw ___ elephant.', ['a', 'an'], 1),
      Q('She has ___ hat.', ['a', 'an'], 0),
      Q('We found ___ ant.', ['a', 'an'], 1),
    ],
  },
  {
    id: 'g-2-contractions',
    subject: 'grammar',
    grade: 2,
    topic: 'Punctuation',
    title: 'Squished words (contractions)',
    body: `A **contraction** squishes two words into one. An **apostrophe** (') goes where letters were taken out.

- do not → **don't**
- can not → **can't**
- it is → **it's**
- I am → **I'm**
- they are → **they're**

✅ I can't find my shoe.
❌ I cant find my shoe.`,
    quiz: [
      Q('What is the short way to write "do not"?', ['dont', "don't", "do'nt"], 1),
      Q('"I\'m" means …', ['I am', 'I was', 'I have'], 0),
      Q('Which is written right?', ['We didnt go.', "We didn't go."], 1),
    ],
  },
  {
    id: 'g-3-there',
    subject: 'grammar',
    grade: 3,
    topic: 'Mixed-up words',
    title: 'there, their, they’re',
    body: `They sound the same but mean different things.

- **there** = a place (it has "here" in it!): Put it over **there**.
- **their** = belongs to them: **Their** dog is big.
- **they're** = they are: **They're** coming home.

**Trick:** if you can say "they are", use **they're**.

✅ They're putting their coats over there.`,
    quiz: [
      Q('___ going to the park.', ['There', 'Their', "They're"], 2, 'They are going → they’re.'),
      Q('The kids lost ___ ball.', ['there', 'their', "they're"], 1, 'The ball belongs to them.'),
      Q('Sit over ___.', ['there', 'their', "they're"], 0, 'A place.'),
    ],
  },
  {
    id: 'g-3-its-your',
    subject: 'grammar',
    grade: 3,
    topic: 'Mixed-up words',
    title: 'its / it’s and your / you’re',
    body: `The apostrophe means **letters are missing**, not "belongs to".

- **it's** = it is: **It's** raining.
- **its** = belongs to it: The dog wagged **its** tail.
- **you're** = you are: **You're** funny.
- **your** = belongs to you: Is this **your** hat?

**Trick:** try saying "it is" or "you are". If it works, use the apostrophe.`,
    quiz: [
      Q('The bird flapped ___ wings.', ['its', "it's"], 0, '"It is wings" doesn’t work.'),
      Q('___ going to love this!', ['Your', "You're"], 1, 'You are going → you’re.'),
      Q('___ time for bed.', ['Its', "It's"], 1, 'It is time.'),
    ],
  },
  {
    id: 'g-3-to-too',
    subject: 'grammar',
    grade: 3,
    topic: 'Mixed-up words',
    title: 'to, too, two',
    body: `- **to** = toward, or part of an action: Go **to** school. I like **to** read.
- **too** = also, or more than enough: Me **too**! It's **too** hot.
- **two** = the number 2: **two** cats.

**Trick:** **too** has an extra o — it has "too many" o's.`,
    quiz: [
      Q('Can I come ___?', ['to', 'too', 'two'], 1, 'Also.'),
      Q('I have ___ brothers.', ['to', 'too', 'two'], 2),
      Q('We walked ___ the store.', ['to', 'too', 'two'], 0),
    ],
  },
  {
    id: 'g-4-good-well',
    subject: 'grammar',
    grade: 4,
    topic: 'Describing words',
    title: 'good or well?',
    body: `- **good** describes a **thing** (a noun): a **good** book, The pie is **good**.
- **well** describes **how** something is done (an action): She sings **well**. He played **well**.

After "feel", **good** and **well** both work: I feel **good** (happy). I feel **well** (not sick).

✅ You did well on the test.
❌ You did good on the test.`,
    quiz: [
      Q('She swims ___.', ['good', 'well'], 1, 'How she swims.'),
      Q('That was a ___ movie.', ['good', 'well'], 0, 'Describes the movie.'),
      Q('The team played ___ today.', ['good', 'well'], 1),
    ],
  },
  {
    id: 'g-4-negatives',
    subject: 'grammar',
    grade: 4,
    topic: 'Sentences',
    title: 'No double negatives',
    body: `Use only **one** "no" word in a sentence. "No" words: no, not, n't, never, nothing, nobody, none, nowhere.

Two of them cancel each other out — "I don't have no money" really means "I have some money"!

✅ I don't have any money. / I have no money.
❌ I don't have no money.
✅ We can't find anything.
❌ We can't find nothing.`,
    quiz: [
      Q('Which is right?', ["I didn't see nobody.", "I didn't see anybody."], 1),
      Q('Which is right?', ["There isn't any milk.", "There isn't no milk."], 0),
      Q('He never goes ___.', ['nowhere', 'anywhere'], 1),
    ],
  },
  {
    id: 'g-4-could-have',
    subject: 'grammar',
    grade: 4,
    topic: 'Verbs',
    title: 'could have, not "could of"',
    body: `When we talk fast, "could **have**" sounds like "could **of**" — but it's always **have**.

- could **have** (could've)
- should **have** (should've)
- would **have** (would've)

✅ We could have won!
❌ We could of won!`,
    quiz: [
      Q('I should ___ studied.', ['of', 'have'], 1),
      Q('"Would\'ve" is short for …', ['would of', 'would have'], 1),
      Q('Which is right?', ['She could of called.', 'She could have called.'], 1),
    ],
  },
  {
    id: 'g-5-i-me',
    subject: 'grammar',
    grade: 5,
    topic: 'Pronouns',
    title: 'I or me?',
    body: `- Use **I** for the one **doing** the action: **I** ran. Sam and **I** ran.
- Use **me** when something is done **to** you, or after words like **to, for, with, between**: Give it to **me**. Come with Sam and **me**.

**Trick:** cover up the other person. "Sam and **me** went" → "**me** went"? No → "Sam and **I** went".

✅ Mom took Ava and me to the park.
❌ Mom took Ava and I to the park.`,
    quiz: [
      Q('Leo and ___ built a fort.', ['I', 'me'], 0, '"I built a fort."'),
      Q('The coach told Mia and ___ to run.', ['I', 'me'], 1, '"The coach told me."'),
      Q('Between you and ___, it was hard.', ['I', 'me'], 1),
    ],
  },
  {
    id: 'g-5-fewer-less',
    subject: 'grammar',
    grade: 5,
    topic: 'Mixed-up words',
    title: 'fewer or less?',
    body: `- **fewer** for things you can **count** one by one: **fewer** apples, **fewer** kids.
- **less** for stuff you **can't** count one by one: **less** water, **less** noise, **less** time.

✅ There were fewer cars today.
❌ There were less cars today.`,
    quiz: [
      Q('I have ___ pencils than you.', ['fewer', 'less'], 0, 'You can count pencils.'),
      Q('Please make ___ noise.', ['fewer', 'less'], 1),
      Q('We need ___ chairs.', ['fewer', 'less'], 0),
    ],
  },
  {
    id: 'g-5-affect',
    subject: 'grammar',
    grade: 5,
    topic: 'Mixed-up words',
    title: 'affect or effect?',
    body: `- **affect** is the **action** — to change something: The rain will **affect** the game.
- **effect** is the **result**: The rain had a big **effect**.

**Trick:** **A**ffect = **A**ction, **E**ffect = **E**nd result.`,
    quiz: [
      Q('Will the noise ___ your sleep?', ['affect', 'effect'], 0),
      Q('The medicine had a quick ___.', ['affect', 'effect'], 1),
      Q('What was the ___ of the storm?', ['affect', 'effect'], 1),
    ],
  },
  {
    id: 'g-6-agreement',
    subject: 'grammar',
    grade: 6,
    topic: 'Verbs',
    title: 'Matching the verb to the real subject',
    body: `The verb has to match its **subject** — but the subject isn't always the word right before the verb.

- Words like **each, every, everyone, nobody, neither, one** are singular: **Each** of the boys **has** a bike.
- Ignore the "of …" part: The **box** of crayons **is** here. (one box)

✅ Everyone in my class was happy.
❌ Everyone in my class were happy.`,
    quiz: [
      Q('One of the dogs ___ barking.', ['is', 'are'], 0, 'The subject is "one".'),
      Q('The bag of apples ___ heavy.', ['is', 'are'], 0, 'The subject is "bag".'),
      Q('Each of the girls ___ a pencil.', ['have', 'has'], 1),
    ],
  },
  {
    id: 'g-6-tense',
    subject: 'grammar',
    grade: 6,
    topic: 'Verbs',
    title: 'Keep the same time (tense)',
    body: `When you tell a story, keep the verbs in the **same time** unless the time really changes.

✅ Yesterday I walked to the park and saw a deer.
❌ Yesterday I walked to the park and see a deer.

Use **had** for something that happened **before** another past thing: When we arrived, the movie **had** started.`,
    quiz: [
      Q('Last week we drove to the lake and ___ all day.', ['swim', 'swam'], 1),
      Q('She opened the box and ___ a puppy.', ['finds', 'found'], 1),
      Q('By the time we got there, the bus ___ left.', ['has', 'had'], 1),
    ],
  },
  {
    id: 'g-7-lie-lay',
    subject: 'grammar',
    grade: 7,
    topic: 'Mixed-up words',
    title: 'lie or lay?',
    body: `- **lie** = to rest or recline (you do it yourself): I **lie** down. The dog is **lying** on the rug.
- **lay** = to put something down (you do it **to** something): **Lay** the book on the table.

The tricky part: the past of **lie** is **lay**!

- Today I lie down. Yesterday I **lay** down.
- Today I lay the book down. Yesterday I **laid** it down.`,
    quiz: [
      Q('The cat is ___ in the sun.', ['laying', 'lying'], 1),
      Q('Please ___ the plates on the table.', ['lie', 'lay'], 1),
      Q('Yesterday I ___ down for a nap.', ['laid', 'lay'], 1),
    ],
  },
  {
    id: 'g-7-myself-nor',
    subject: 'grammar',
    grade: 7,
    topic: 'Pronouns',
    title: 'myself, and either/or · neither/nor',
    body: `**Myself** is only for when **you** already appear in the sentence: I hurt **myself**. I did it **myself**.

✅ Send it to Ana or me.
❌ Send it to Ana or myself.

With **either … or** and **neither … nor**, match the verb to the subject **closer** to it:

✅ Neither the teacher nor the **students were** ready.
✅ Either the cats or the **dog is** barking.`,
    quiz: [
      Q('Ben and ___ made dinner.', ['myself', 'I'], 1),
      Q('Neither my brothers nor my sister ___ home.', ['is', 'are'], 0, '"Sister" is closer.'),
      Q('Either the dog or the cats ___ hungry.', ['is', 'are'], 1, '"Cats" is closer.'),
    ],
  },
  {
    id: 'g-8-who-whom',
    subject: 'grammar',
    grade: 8,
    topic: 'Pronouns',
    title: 'who or whom?',
    body: `- **who** = the one **doing** it (like he/she): **Who** called?
- **whom** = the one it's **done to** (like him/her), and after words like **to, for, with**: **Whom** did you call? To **whom**?

**Trick:** answer the question with he or him. "Who/whom did you see?" → "I saw **him**" → him = whom.`,
    quiz: [
      Q('___ is at the door?', ['Who', 'Whom'], 0, '"He is at the door."'),
      Q('___ did you invite?', ['Who', 'Whom'], 1, '"I invited him."'),
      Q('To ___ should I send it?', ['who', 'whom'], 1),
    ],
  },
  {
    id: 'g-8-were',
    subject: 'grammar',
    grade: 8,
    topic: 'Verbs',
    title: 'If I were … (wishes and what-ifs)',
    body: `For **wishes** and **imaginary** "if" situations, use **were** — even with I, he, she or it.

✅ If I were taller, I could reach it.
✅ I wish it were summer.
❌ If I was you, I'd go.

(If something really might have happened, "was" is fine: "If I was rude, I'm sorry.")`,
    quiz: [
      Q('If I ___ a bird, I would fly.', ['was', 'were'], 1),
      Q('I wish she ___ here.', ['was', 'were'], 1),
      Q('If he ___ the coach, he would change the plan.', ['was', 'were'], 1),
    ],
  },
  {
    id: 'g-9-subjects',
    subject: 'grammar',
    grade: 9,
    topic: 'Verbs',
    title: '“along with”, “the number of”, and other tricky subjects',
    body: `Phrases like **along with, as well as, together with** do **not** make the subject plural.

✅ The coach, along with the players, **is** on the bus.

**The number of** … is singular; **a number of** … means "several" and is plural.

✅ The number of students **has** grown.
✅ A number of students **have** left.`,
    quiz: [
      Q('My mom, as well as my aunts, ___ coming.', ['is', 'are'], 0),
      Q('The number of complaints ___ dropped.', ['has', 'have'], 0),
      Q('A number of kids ___ sick today.', ['is', 'are'], 1),
    ],
  },
  {
    id: 'g-9-confused',
    subject: 'grammar',
    grade: 9,
    topic: 'Mixed-up words',
    title: 'Words that look alike (part 1)',
    body: `- **imminent** = about to happen · **eminent** = famous, respected
- **elicit** = draw out (a response) · **illicit** = against the law
- **allude** = hint at · **elude** = escape
- **adverse** = harmful · **averse** = unwilling
- **discreet** = careful, private · **discrete** = separate
- **precede** = come before · **proceed** = go ahead
- **regardless** — "irregardless" isn't standard`,
    quiz: [
      Q('The storm is ___; get inside!', ['eminent', 'imminent'], 1),
      Q('Please be ___ about the surprise.', ['discrete', 'discreet'], 1),
      Q('The answer ___ me.', ['alluded', 'eluded'], 1),
    ],
  },
  {
    id: 'g-10-confused',
    subject: 'grammar',
    grade: 10,
    topic: 'Mixed-up words',
    title: 'Words that look alike (part 2)',
    body: `- **compliment** = praise · **complement** = go well with (it **complete**s)
- **stationary** = not moving (st**a**nding) · **stationery** = paper (l**e**tters)
- **council** = a group that decides · **counsel** = advice
- **principal** = main, or the head of a school (your **pal**) · **principle** = a rule or belief
- **capital** = a city or money · **capitol** = the building
- **defuse** = calm down · **diffuse** = spread out`,
    quiz: [
      Q('The scarf ___ her coat.', ['compliments', 'complements'], 1),
      Q('Honesty is my guiding ___.', ['principal', 'principle'], 1),
      Q('The bike stayed ___.', ['stationary', 'stationery'], 0),
    ],
  },
  {
    id: 'g-11-plurals',
    subject: 'grammar',
    grade: 11,
    topic: 'Words',
    title: 'Greek and Latin plurals',
    body: `Some words borrowed from Greek and Latin keep their own plurals:

- one **criterion**, two **criteria**
- one **phenomenon**, two **phenomena**
- one **bacterium**, many **bacteria**
- one **analysis**, two **analyses**
- one **thesis**, two **theses**

✅ The main criterion is honesty. These criteria are strict.
❌ The main criteria is honesty.`,
    quiz: [
      Q('This ___ is rare.', ['phenomena', 'phenomenon'], 1),
      Q('The judges used three ___.', ['criterion', 'criteria'], 1),
      Q('The bacteria ___ growing.', ['is', 'are'], 1),
    ],
  },
  {
    id: 'g-12-precision',
    subject: 'grammar',
    grade: 12,
    topic: 'Mixed-up words',
    title: 'Precise words: imply/infer, flout/flaunt and more',
    body: `- **imply** = the speaker hints · **infer** = the listener figures it out
- **flout** = openly ignore a rule · **flaunt** = show off
- **premiere** = a first showing · **premier** = first in rank, or a prime minister
- Absolute words don't take "more" or "very": not "more superior", "more perfect" or "very unique"
- **Scarcely … when** and **no sooner … than**

✅ From her tone I inferred she was upset.
✅ He flouted the dress code.`,
    quiz: [
      Q('Are you ___ that I cheated?', ['implying', 'inferring'], 0, 'The speaker hints.'),
      Q('She likes to ___ her new car.', ['flout', 'flaunt'], 1),
      Q('Scarcely had we sat down ___ the bell rang.', ['than', 'when'], 1),
    ],
  },
];

export const MATH_LESSONS: LessonSeed[] = [
  {
    id: 'm-k-add',
    subject: 'math',
    grade: 0,
    topic: 'Adding',
    title: 'Adding is putting together',
    body: `**Adding** means putting groups together to see how many in all. The sign is **+**.

🍎🍎 + 🍎 = 🍎🍎🍎 → 2 + 1 = 3

- Start with the bigger number and **count up**: 5 + 2 → 5… 6, 7!
- Fingers help!`,
    quiz: [
      Q('2 + 2 = ?', ['3', '4', '5'], 1),
      Q('5 + 1 = ?', ['6', '4', '7'], 0),
      Q('What does + mean?', ['take away', 'put together'], 1),
    ],
  },
  {
    id: 'm-k-subtract',
    subject: 'math',
    grade: 0,
    topic: 'Taking away',
    title: 'Taking away',
    body: `**Taking away** (subtracting) means some go away. The sign is **−**.

🍪🍪🍪🍪 − 🍪 = 🍪🍪🍪 → 4 − 1 = 3

- Start at the first number and **count back**: 6 − 2 → 6… 5, 4!`,
    quiz: [
      Q('5 − 1 = ?', ['4', '6', '3'], 0),
      Q('3 − 3 = ?', ['3', '0', '1'], 1),
      Q('You have 4 balloons and 1 pops. How many now?', ['5', '3', '4'], 1),
    ],
  },
  {
    id: 'm-1-ten',
    subject: 'math',
    grade: 1,
    topic: 'Adding',
    title: 'Make a 10',
    body: `10 is a friendly number. These pairs make 10: **1+9, 2+8, 3+7, 4+6, 5+5**.

To add 8 + 5, **make a 10** first:
- 8 needs **2** more to be 10.
- Take 2 from the 5 → 3 left.
- 10 + 3 = **13**.`,
    quiz: [
      Q('7 + ? = 10', ['2', '3', '4'], 1),
      Q('9 + 4 = ?', ['13', '12', '14'], 0, '9 + 1 = 10, then 3 more.'),
      Q('Which pair makes 10?', ['6 + 3', '6 + 4', '6 + 5'], 1),
    ],
  },
  {
    id: 'm-1-tens',
    subject: 'math',
    grade: 1,
    topic: 'Place value',
    title: 'Tens and ones',
    body: `In a two-digit number, the **left** digit tells how many **tens** and the **right** digit tells how many **ones**.

- **34** = 3 tens and 4 ones = 30 + 4
- **70** = 7 tens and 0 ones

10 more than a number: the tens digit goes up by 1 (34 → 44).`,
    quiz: [
      Q('How many tens in 52?', ['5', '2', '52'], 0),
      Q('6 tens and 3 ones = ?', ['36', '63', '9'], 1),
      Q('10 more than 47 is …', ['48', '57', '37'], 1),
    ],
  },
  {
    id: 'm-2-regroup',
    subject: 'math',
    grade: 2,
    topic: 'Adding and subtracting',
    title: 'Carrying and borrowing',
    body: `Line the numbers up so **ones** are under **ones** and **tens** under **tens**. Start on the **right**.

**Adding:** if the ones make 10 or more, **carry** a ten.
- 27 + 15: 7 + 5 = 12 → write 2, carry 1 ten. 2 + 1 + 1 = 4 tens → **42**

**Subtracting:** if the top ones are too small, **borrow** a ten.
- 42 − 15: 2 − 5? Borrow → 12 − 5 = 7; 3 − 1 = 2 → **27**`,
    quiz: [
      Q('38 + 24 = ?', ['52', '62', '512'], 1),
      Q('50 − 18 = ?', ['32', '42', '38'], 0),
      Q('When adding, which column do you start with?', ['tens', 'ones'], 1),
    ],
  },
  {
    id: 'm-2-even',
    subject: 'math',
    grade: 2,
    topic: 'Numbers',
    title: 'Even, odd and skip counting',
    body: `**Even** numbers can be split into two equal groups. They end in **0, 2, 4, 6, 8**.
**Odd** numbers end in **1, 3, 5, 7, 9**.

**Skip counting** means counting by a number:
- by 2s: 2, 4, 6, 8 …
- by 5s: 5, 10, 15, 20 …
- by 10s: 10, 20, 30 …`,
    quiz: [
      Q('Is 37 even or odd?', ['even', 'odd'], 1),
      Q('5, 10, 15, ? ', ['16', '20', '25'], 1),
      Q('Which is even?', ['13', '28', '41'], 1),
    ],
  },
  {
    id: 'm-3-multiply',
    subject: 'math',
    grade: 3,
    topic: 'Multiplying',
    title: 'Multiplying is equal groups',
    body: `**3 × 4** means **3 groups of 4**: 4 + 4 + 4 = **12**.

- The order doesn't matter: 3 × 4 = 4 × 3.
- Anything × 1 = itself. Anything × 0 = 0.
- × 10: put a 0 on the end (7 × 10 = 70).

**Dividing** undoes multiplying: 12 ÷ 3 = 4 because 3 × 4 = 12.`,
    quiz: [
      Q('5 × 3 = ?', ['8', '15', '53'], 1),
      Q('24 ÷ 6 = ?', ['4', '3', '18'], 0),
      Q('9 × 0 = ?', ['9', '0', '1'], 1),
    ],
  },
  {
    id: 'm-3-area',
    subject: 'math',
    grade: 3,
    topic: 'Shapes',
    title: 'Area and perimeter',
    body: `**Perimeter** is the distance **around** a shape: add up all the sides.
**Area** is how much space is **inside**: for a rectangle, **length × width**.

A rectangle 5 by 3:
- Perimeter = 5 + 3 + 5 + 3 = **16**
- Area = 5 × 3 = **15** square units`,
    quiz: [
      Q('Area of a 4 by 6 rectangle?', ['10', '20', '24'], 2),
      Q('Perimeter of a 4 by 6 rectangle?', ['20', '24', '10'], 0),
      Q('Fencing goes around a yard. That’s the …', ['area', 'perimeter'], 1),
    ],
  },
  {
    id: 'm-4-division',
    subject: 'math',
    grade: 4,
    topic: 'Dividing',
    title: 'Long division: Divide, Multiply, Subtract, Bring down',
    body: `Repeat these steps from left to right: **D**ivide, **M**ultiply, **S**ubtract, **B**ring down. (**D**oes **M**cDonald's **S**ell **B**urgers?)

**84 ÷ 4**
- 8 ÷ 4 = **2**; 2 × 4 = 8; 8 − 8 = 0; bring down the 4.
- 4 ÷ 4 = **1**; 1 × 4 = 4; 4 − 4 = 0.
- Answer: **21**

Anything left at the end is the **remainder**: 17 ÷ 5 = 3 remainder 2.`,
    quiz: [
      Q('96 ÷ 3 = ?', ['32', '31', '33'], 0),
      Q('What is the remainder of 23 ÷ 4?', ['1', '3', '5'], 1),
      Q('What comes after Divide?', ['Subtract', 'Multiply', 'Bring down'], 1),
    ],
  },
  {
    id: 'm-4-fractions',
    subject: 'math',
    grade: 4,
    topic: 'Fractions',
    title: 'What fractions mean, and equal fractions',
    body: `A fraction is **part of a whole**. In **3/4**, the bottom (4) is how many equal parts the whole is cut into; the top (3) is how many parts you have.

**Equal (equivalent) fractions:** multiply or divide the top **and** bottom by the same number.
- 1/2 = 2/4 = 3/6 = 4/8

**Adding with the same bottom:** add the tops, keep the bottom. 1/5 + 2/5 = **3/5**`,
    quiz: [
      Q('2/3 = ?/9', ['4', '6', '3'], 1),
      Q('1/4 + 2/4 = ?', ['3/8', '3/4', '2/4'], 1),
      Q('In 5/8, how many parts is the whole cut into?', ['5', '8', '13'], 1),
    ],
  },
  {
    id: 'm-5-fractions',
    subject: 'math',
    grade: 5,
    topic: 'Fractions',
    title: 'Fractions with different bottoms',
    body: `To add or subtract, the bottoms (**denominators**) must match.

**1/2 + 1/3**
- A number both 2 and 3 go into: **6**
- 1/2 = 3/6 and 1/3 = 2/6
- 3/6 + 2/6 = **5/6**

**Multiplying** is easier: top × top, bottom × bottom. 2/3 × 3/4 = 6/12 = **1/2**`,
    quiz: [
      Q('1/4 + 1/2 = ?', ['2/6', '3/4', '1/6'], 1),
      Q('1/2 × 1/3 = ?', ['1/6', '2/5', '1/5'], 0),
      Q('To add 1/3 and 1/4, the shared bottom is …', ['7', '12', '4'], 1),
    ],
  },
  {
    id: 'm-5-order',
    subject: 'math',
    grade: 5,
    topic: 'Order of operations',
    title: 'Which part first? (order of operations)',
    body: `Work in this order:
1. **P**arentheses (brackets)
2. **E**xponents (powers)
3. **M**ultiply and **D**ivide, left to right
4. **A**dd and **S**ubtract, left to right

(**P**lease **E**xcuse **M**y **D**ear **A**unt **S**ally)

- 2 + 3 × 4 = 2 + 12 = **14** (not 20)
- (2 + 3) × 4 = 5 × 4 = **20**`,
    quiz: [
      Q('6 + 2 × 5 = ?', ['40', '16', '13'], 1),
      Q('(6 + 2) × 5 = ?', ['40', '16', '30'], 0),
      Q('10 − 4 ÷ 2 = ?', ['3', '8', '6'], 1),
    ],
  },
  {
    id: 'm-5-decimals',
    subject: 'math',
    grade: 5,
    topic: 'Decimals',
    title: 'Decimals and place value',
    body: `Digits after the point are **tenths**, **hundredths**, **thousandths** …
- 0.3 = 3 tenths = 3/10
- 0.25 = 25 hundredths = 25/100

**Adding/subtracting:** line up the **decimal points**.
**× 10, 100, 1000:** move the point **right** 1, 2, 3 places. **÷** moves it **left**.
- 3.45 × 100 = **345**`,
    quiz: [
      Q('2.5 + 1.25 = ?', ['3.75', '3.30', '1.50'], 0),
      Q('0.7 × 10 = ?', ['0.07', '7', '70'], 1),
      Q('0.4 is the same as …', ['4/10', '4/100', '1/4'], 0),
    ],
  },
  {
    id: 'm-6-integers',
    subject: 'math',
    grade: 6,
    topic: 'Pre-Algebra',
    title: 'Negative numbers',
    body: `Negative numbers are **less than zero** — like temperatures below 0 or owing money.

- **Adding a negative** = subtracting: 5 + (−3) = 2
- **Subtracting a negative** = adding: 5 − (−3) = 8
- **Multiplying/dividing:** same signs → **positive**; different signs → **negative**
  - (−4) × (−2) = 8 · (−4) × 2 = −8

**Absolute value** |−7| = 7: the distance from 0.`,
    quiz: [
      Q('−3 + 8 = ?', ['5', '−11', '11'], 0),
      Q('(−6) × (−3) = ?', ['−18', '18', '9'], 1),
      Q('4 − (−2) = ?', ['2', '6', '−6'], 1),
    ],
  },
  {
    id: 'm-6-equations',
    subject: 'math',
    grade: 6,
    topic: 'Pre-Algebra',
    title: 'Solving one-step equations',
    body: `An equation is a **balance**: whatever you do to one side, do to the other. Get **x** alone by doing the **opposite**.

- x + 5 = 12 → take 5 from both sides → **x = 7**
- x − 4 = 10 → add 4 → **x = 14**
- 3x = 21 → divide by 3 → **x = 7**
- x ÷ 2 = 9 → multiply by 2 → **x = 18**

Check it: put your answer back in.`,
    quiz: [
      Q('x + 9 = 20. x = ?', ['11', '29', '9'], 0),
      Q('4x = 32. x = ?', ['28', '8', '128'], 1),
      Q('x − 6 = 3. x = ?', ['−3', '9', '18'], 1),
    ],
  },
  {
    id: 'm-6-percent',
    subject: 'math',
    grade: 6,
    topic: 'Pre-Algebra',
    title: 'Percent and ratios',
    body: `**Percent** means "out of 100". 25% = 25/100 = 0.25.

- **25% of 80** = 0.25 × 80 = **20**
- Handy: 10% → move the point one place left (10% of 70 = 7); 50% = half; 25% = a quarter.

A **ratio** compares amounts: 2 : 3. Equal ratios multiply both sides by the same number: 2 : 3 = 4 : 6 = 10 : 15.`,
    quiz: [
      Q('10% of 250 = ?', ['2.5', '25', '250'], 1),
      Q('50% of 64 = ?', ['32', '16', '50'], 0),
      Q('3 : 4 = 9 : ?', ['10', '12', '16'], 1),
    ],
  },
  {
    id: 'm-7-two-step',
    subject: 'math',
    grade: 7,
    topic: 'Algebra',
    title: 'Two-step equations',
    body: `Undo things in **reverse order**: first the adding/subtracting, then the multiplying/dividing.

**3x + 4 = 19**
- Take 4 from both sides: 3x = 15
- Divide by 3: **x = 5**

**Variables on both sides:** 5x + 2 = 2x + 14 → take 2x from both: 3x + 2 = 14 → 3x = 12 → **x = 4**

**Distributing:** 2(x + 3) = 2x + 6`,
    quiz: [
      Q('2x − 5 = 11. x = ?', ['3', '8', '6'], 1),
      Q('4(x + 1) = 20. x = ?', ['4', '5', '6'], 0),
      Q('7x = 3x + 12. x = ?', ['3', '4', '12'], 0),
    ],
  },
  {
    id: 'm-7-slope',
    subject: 'math',
    grade: 7,
    topic: 'Algebra',
    title: 'Slope and y = mx + b',
    body: `**Slope** tells how steep a line is: **rise over run** — how much y changes when x goes up by 1.

slope **m** = (y₂ − y₁) ÷ (x₂ − x₁)

From (1, 2) to (3, 8): m = (8 − 2) ÷ (3 − 1) = 6 ÷ 2 = **3**

In **y = mx + b**: **m** is the slope and **b** is where the line crosses the y-axis (when x = 0).
- y = 2x + 5 → slope 2, crosses at 5.`,
    quiz: [
      Q('Slope from (0, 1) to (2, 7)?', ['3', '4', '6'], 0),
      Q('In y = −4x + 9, the slope is …', ['9', '−4', '4'], 1),
      Q('y = 3x − 2. When x = 4, y = ?', ['10', '14', '12'], 0),
    ],
  },
  {
    id: 'm-8-quadratics',
    subject: 'math',
    grade: 8,
    topic: 'Algebra II',
    title: 'Solving quadratics by factoring',
    body: `A quadratic looks like **x² + bx + c = 0**. Find two numbers that **multiply to c** and **add to b**.

**x² − 5x + 6 = 0**
- Multiply to 6, add to −5: **−2 and −3**
- (x − 2)(x − 3) = 0
- So **x = 2** or **x = 3** (a product is 0 only if one part is 0)

**The discriminant** b² − 4ac tells how many real answers: positive → 2, zero → 1, negative → 0.

**Quadratic formula:** x = (−b ± √(b² − 4ac)) ÷ 2a`,
    quiz: [
      Q('x² + 7x + 12 = 0. The solutions are …', ['3 and 4', '−3 and −4', '−3 and 4'], 1),
      Q('x² − 9 = 0. The larger solution is …', ['3', '9', '81'], 0),
      Q('b² − 4ac is negative. How many real solutions?', ['0', '1', '2'], 0),
    ],
  },
  {
    id: 'm-8-exponents',
    subject: 'math',
    grade: 8,
    topic: 'Algebra II',
    title: 'Exponent rules and logarithms',
    body: `- **Multiply** same base → **add** exponents: x³ · x⁴ = x⁷
- **Divide** → **subtract**: x⁶ ÷ x² = x⁴
- **Power of a power** → **multiply**: (x²)³ = x⁶
- x⁰ = 1 · x⁻² = 1/x²

A **logarithm** asks "what power?": **log₂ 8 = 3** because 2³ = 8.
- log₁₀ 1000 = 3 · log₅ 25 = 2`,
    quiz: [
      Q('x² · x⁵ = ?', ['x⁷', 'x¹⁰', 'x³'], 0),
      Q('log₃ 81 = ?', ['3', '4', '27'], 1),
      Q('(x³)² = ?', ['x⁵', 'x⁶', 'x⁹'], 1),
    ],
  },
  {
    id: 'm-9-pythagoras',
    subject: 'math',
    grade: 9,
    topic: 'Geometry',
    title: 'The Pythagorean theorem',
    body: `In a **right triangle** (one 90° corner), the two short sides are **legs** (a, b) and the long side across from the right angle is the **hypotenuse** (c).

**a² + b² = c²**

Legs 3 and 4: 9 + 16 = 25 → c = √25 = **5**

Common sets: **3-4-5, 5-12-13, 8-15-17** (and their multiples, like 6-8-10).

**Distance between two points** is the same idea: √((x₂ − x₁)² + (y₂ − y₁)²).`,
    quiz: [
      Q('Legs 6 and 8. Hypotenuse?', ['10', '14', '12'], 0),
      Q('Hypotenuse 13, one leg 5. Other leg?', ['8', '12', '18'], 1),
      Q('Which side is the hypotenuse?', ['the shortest', 'across from the right angle'], 1),
    ],
  },
  {
    id: 'm-9-angles',
    subject: 'math',
    grade: 9,
    topic: 'Geometry',
    title: 'Angles, triangles and polygons',
    body: `- **Complementary** angles add to **90°**; **supplementary** add to **180°**.
- Angles in a **triangle** add to **180°**.
- **Vertical angles** (across from each other where lines cross) are **equal**.
- Inside angles of a polygon with n sides add to **(n − 2) × 180°**. A hexagon: 4 × 180 = 720°.
- **Circles:** circumference = 2πr; area = πr².`,
    quiz: [
      Q('A triangle has angles 50° and 60°. The third?', ['70°', '80°', '90°'], 0),
      Q('The supplement of 110° is …', ['70°', '20°', '250°'], 0),
      Q('Inside angles of a pentagon (5 sides) add to …', ['360°', '540°', '720°'], 1),
    ],
  },
  {
    id: 'm-10-sohcahtoa',
    subject: 'math',
    grade: 10,
    topic: 'Trigonometry',
    title: 'SOH-CAH-TOA',
    body: `In a right triangle, for an angle θ:
- **S**in = **O**pposite ÷ **H**ypotenuse
- **C**os = **A**djacent ÷ **H**ypotenuse
- **T**an = **O**pposite ÷ **A**djacent

The **opposite** side is across from θ; the **adjacent** side is next to it (not the hypotenuse).

**Special angles:** sin 30° = 1/2, cos 60° = 1/2, sin 45° = cos 45° = √2/2, tan 45° = 1.

To find an angle from sides, use the inverse: θ = tan⁻¹(opposite ÷ adjacent).`,
    quiz: [
      Q('Opposite 3, hypotenuse 5. sin θ = ?', ['3/5', '4/5', '3/4'], 0),
      Q('tan 45° = ?', ['0', '1', '√2/2'], 1),
      Q('Which ratio uses adjacent and hypotenuse?', ['sin', 'cos', 'tan'], 1),
    ],
  },
  {
    id: 'm-10-radians',
    subject: 'math',
    grade: 10,
    topic: 'Trigonometry',
    title: 'Radians and the unit circle',
    body: `A full turn is **360°** or **2π radians**. So **180° = π**.

- Degrees → radians: × π/180 (90° = π/2)
- Radians → degrees: × 180/π (π/3 = 60°)

On the **unit circle** (radius 1), a point at angle θ is **(cos θ, sin θ)**.

Signs by quadrant — **A**ll **S**tudents **T**ake **C**alculus:
- I: all positive · II: sin · III: tan · IV: cos`,
    quiz: [
      Q('90° in radians?', ['π/4', 'π/2', 'π'], 1),
      Q('π/6 radians in degrees?', ['30°', '60°', '45°'], 0),
      Q('In quadrant II, which is positive?', ['sin', 'cos', 'tan'], 0),
    ],
  },
  {
    id: 'm-11-sequences',
    subject: 'math',
    grade: 11,
    topic: 'Pre-Calculus',
    title: 'Sequences and series',
    body: `**Arithmetic:** add the same amount **d** each time. 3, 7, 11, 15 … (d = 4)
- nth term: aₙ = a₁ + (n − 1)d
- Sum of n terms: n × (first + last) ÷ 2

**Geometric:** multiply by the same **r** each time. 2, 6, 18, 54 … (r = 3)
- nth term: aₙ = a₁ × rⁿ⁻¹
- Sum of n terms: a₁(rⁿ − 1) ÷ (r − 1)`,
    quiz: [
      Q('5, 8, 11, … the 10th term?', ['32', '35', '29'], 0),
      Q('1, 2, 4, 8, … the 6th term?', ['16', '32', '64'], 1),
      Q('Sum of 1 + 2 + … + 100?', ['5000', '5050', '10100'], 1),
    ],
  },
  {
    id: 'm-11-growth',
    subject: 'math',
    grade: 11,
    topic: 'Pre-Calculus',
    title: 'Exponential growth and logs',
    body: `Something growing by a fixed **percent** each period grows **exponentially**:

**A = P(1 + r)ᵗ** — P is the start, r the rate as a decimal, t the number of periods.
- $1,000 at 5% for 3 years: 1000 × 1.05³ ≈ **$1,157.63**

Logs undo exponents: if bˣ = y then **x = log_b y**.
- log(ab) = log a + log b · log(aⁿ) = n·log a`,
    quiz: [
      Q('$500 doubles twice. How much?', ['$1,000', '$2,000', '$1,500'], 1),
      Q('log₂ 64 = ?', ['5', '6', '8'], 1),
      Q('In A = P(1 + r)ᵗ, 6% means r = …', ['6', '0.6', '0.06'], 2),
    ],
  },
  {
    id: 'm-12-derivatives',
    subject: 'math',
    grade: 12,
    topic: 'Calculus',
    title: 'Derivatives: how fast something changes',
    body: `The **derivative** f′(x) is the **slope** of the curve at a point — how fast f is changing right there.

**Power rule:** the derivative of **xⁿ** is **n·xⁿ⁻¹**.
- d/dx x³ = 3x² · d/dx 5x² = 10x · d/dx 7x = 7 · d/dx 4 = 0

Other rules:
- **Product:** (fg)′ = f′g + fg′
- **Chain:** d/dx f(g(x)) = f′(g(x)) · g′(x)
- d/dx sin x = cos x · d/dx cos x = −sin x

If s(t) is position, s′(t) is **velocity**.`,
    quiz: [
      Q('d/dx x⁴ = ?', ['4x³', 'x³', '4x⁴'], 0),
      Q('f(x) = x² + 3x. f′(2) = ?', ['7', '10', '4'], 0),
      Q('d/dx sin x = ?', ['−cos x', 'cos x', 'sin x'], 1),
    ],
  },
  {
    id: 'm-12-limits-integrals',
    subject: 'math',
    grade: 12,
    topic: 'Calculus',
    title: 'Limits and integrals',
    body: `A **limit** is the value f(x) gets close to as x gets close to something.
- If plugging in gives 0/0, **factor and cancel**: (x² − 4)/(x − 2) = x + 2 → at x = 2 the limit is **4**.
- At infinity, compare the highest powers: same power → divide the numbers in front.

An **integral** adds up area under a curve.
- Antiderivative of **xⁿ** is **xⁿ⁺¹ ÷ (n + 1)**
- ∫ from a to b of f(x) dx = F(b) − F(a)
- ∫ from 0 to 2 of 3x² dx = [x³] from 0 to 2 = 8 − 0 = **8**`,
    quiz: [
      Q('lim x→3 of (x² − 9)/(x − 3) = ?', ['3', '6', '0'], 1),
      Q('Antiderivative of 2x?', ['x²', '2', '2x²'], 0),
      Q('∫ from 0 to 1 of 3x² dx = ?', ['1', '3', '6'], 0),
    ],
  },
];
