/** 📝 Kindergarten grammar and language (format: ../mathLessonsParse.ts; the right choice is starred). */
export const G_K = `
@ what-sentence | Sentences | What is a sentence?
A **sentence** is a group of words that tells a whole idea.

✅ The dog runs.
❌ the dog
A sentence tells **who** and **what they do**.
? Which one is a sentence? | *The cat sleeps. | the cat | sleeps
? Which one tells a whole idea? | *I like apples. | apples | like
? A sentence is … | *a whole idea | one letter | a number

@ spaces | Sentences | Spaces between words
We leave a **space** between words so they are easy to read.

✅ I see a bug.
❌ Iseeabug.
Put one finger after a word to make a space!
? Which one has spaces? | *We can run. | Wecanrun. | Wecan run.
? Why do we put spaces between words? | *So we can read them | To make it long | For fun
? How many words: "I see a cat."? | *4 | 3 | 1

@ start-capital | Capitals | Start with a big letter
Every sentence starts with a **capital** (big) letter.

✅ My hat is red.
❌ my hat is red.
? Which sentence starts the right way? | *The sun is hot. | the sun is hot.
? Which letter is a capital? | *B | b
? Fix it: "we play." The first word should be … | *We | we | WE

@ end-period | Punctuation | The period ends it
A **period** (.) is a little dot at the end of a telling sentence.

✅ I have a dog.
It tells the reader: **stop, this idea is done**.
? Which one ends with a period? | *I am six. | I am six | I am six,
? A period looks like … | *. | ? | !
? Where does the period go? | *At the end | At the start | In the middle

@ question-mark | Punctuation | Asking with a question mark
When you **ask** something, end with a **question mark** (?).

✅ Can you play?
✅ Where is my cup?
? Which one needs a question mark? | *Do you like cake | I like cake | The cake is big
? What goes at the end of "What is your name"? | *? | . | !
? A question … | *asks something | tells something | shouts

@ exclaim | Punctuation | Strong feelings: the exclamation mark
Use an **exclamation mark** (!) for a big feeling or a shout.

✅ Wow, a rainbow!
✅ Watch out!
? Which one shows a big feeling? | *We won! | We won. | We won?
? The ! mark is called … | *an exclamation mark | a period | a question mark
? Which one is a shout? | *Stop! | Stop? | stop

@ capital-i | Capitals | I is always big
When you write about yourself with the word **I**, it is always a capital.

✅ Mom and I went out.
❌ Mom and i went out.
? Which is right? | *I can jump. | i can jump.
? Fix it: "Can i go?" | *Can I go? | can I go? | Can i go.
? The word I is always … | *a capital | small | last

@ names-capital | Capitals | Names start with a big letter
People's names start with a **capital** letter.

✅ Sam, Mia, Grandma Rose
❌ sam, mia
Your name starts with a capital too!
? Which name is written right? | *Lily | lily | lILY
? Which needs a capital? "my friend ben is here." | *ben | friend | here
? Is your name a special word that needs a capital? | *Yes | No

@ noun-person | Nouns | Naming words: people
A **noun** is a naming word. Some nouns name **people**.

- mom, dad, teacher, baby, girl, boy, doctor
? Which word names a person? | *teacher | run | blue
? Which word names a person? | *baby | jump | big
? A naming word is called a … | *noun | verb | color

@ noun-place | Nouns | Naming words: places
Some nouns name **places**.

- home, school, park, zoo, store, beach
? Which word names a place? | *park | happy | eat
? Which word names a place? | *school | dog | red
? "We went to the zoo." The place is … | *zoo | went | we

@ noun-thing | Nouns | Naming words: things and animals
Some nouns name **things** or **animals**.

- ball, cup, book, cat, fish, tree
? Which word names a thing? | *ball | sing | soft
? Which word names an animal? | *cat | sit | sad
? "The fish swims." The noun is … | *fish | swims | the

@ plural-s | Nouns | One and more than one
For **more than one**, we often add **s**.

- one cup → two cup**s**
- one bug → three bug**s**
? One dog, two … | *dogs | dog | doges
? Which means more than one? | *hats | hat
? Five … | *cars | car | a car

@ plural-es | Nouns | Adding -es
Words that end in **s, x, sh, ch** add **es** for more than one.

- bus → bus**es**
- box → box**es**
- dish → dish**es**
? One fox, two … | *foxes | foxs | fox
? One bus, two … | *buses | buss | bus
? One lunch, two … | *lunches | lunchs | lunch

@ verbs-action | Verbs | Action words
A **verb** is an action word. It tells what someone **does**.

- run, jump, eat, sing, hop, swim
? Which word is an action? | *jump | cup | red
? "The frog hops." The action word is … | *hops | frog | the
? Which one can you do? | *clap | table | green

@ verbs-more | Verbs | Is it a doing word?
Try it: can you **do** the word? Then it is a verb.

- I can **read**. ✅ (read is a verb)
- I can **chair**. ❌ (chair is a thing)
? Which is a verb? | *swim | fish | pool
? Which is a verb? | *draw | paper | pencil
? Which is NOT a verb? | *hat | kick | run

@ describe-color | Describing words | Color words
**Describing words** tell more about a noun. Color words describe!

- a **red** apple
- the **blue** sky
- a **green** frog
? "The yellow duck" — which word describes? | *yellow | duck | the
? Which is a color word? | *purple | run | cat
? Grass is … | *green | blue | pink

@ describe-size | Describing words | Big and small words
Some describing words tell **size**.

- a **big** bear
- a **tiny** ant
- a **tall** tree
? Which word tells size? | *huge | sing | box
? An ant is … | *small | giant | tall
? "A long snake" — which word describes? | *long | snake | a

@ describe-feel | Describing words | Feeling words
Feeling words describe how someone feels.

- happy, sad, mad, scared, tired, excited
? It is my birthday! I feel … | *happy | sad | tired
? Which is a feeling word? | *scared | jump | cup
? After a long day I feel … | *tired | blue | tall

@ describe-senses | Describing words | Words for our senses
We describe how things **look, sound, feel, smell and taste**.

- soft kitten, loud drum, sweet candy, stinky sock
? Candy tastes … | *sweet | loud | soft
? A drum sounds … | *loud | sweet | furry
? A kitten feels … | *soft | sour | loud

@ opposites | Word meanings | Opposites
**Opposites** mean the very different thing.

- hot ↔ cold
- up ↔ down
- big ↔ little
? The opposite of hot is … | *cold | warm | sun
? The opposite of up is … | *down | top | sky
? The opposite of happy is … | *sad | glad | fun

@ opposites-2 | Word meanings | More opposites
- open ↔ closed
- fast ↔ slow
- day ↔ night
- in ↔ out
? The opposite of fast is … | *slow | quick | run
? The opposite of day is … | *night | sun | morning
? The opposite of in is … | *out | on | inside

@ position | Word meanings | Where is it?
Some words tell **where** something is.

- **in** the box, **on** the table, **under** the bed
- **over** the hill, **next to** the door, **behind** the tree
? The cat is ___ the bed (below it). | *under | over | on
? The ball is ___ the box (inside it). | *in | under | behind
? The bird flies ___ the house (above it). | *over | under | in

@ question-words | Sentences | Question words
Questions often start with: **who, what, where, when, why, how**.

- **Who** is that? (a person)
- **Where** is my hat? (a place)
- **When** is lunch? (a time)
? To ask about a place, use … | *Where | Who | When
? To ask about a person, use … | *Who | What | How
? To ask about a time, use … | *When | Where | Who

@ telling-asking | Sentences | Telling or asking?
A **telling** sentence ends with a period. An **asking** sentence ends with a question mark.

- I like red. (telling)
- Do you like red? (asking)
? "Is it raining?" is … | *asking | telling
? "The rain is cold." is … | *telling | asking
? "Can we go" needs a … | *? | .

@ and-join | Sentences | Joining with "and"
The word **and** joins words or ideas.

- I like milk **and** cookies.
- Sam ran **and** Mia hopped.
? Fill in: "salt ___ pepper" | *and | the | is
? Which joins two things? | *cats and dogs | cats dogs | cats, the dogs
? "I jump and I ___." Which fits? | *spin | blue | cup

@ he-she-they | Pronouns | He, she, it and they
We can use small words instead of names.

- Tom → **he**
- Ann → **she**
- the ball → **it**
- Tom and Ann → **they**
? "Mia is fast." Mia → | *She | He | It
? "The box is big." The box → | *It | She | They
? "Ben and Max play." Ben and Max → | *They | He | It

@ i-me-we | Pronouns | Words for me and us
- **I** am talking about me.
- **We** means me and others.
- **you** means the person I talk to.
? Me and my class → | *we | I | you
? Just me → | *I | we | they
? "Do ___ want a snack?" (asking a friend) | *you | I | we

@ rhyme | Sounds | Words that rhyme
Rhyming words **end with the same sound**.

- cat, hat, bat
- dog, log, frog
? Which rhymes with cat? | *mat | cup | car
? Which rhymes with log? | *frog | leg | lip
? Which rhymes with bee? | *tree | bug | bat

@ syllables | Sounds | Clapping word parts
Words have **parts** called syllables. Clap them!

- cat = 1 clap
- tur·tle = 2 claps
- but·ter·fly = 3 claps
? How many claps in "apple" (ap·ple)? | *2 | 1 | 3
? How many claps in "dog"? | *1 | 2 | 3
? How many claps in "banana" (ba·na·na)? | *3 | 2 | 1

@ first-sound | Sounds | The first sound
Listen to the **first sound** of a word.

- **b**all, **b**ed, **b**ug all start with b
- **s**un, **s**ock start with s
? Which starts like "map"? | *moon | sun | cup
? Which starts like "top"? | *ten | pig | dog
? "Fish" starts with … | *f | s | h

@ last-sound | Sounds | The last sound
Now listen to the **last sound**.

- ca**t**, ho**t**, ne**t** end with t
- bu**s**, ye**s** end with s
? "Dog" ends with … | *g | d | o
? Which ends like "hat"? | *pot | pan | pig
? "Bus" ends with … | *s | b | u

@ short-a | Sounds | The short a sound
Short **a** says /a/ as in **apple**.

- cat, map, bag, hat, van
? Which has the short a sound? | *bat | bit | but
? Fill in: c_t (a pet that meows) | *a | i | o
? Which word is a short a word? | *jam | jet | jog

@ short-e | Sounds | The short e sound
Short **e** says /e/ as in **egg**.

- bed, red, ten, pet, hen
? Which has the short e sound? | *net | nut | not
? Fill in: b_d (you sleep in it) | *e | a | u
? A hen is a … | *chicken | dog | fish

@ short-i | Sounds | The short i sound
Short **i** says /i/ as in **igloo**.

- pig, sit, big, fin, lip
? Which has the short i sound? | *pin | pan | pen
? Fill in: p_g (an animal that oinks) | *i | e | a
? Which word is a short i word? | *dig | dog | dug

@ short-o | Sounds | The short o sound
Short **o** says /o/ as in **octopus**.

- dog, hot, pot, box, mop
? Which has the short o sound? | *top | tap | tip
? Fill in: b_x (you put toys in it) | *o | a | i
? Which word is a short o word? | *fox | fix | fax

@ short-u | Sounds | The short u sound
Short **u** says /u/ as in **umbrella**.

- sun, bug, cup, run, mud
? Which has the short u sound? | *bug | bag | big
? Fill in: s_n (it shines in the sky) | *u | i | a
? Which word is a short u word? | *hut | hat | hot

@ word-family-at | Sounds | The -at family
Change the first letter to make new **-at** words.

- c**at**, h**at**, b**at**, m**at**, r**at**, s**at**
? Which is an -at word? | *sat | sit | set
? h + at = | *hat | hit | hot
? Which is NOT an -at word? | *cap | fat | pat

@ word-family-an | Sounds | The -an and -in families
- c**an**, f**an**, m**an**, p**an**, v**an**
- p**in**, w**in**, f**in**, t**in**
? f + an = | *fan | fin | fun
? Which is an -in word? | *win | wan | won
? Which is an -an word? | *ran | rin | run

@ sight-the-a | Sight words | the, a, and, is
Some words we just **know by sight**:

- **the** cat, **a** dog, you **and** me, it **is** big
? Which word fits? "___ sun is hot." | *The | Is | And
? Which word fits? "It ___ fun." | *is | the | a
? Which word fits? "mom ___ dad" | *and | is | a

@ sight-see-can | Sight words | I, see, can, like
- **I** see a bird.
- I **can** hop.
- I **like** pie.
? Fill in: "I ___ a frog." (with my eyes) | *see | can | like
? Fill in: "I ___ ice cream." (it's yummy) | *like | see | can
? Fill in: "I ___ run fast." | *can | see | like

@ sight-go-to | Sight words | go, to, my, you, we
- We **go** **to** school.
- This is **my** hat.
- Do **you** want one?
? Fill in: "Let's ___ to the park." | *go | my | you
? Fill in: "That is ___ bike." (it belongs to me) | *my | go | to
? Fill in: "We walk ___ the store." | *to | my | go

@ complete-sentence | Sentences | Does it make sense?
A sentence must **make sense**.

✅ The bird can fly.
❌ The bird can table.
? Which makes sense? | *I eat lunch. | I eat shoe.
? Which makes sense? | *The fish swims. | The fish reads.
? Which word makes sense? "I ride my ___." | *bike | soup | cloud

@ word-order | Sentences | Words in order
Words must be in the right **order**.

✅ I like my dog.
❌ Dog my like I.
? Which is in order? | *We can play. | Can play we. | Play we can.
? Put in order: "cat / The / sleeps" | *The cat sleeps. | Sleeps the cat. | Cat the sleeps.
? Which is in order? | *Mom is home. | Home is Mom is. | Is home Mom.

@ days | Capitals | Days of the week
Days of the week start with a **capital** letter.

- Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
? Which is written right? | *Monday | monday | MONday
? What day comes after Sunday? | *Monday | Friday | Tuesday
? How many days are in a week? | *7 | 5 | 10

@ categories | Word meanings | Words that go together
Some words belong in the same **group**.

- Fruits: apple, banana, grape
- Animals: cat, cow, horse
- Colors: red, blue, green
? Which is a fruit? | *pear | cow | blue
? Which is NOT an animal? | *spoon | pig | duck
? Red, blue and ___ | *green | dog | sock

@ action-or-thing | Verbs | Action or thing?
Some words name a **thing** (noun). Some show an **action** (verb).

- **ball** is a thing. **throw** is an action.
? "kick" is … | *an action | a thing
? "shoe" is … | *a thing | an action
? Which pair is action + thing? | *throw + ball | ball + shoe | run + jump

@ more-less-words | Word meanings | Big, bigger, biggest
Add **-er** to compare two. Add **-est** for the most.

- big, bigg**er**, bigg**est**
- tall, tall**er**, tall**est**
? A mouse is small. An ant is even … | *smaller | smallest | small
? The tallest kid is the … | *most tall | least tall
? fast, faster, ___ | *fastest | fasting | faster

@ shades | Word meanings | Like and almost like
Some words mean almost the same thing, but one is **stronger**.

- walk → march → run
- good → great
- sad → very upset
? Which is stronger than "good"? | *great | okay | bad
? Which is faster than "walk"? | *run | stand | sit
? Which means "very big"? | *giant | little | short

@ verbs-past-k | Verbs | Today and yesterday
Many action words add **-ed** for yesterday.

- Today I **jump**. Yesterday I **jumped**.
- Today I **play**. Yesterday I **played**.
? Yesterday I ___ (walk). | *walked | walk | walking
? Today I ___ (help). | *help | helped
? Yesterday we ___ (play) tag. | *played | play | plays

@ listen-follow | Sentences | Who and what in a sentence
Every sentence has **who** (or what) and **what they do**.

- **The baby** (who) **cries** (what they do).
- **My dog** (who) **barks** (what it does).
? "The bird sings." Who? | *The bird | sings
? "Dad cooks." What does he do? | *cooks | Dad
? "The horse runs." Who? | *The horse | runs

@ write-name | Capitals | Pets and places have names too
Special names of **pets, towns and streets** start with a capital.

✅ My cat Fluffy lives on Oak Street.
? Which is right? | *My dog is named Max. | My dog is named max.
? Which needs a capital? "we live in denver." | *denver | live | in
? Pet names start with … | *a capital | a small letter
`;
