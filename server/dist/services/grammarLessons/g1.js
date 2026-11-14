/** 📝 1st grade grammar and language (format: ../mathLessonsParse.ts; the right choice is starred). */
export const G_1 = `
@ common-proper | Nouns | Common and proper nouns
A **common noun** names any person, place or thing: girl, city, dog.
A **proper noun** names a special one and starts with a capital: Emma, Chicago, Rover.

- city → **Boston**
- teacher → **Mr. Lee**
? Which is a proper noun? | *Texas | state | river
? Which is a common noun? | *school | Lincoln School | Ohio
? Which needs a capital? | *maria | girl | sister

@ plural-y | Nouns | More than one: -s, -es
- Most words add **s**: cat → cats
- Words ending in **s, x, ch, sh** add **es**: box → boxes, wish → wishes
? One dress, two … | *dresses | dresss | dress
? One bench, two … | *benches | benchs | bench
? One frog, two … | *frogs | froges | frog

@ possessive-s | Nouns | Whose is it? ('s)
Add **'s** to show something **belongs** to someone.

- the dog**'s** bone (the bone belongs to the dog)
- Mom**'s** car
? The hat that belongs to Sam is … | *Sam's hat | Sams hat | Sam hat
? "The cat's bowl" means … | *the bowl belongs to the cat | many cats | the cat is a bowl
? The toy that belongs to the baby is … | *the baby's toy | the babys toy | the baby toy

@ verb-s | Verbs | He runs, they run
With **one** person or thing, the verb often gets an **s**.

- The dog **runs**. The dogs **run**.
- She **sings**. They **sing**.
? The bird ___. | *sings | sing
? The birds ___. | *sing | sings
? Tom ___ to school. | *walks | walk

@ past-ed | Verbs | Yesterday: adding -ed
To tell about the **past**, add **-ed** to many verbs.

- I **play** today. I **played** yesterday.
- We **jump** now. We **jumped** before.
? Yesterday I ___ my room. (clean) | *cleaned | clean | cleaning
? Last night we ___ a movie. (watch) | *watched | watch | watches
? Which word tells about the past? | *helped | help | helps

@ future-will | Verbs | Tomorrow: will
To tell about the **future**, use **will**.

- Tomorrow I **will** swim.
- Next week we **will** visit Grandma.
? Tomorrow I ___ read. | *will | did | was
? Which tells about the future? | *She will dance. | She danced. | She dances.
? "We ___ go to the zoo next week." | *will | went | go-ed

@ past-future-now | Verbs | Past, present, future
- **Past:** I walked (already happened)
- **Present:** I walk (happens now)
- **Future:** I will walk (will happen)
? "I will eat." is … | *future | past | present
? "I ate." is … | *past | future | present
? "I eat." is … | *present | past | future

@ is-are-1 | Verbs | is and are
Use **is** for one. Use **are** for more than one (and with *you*).

- The cat **is** soft. The cats **are** soft.
- You **are** my friend.
? The apple ___ red. | *is | are
? The apples ___ red. | *are | is
? You ___ funny. | *are | is

@ was-were-1 | Verbs | was and were
Use **was** for one in the past. Use **were** for more than one (and with *you*).

- I **was** hungry. We **were** hungry.
? The dog ___ wet. | *was | were
? The dogs ___ wet. | *were | was
? You ___ late. | *were | was

@ adjectives-1 | Describing words | Adjectives describe nouns
An **adjective** tells **what kind** or **how many**.

- a **fluffy** cat
- **three** ducks
- a **shiny** coin
? "The striped shirt" — the adjective is … | *striped | shirt | the
? Which is an adjective? | *cold | snow | fall
? "Two kites" — which word tells how many? | *Two | kites

@ articles-a-an | Describing words | a or an?
Use **a** before a consonant sound. Use **an** before a vowel sound (a, e, i, o, u).

- **a** dog, **a** cup
- **an** egg, **an** apple, **an** owl
? ___ elephant | *an | a
? ___ banana | *a | an
? ___ igloo | *an | a

@ this-that | Describing words | this, that, these, those
- **this** = one, close: this book (in my hand)
- **that** = one, far: that bird (in the sky)
- **these** = more than one, close
- **those** = more than one, far
? ___ shoes on my feet | *these | those | this
? ___ star far away | *that | this | these
? ___ cookies over there | *those | these | this

@ and-but-or | Sentences | and, but, or
Joining words connect ideas.

- **and** adds: I like cats **and** dogs.
- **but** shows a difference: I like cats, **but** not snakes.
- **or** gives a choice: Do you want milk **or** juice?
? "Do you want red ___ blue?" | *or | and | but
? "I am tired, ___ I want to play." | *but | or | so
? "We sang ___ danced." | *and | or | but

@ so-because | Sentences | so and because
- **because** tells **why**: I wore a coat **because** it was cold.
- **so** tells **what happened next**: It was cold, **so** I wore a coat.
? "I ate lunch ___ I was hungry." | *because | so | or
? "It rained, ___ we stayed inside." | *so | because | or
? Which word tells why? | *because | and | or

@ prepositions-1 | Word meanings | Words that tell where and when
- **Where:** in, on, under, behind, between, above, beside
- **When:** before, after, during
? We wash our hands ___ we eat. | *before | under | beside
? The book is ___ the two pillows. | *between | before | after
? The kite is ___ the trees. | *above | during | after

@ pronouns-1 | Pronouns | Pronouns take the place of nouns
A **pronoun** takes the place of a noun.

- **Lily** has a bike. **She** rides it.
- **The kids** laughed. **They** were happy.
? "Max is tall. ___ plays basketball." | *He | She | They
? "The flowers are pretty. ___ smell good." | *They | It | He
? "The car is fast. ___ is red." | *It | They | She

@ possessive-pronouns | Pronouns | my, your, his, her, our, their
These words show **who owns** something.

- **my** coat, **your** shoe, **his** cap, **her** bag, **our** house, **their** dog
? Lisa has a cat. It is ___ cat. | *her | his | their
? We have a car. It is ___ car. | *our | their | my
? The boys have a ball. It is ___ ball. | *their | his | our

@ i-me-1 | Pronouns | I and me
Use **I** when you are doing the action. Use **me** after action words.

- **I** threw the ball.
- Dad threw the ball to **me**.
? ___ like to paint. | *I | Me
? Please give the cup to ___. | *me | I
? Sam and ___ are friends. | *I | me

@ capital-dates | Capitals | Days, months and holidays
**Days**, **months** and **holidays** start with capitals.

- Monday, July, Thanksgiving, New Year's Day
? Which is right? | *My birthday is in May. | My birthday is in may.
? Which needs a capital? | *halloween | candy | costume
? Which is written right? | *Friday | friday

@ capital-titles | Capitals | Mr., Mrs., Ms. and Dr.
Titles before a name start with a capital and end with a period.

- **Mr.** Brown, **Mrs.** Diaz, **Ms.** Kim, **Dr.** Patel
? Which is written right? | *Dr. Smith | dr Smith | dr. smith
? Which is right? | *Mrs. Lopez | mrs. Lopez | Mrs lopez
? "Mr." is short for … | *Mister | Monster | Mother

@ comma-dates | Punctuation | Commas in dates
Put a **comma** between the day and the year.

- July 4**,** 1776
- May 10**,** 2025
? Which is written right? | *June 5, 2020 | June 5 2020 | June, 5 2020
? Where does the comma go in "March 3 2019"? | *after 3 | after March | after 2019
? Which is right? | *January 1, 2026 | January 1 2026

@ comma-list | Punctuation | Commas in a list
Use **commas** to separate three or more things in a list.

- I like apples**,** pears**,** and grapes.
? Which is right? | *We saw cows, pigs, and goats. | We saw cows pigs and goats.
? How many commas in "red, blue, and green"? | *2 | 1 | 3
? Which list is right? | *pens, paper, and glue | pens paper, and glue

@ sentence-kinds | Sentences | Four kinds of sentences
- **Telling:** The sky is blue.
- **Asking:** Is the sky blue?
- **Exclaiming:** The sky is so blue!
- **Command (telling someone to do something):** Look at the sky.
? "Close the door." is a … | *command | question | exclamation
? "Where is my sock?" is a … | *question | command | telling sentence
? "I love it!" is an … | *exclamation | asking sentence | command

@ expand | Sentences | Make it bigger
Add **who, what, where, when** to make a sentence more interesting.

- The dog ran.
- The **little brown** dog ran **to the park after lunch**.
? Which sentence tells more? | *The cat slept on the warm rug. | The cat slept.
? Which word adds "when"? "We swam in the morning." | *in the morning | We | swam
? Which adds "where"? | *at the beach | quickly | blue

@ compound-words | Words | Compound words
A **compound word** is two words put together.

- sun + flower = **sunflower**
- rain + bow = **rainbow**
- foot + ball = **football**
? cup + cake = | *cupcake | cakecup | cuptake
? Which is a compound word? | *bedroom | bedding | beds
? "starfish" is made of … | *star + fish | sta + rfish | stars + fish

@ contractions-1 | Words | Short words with an apostrophe
A **contraction** squeezes two words together. An **apostrophe** (') takes the place of missing letters.

- do not → **don't**
- I am → **I'm**
- it is → **it's**
? can not → | *can't | cant | ca'nt
? I am → | *I'm | Im | I'am
? we are → | *we're | were | we'r

@ synonyms-1 | Word meanings | Words that mean the same
**Synonyms** are words that mean almost the same.

- big — large
- happy — glad
- fast — quick
? A synonym for "small" is … | *little | huge | tall
? A synonym for "begin" is … | *start | stop | end
? A synonym for "shout" is … | *yell | whisper | sleep

@ antonyms-1 | Word meanings | Words that mean the opposite
**Antonyms** are opposites.

- wet ↔ dry
- full ↔ empty
- loud ↔ quiet
? The antonym of "full" is … | *empty | filled | whole
? The antonym of "loud" is … | *quiet | noisy | big
? The antonym of "early" is … | *late | soon | first

@ shades-1 | Word meanings | Shades of meaning
Some words are alike but **stronger** or **weaker**.

- look → stare
- cold → freezing
- like → love
? Which is the strongest? | *furious | upset | grumpy
? Which is hotter? | *boiling | warm
? Which means to look for a long time? | *stare | glance | peek

@ abc-order | Words | ABC order
Put words in **ABC order** by their first letter.

- **a**pple, **b**all, **c**at
? Which comes first in ABC order? | *bat | cat | rat
? Which comes last? | *zoo | moon | ant
? Put in order: dog, cow, bee | *bee, cow, dog | cow, bee, dog | dog, cow, bee

@ digraph-sh-ch | Sounds | sh and ch
Two letters can make **one sound**.

- **sh**: ship, fish, shoe
- **ch**: chin, lunch, chair
? Which word has the sh sound? | *shell | chill | sell
? Fill in: lun__ | *ch | sh | th
? Fill in: __ip (a boat) | *sh | ch | wh

@ digraph-th-wh | Sounds | th and wh
- **th**: this, bath, three
- **wh**: what, when, whale
? Fill in: __ale (a big sea animal) | *wh | th | sh
? Fill in: ba__ | *th | wh | ch
? Which word starts with wh? | *where | there | share

@ blends | Sounds | Blends: two sounds together
In a **blend**, you hear both letters.

- **bl**ock, **fr**og, **st**op, **sn**ail, **tr**ee
? Fill in: __og (a green hopper) | *fr | st | bl
? Fill in: __ee (it has leaves) | *tr | sn | fl
? Which word starts with a blend? | *stop | top | pot

@ silent-e | Sounds | Magic e
An **e** at the end can make the vowel say its **name**.

- cap → cap**e**
- kit → kit**e**
- hop → hop**e**
? cub + e = | *cube | cubbe | cub
? Which word has a magic e? | *bike | bit | bin
? tap + e = | *tape | tapp | tap

@ vowel-teams-1 | Sounds | ee, ea, ai, ay, oa
Two vowels together often say the **first one's name**.

- **ee**: see, tree
- **ai**: rain, tail
- **ay**: play, day
- **oa**: boat, road
? Fill in: r__n (water from clouds) | *ai | oa | ee
? Fill in: b__t (it floats) | *oa | ai | ee
? Fill in: tr__ | *ee | ay | oa

@ ing-endings | Words | Adding -ing
Add **-ing** to show an action happening now.

- jump → jump**ing**
- read → read**ing**
- For short words ending in one vowel + one consonant, double it: run → ru**nn**ing, sit → si**tt**ing
? Add -ing to "swim" | *swimming | swiming | swimeing
? Add -ing to "eat" | *eating | eatting | eting
? Add -ing to "hop" | *hopping | hoping | hopeing

@ root-words | Words | Root words
A **root word** is the main word before endings are added.

- jump**ed**, jump**ing**, jump**s** → root: **jump**
? The root of "looking" is … | *look | looked | king
? The root of "helps" is … | *help | helped | elps
? The root of "played" is … | *play | lay | plays

@ question-words-1 | Sentences | Who, what, where, when, why, how
- **Who** → a person
- **What** → a thing
- **Where** → a place
- **When** → a time
- **Why** → a reason
- **How** → the way
? "___ did you get here?" (by bus) | *How | Who | Where
? "___ are you crying?" (a reason) | *Why | When | What
? "___ is your teacher?" (a person) | *Who | Where | How

@ end-marks-1 | Punctuation | Choose the end mark
- **.** for telling and commands
- **?** for asking
- **!** for strong feelings
? "Watch out" (a warning) | *! | ? | .
? "How old are you" | *? | . | !
? "My shirt is green" | *. | ? | !

@ complete-1 | Sentences | Complete sentences
A complete sentence has a **naming part** (who or what) and a **telling part** (what happens).

- **The big truck** | **beeped loudly**.
? Which is a complete sentence? | *The baby laughed. | The baby. | Laughed loudly.
? What is missing? "Ran to the bus." | *who ran | what happened | the end mark
? What is missing? "My little sister." | *what she did | who | a capital

@ singular-plural-nouns | Nouns | Words that change for more than one
Some words don't add -s; they **change**.

- man → **men**
- child → **children**
- foot → **feet**
- mouse → **mice**
? One child, two … | *children | childs | childes
? One tooth, two … | *teeth | tooths | toothes
? One mouse, three … | *mice | mouses | mousies

@ verbs-irregular-1 | Verbs | Past words that change
Some verbs don't add -ed. They **change**.

- run → **ran**
- see → **saw**
- eat → **ate**
- go → **went**
? Yesterday I ___ (go) to school. | *went | goed | gone
? Last night we ___ (eat) pizza. | *ate | eated | eat
? I ___ (see) a rainbow. | *saw | seed | seen

@ months-order | Capitals | The months
There are **12 months**. They start with a capital.

January, February, March, April, May, June, July, August, September, October, November, December
? Which month comes after March? | *April | May | February
? How many months are in a year? | *12 | 7 | 10
? Which is written right? | *October | october | OCTober

@ describe-how | Describing words | Words that tell how
Some words tell **how** an action is done. Many end in **-ly**.

- She sang **softly**.
- He ran **quickly**.
? "The turtle walked slowly." Which word tells how? | *slowly | walked | turtle
? Which word tells how? | *loudly | loud | noise
? "The baby slept ___." (no noise) | *quietly | loudly | quickly

@ word-sort-1 | Words | Noun, verb or adjective?
- **Noun:** names a person, place or thing (cat)
- **Verb:** an action (jump)
- **Adjective:** describes a noun (fuzzy)
? "fuzzy" is a … | *adjective | noun | verb
? "kitchen" is a … | *noun | verb | adjective
? "climb" is a … | *verb | noun | adjective

@ multiple-meaning-1 | Word meanings | One word, two meanings
Some words have **more than one meaning**.

- **bat**: an animal that flies, or a stick for baseball
- **bark**: a dog's sound, or the outside of a tree
? "The tree has rough bark." Bark means … | *the outside of a tree | a dog sound
? "The bat flew at night." Bat means … | *an animal | a baseball stick
? "I can see the ring on her finger." Ring means … | *jewelry | a bell sound

@ letter-parts | Writing | Writing a friendly letter
A letter has parts:

1. **Greeting:** Dear Grandma,
2. **Body:** what you want to say
3. **Closing:** Love,
4. **Signature:** your name
? "Dear Max," is the … | *greeting | closing | body
? "Your friend, Lily" is the … | *closing and signature | greeting | body
? The main message is the … | *body | greeting | closing

@ order-words | Writing | First, next, then, last
Order words help tell **steps** or a story in order.

- **First**, get the bread. **Next**, add peanut butter. **Then** add jam. **Last** (or **Finally**), eat it!
? Which word starts the steps? | *First | Last | Then
? Which word ends the steps? | *Finally | First | Next
? "___, put on your socks. Then put on your shoes." | *First | Last | Finally
`;
