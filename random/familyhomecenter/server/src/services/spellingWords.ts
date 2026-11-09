/**
 * 🔤 Spelling words by grade (0 = Kindergarten … 12). Each line: word | a sentence using it | what it
 * means. Sentences and meanings avoid giving the spelling away beyond the word itself. Grade levels
 * follow common US school spelling lists (sight words and short vowels early on, then blends,
 * vowel teams, prefixes/suffixes, and finally the long academic words of high school).
 * To add words: add a line to that grade (here or in spellingMore*.ts — about 200 a grade). A round
 * picks 10 at random.
 */
import { MORE_1, MORE_2, MORE_K } from './spellingMoreK2.js';
import { MORE_3, MORE_4, MORE_5 } from './spellingMore35.js';
import { MORE_6, MORE_7, MORE_8 } from './spellingMore68.js';
import { MORE_10, MORE_11, MORE_12, MORE_9 } from './spellingMore912.js';

export interface SpellingWord {
  word: string;
  sentence: string;
  meaning: string;
}

export const GRADE_NAMES = ['Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade', '6th grade', '7th grade', '8th grade', '9th grade', '10th grade', '11th grade', '12th grade'];

const RAW: string[] = [
  // Kindergarten
  `cat|The cat sat on the mat.|a small furry pet that says meow
dog|My dog likes to run in the park.|a pet that barks and wags its tail
sun|The sun is hot and bright today.|the big star that lights up the day
hat|Put on your hat before we go outside.|something you wear on your head
run|I can run very fast.|to move quickly on your feet
big|An elephant is a big animal.|large, not small
red|Apples can be red or green.|the color of a fire truck
mom|My mom reads me a story at night.|another word for mother
dad|Dad made pancakes for breakfast.|another word for father
bed|I sleep in my bed.|the soft place where you sleep
pig|The pig rolled in the mud.|a farm animal that says oink
cup|Fill the cup with water.|a small container you drink from
box|The toys are in the box.|a container with flat sides
fox|A fox has a bushy tail.|a wild animal like a small dog with a bushy tail
hen|The hen laid an egg.|a mother chicken
sit|Please sit on the rug.|to rest on your bottom
top|The bird is on top of the tree.|the highest part of something
map|We looked at a map to find the way.|a drawing that shows where places are
bus|We ride the bus to school.|a big vehicle that carries many people
fun|We had fun at the beach.|a good, happy time
yes|Yes, you may have a cookie.|the opposite of no
see|I can see the moon.|to look at with your eyes
can|I can jump high.|to be able to
go|Let's go to the park.|to move from one place to another
up|The balloon went up into the sky.|toward the sky
my|This is my book.|belonging to me
we|We are friends.|you and me together
and|I like milk and cookies.|a word that joins things together
look|Look at the pretty butterfly.|to point your eyes at something
play|Can you come out to play?|to have fun with toys or games`,
  // 1st grade
  `jump|The frog can jump into the pond.|to push off the ground into the air
fish|The fish swims in the bowl.|an animal that lives and swims in water
ship|The ship sailed across the sea.|a big boat
frog|A green frog sat on the lily pad.|a small jumping animal that says ribbit
duck|The duck quacked at us.|a bird that swims and says quack
milk|I drink milk with my lunch.|a white drink that comes from cows
nest|The bird built a nest in the tree.|a home that birds make out of twigs
hand|Raise your hand to ask a question.|the part of your body at the end of your arm
sand|We built a castle in the sand.|tiny bits of rock found at the beach
tree|The tree has green leaves.|a tall plant with a trunk and branches
green|Grass is green.|the color of leaves and grass
sleep|Babies sleep a lot.|to rest with your eyes closed
rain|The rain made puddles.|water that falls from clouds
play|We play tag at recess.|to have fun with a game
day|Today is a sunny day.|the time when it is light outside
boat|We rowed the boat across the lake.|something that floats and carries people on water
coat|Wear your coat because it is cold.|a warm jacket
bike|I ride my bike to the park.|a thing with two wheels that you pedal
kite|The kite flew high in the wind.|a toy that flies on a string in the wind
home|We walked home after school.|the place where you live
cake|We ate cake at the party.|a sweet baked dessert
snake|The snake slid through the grass.|a long animal with no legs
night|The stars come out at night.|the dark time after the day ends
light|Turn on the light, please.|what makes things bright so you can see
said|She said hello to me.|told with words
come|Come and sit with me.|to move toward someone
they|They are my best friends.|those people
was|The cat was very sleepy.|happened before; a past form of is
were|We were at the zoo yesterday.|a past form of are
what|What is your name?|a word used to ask about something`,
  // 2nd grade
  `because|I wore boots because it was raining.|for the reason that
again|Please read the story again.|one more time
friend|My friend shared her snack with me.|someone you like and trust
happy|The puppy looks happy.|feeling glad
mouse|The mouse ate the cheese.|a tiny animal with a long tail
cloud|A white cloud floated by.|a fluffy shape in the sky made of water drops
brown|The bear has brown fur.|the color of chocolate or dirt
found|I found my lost shoe.|discovered something you were looking for
house|Our house has a red door.|a building where people live
round|A ball is round.|shaped like a circle
smile|Her smile made me happy.|a happy look on your face
think|I think it will snow.|to use your mind
thank|Thank you for the gift.|to tell someone you are glad for what they did
which|Which color do you like best?|asking about one out of a group
where|Where did you put the keys?|asking about a place
children|The children played on the swings.|more than one child
family|My family eats dinner together.|the people you are related to
mother|My mother sings to me.|a mom
father|My father fixed my bike.|a dad
water|Plants need water to grow.|the clear liquid in rivers and rain
morning|I eat breakfast in the morning.|the early part of the day
garden|We grow tomatoes in our garden.|a place where plants and flowers grow
always|I always brush my teeth before bed.|every time
every|Every student got a sticker.|each one of all
people|Many people came to the parade.|men, women and children
before|Wash your hands before you eat.|earlier than
after|We play after school.|later than
pretty|That is a pretty flower.|nice to look at
little|The little kitten was asleep.|small
school|I learn to read at school.|a place where children go to learn`,
  // 3rd grade
  `beautiful|The sunset was beautiful.|very pretty
different|Each snowflake is different.|not the same
favorite|Pizza is my favorite food.|the one you like best
believe|I believe you can do it.|to think something is true
answer|Do you know the answer?|a reply to a question
enough|We have enough chairs for everyone.|as much as is needed
laugh|The joke made me laugh.|to make sounds because something is funny
through|We walked through the forest.|from one side to the other
thought|I thought about my grandma.|an idea in your mind
caught|She caught the ball.|grabbed something that was thrown
daughter|Their daughter is in third grade.|a girl child of a parent
special|Today is a special day.|different from the usual in a good way
surprise|The party was a surprise.|something you did not expect
important|It is important to be kind.|mattering a lot
remember|Remember to bring your lunch.|to keep something in your mind
question|May I ask a question?|something you ask to find out
village|The village had one small store.|a very small town
measure|Use a ruler to measure the line.|to find out how long or big something is
picture|She drew a picture of a horse.|a drawing, painting or photo
nature|We took a walk in nature.|the outdoors: plants, animals and land
library|I borrowed a book from the library.|a place where you can borrow books
February|My birthday is in February.|the second month of the year
Wednesday|We have art on Wednesday.|the day after Tuesday
neighbor|Our neighbor waved hello.|a person who lives near you
straight|Draw a straight line.|not bent or curved
weight|The weight of the box was ten pounds.|how heavy something is
lightning|We saw lightning during the storm.|a flash of light in the sky in a storm
knowledge|Reading gives you knowledge.|what you know and understand
probably|It will probably rain tomorrow.|most likely
interesting|The museum was interesting.|holding your attention`,
  // 4th grade
  `necessary|Water is necessary for life.|needed
separate|Keep the colors separate.|apart, not together
calendar|Mark the date on the calendar.|a chart of the days and months
government|The government makes laws.|the group that runs a country or state
environment|We should protect the environment.|the natural world around us
temperature|The temperature dropped below freezing.|how hot or cold something is
vegetable|A carrot is a vegetable.|a plant part we eat, like a carrot or bean
probably|We will probably win.|very likely
experience|Camping was a fun experience.|something that happens to you
character|The main character is a brave girl.|a person in a story
discover|Scientists discover new things.|to find something for the first time
adventure|The trip was a big adventure.|an exciting experience
attention|Pay attention to the teacher.|careful listening and watching
continue|Please continue reading.|to keep going
direction|Which direction is north?|the way something is pointing or moving
electricity|The lamp runs on electricity.|power that makes lights and machines work
familiar|That song sounds familiar.|known because you've seen or heard it before
guarantee|I guarantee you will like it.|a promise that something will happen
imagine|Imagine a purple elephant.|to make a picture in your mind
knowledge|She has a lot of knowledge about birds.|what someone knows
mysterious|We heard a mysterious noise.|strange and hard to explain
ocean|Whales live in the ocean.|a huge body of salt water
pleasant|We had a pleasant afternoon.|nice and enjoyable
receive|Did you receive my letter?|to get something
scissors|Cut the paper with scissors.|a tool with two blades for cutting
signal|The coach gave the signal to start.|a sign or sound that tells you something
thousand|There were a thousand people at the game.|ten hundreds
unusual|It was an unusual animal.|not common
weather|The weather is sunny today.|what it is like outside: rain, sun, wind
whole|She ate the whole sandwich.|all of something`,
  // 5th grade
  `accidentally|I accidentally dropped my pencil.|by mistake
achievement|Finishing the race was an achievement.|something good you worked hard to do
ancient|We studied ancient Egypt.|very, very old
apologize|I want to apologize for being late.|to say you are sorry
argument|They had an argument about the game.|a disagreement
average|The average score was eighty.|the usual or middle amount
beginning|The beginning of the book was exciting.|the start
boundary|The river is the boundary between the towns.|a line that marks the edge of an area
certain|Are you certain you locked the door?|sure
committee|The committee planned the fair.|a group chosen to do a job
conscience|My conscience told me to tell the truth.|the feeling inside that tells right from wrong
definitely|I will definitely be there.|for sure
describe|Describe your favorite place.|to tell what something is like
disappear|The magician made the coin disappear.|to go out of sight
embarrass|Don't embarrass me in front of my friends.|to make someone feel shy or ashamed
especially|I love fruit, especially mangoes.|more than usual
exaggerate|Don't exaggerate how big the fish was.|to make something sound bigger than it is
February|It snowed a lot in February.|the second month of the year
foreign|She speaks a foreign language.|from another country
grammar|Good grammar makes writing clear.|the rules of a language
immediately|Come here immediately.|right away
independent|She is very independent.|able to do things on your own
interrupt|Please don't interrupt me.|to stop someone while they are talking
occasion|A birthday is a special occasion.|a special event or time
opportunity|This is a great opportunity.|a chance to do something
recommend|I recommend this book.|to suggest something is good
restaurant|We ate dinner at a restaurant.|a place where you buy and eat meals
rhythm|Clap to the rhythm of the music.|a steady beat
schedule|Check the schedule for practice times.|a plan of when things happen
sincerely|I sincerely thank you.|truly and honestly`,
  // 6th grade
  `abundant|Fish are abundant in this lake.|more than enough; plentiful
accommodate|The hotel can accommodate fifty guests.|to have room for, or to help fit someone's needs
acquire|She hopes to acquire new skills.|to get or gain
analyze|Scientists analyze the data.|to study something closely
appreciate|I appreciate your help.|to be thankful for
atmosphere|The atmosphere surrounds the Earth.|the layer of air around a planet
bizarre|The movie had a bizarre ending.|very strange
camouflage|The lizard's camouflage hid it on the rock.|colors or patterns that help something blend in
cemetery|The old cemetery is on the hill.|a place where people are buried
coincidence|It was a coincidence that we wore the same shirt.|things happening together by chance
colleague|My mom's colleague came to dinner.|someone you work with
conscious|He was conscious of the time.|aware; awake and knowing
curiosity|Curiosity helps you learn.|wanting to know or learn
democracy|In a democracy, people vote.|government by the people
dilemma|Choosing between them was a dilemma.|a hard choice between two things
eighth|She is in eighth place.|number eight in order
equipment|Bring your soccer equipment.|the tools or gear needed for something
evidence|The detective found evidence.|facts or things that show something is true
fascinate|Dinosaurs fascinate me.|to hold someone's interest strongly
hypothesis|Our hypothesis was that plants grow faster in sunlight.|a guess you can test
leisure|I read in my leisure time.|free time
miniature|She built a miniature house.|very small copy of something
mischievous|The mischievous puppy chewed my shoe.|playfully naughty
noticeable|There was a noticeable change.|easy to see
perseverance|Perseverance helped her finish.|not giving up
privilege|Voting is a privilege.|a special right or advantage
pronunciation|Check the pronunciation of the word.|how a word is said
recognize|I didn't recognize you with glasses.|to know someone or something you've seen before
sufficient|We have sufficient food for the trip.|enough
vacuum|Please vacuum the living room.|to clean with a machine that sucks up dirt`,
  // 7th grade
  `acquaintance|He is an acquaintance from school.|someone you know a little
aggressive|The dog was aggressive toward strangers.|ready to attack or argue
allegiance|We pledge allegiance to the flag.|loyalty
anonymous|The gift was from an anonymous donor.|with no name given
apparent|It was apparent that she was tired.|easy to see or understand
benefit|Exercise has many benefits.|something good that helps
bureau|The clothes are in the bureau.|a chest of drawers, or a government office
catastrophe|The flood was a catastrophe.|a terrible disaster
competent|She is a competent swimmer.|able to do something well
consensus|The class reached a consensus.|general agreement
convenient|The store is in a convenient spot.|easy and handy
correspondence|She keeps all her correspondence.|letters or messages sent between people
deceive|Don't try to deceive your friends.|to trick or lie to
deficient|The soil was deficient in nutrients.|not having enough of something
desperate|The lost hiker was desperate for water.|having a great need
dilapidated|The barn was dilapidated.|falling apart from age or neglect
eligible|You are eligible to join the team.|allowed or qualified
exhilarating|The roller coaster was exhilarating.|very exciting
fluorescent|The room had fluorescent lights.|giving off bright, glowing light
gauge|The gauge showed the tank was empty.|a tool that measures something
harass|It is wrong to harass others.|to keep bothering or annoying someone
hygiene|Good hygiene keeps you healthy.|keeping clean to stay healthy
irrelevant|That detail is irrelevant.|not connected to the subject
liaison|She is the liaison between the two groups.|a person who connects or communicates between groups
maintenance|The car needs maintenance.|keeping something in good working order
negotiate|They will negotiate a deal.|to talk to reach an agreement
parallel|The lines are parallel.|side by side and never meeting
persuade|Can I persuade you to stay?|to get someone to agree or do something
reminiscent|The smell was reminiscent of grandma's kitchen.|reminding you of something
susceptible|Young plants are susceptible to frost.|easily affected or harmed`,
  // 8th grade
  `abbreviate|You can abbreviate Street as St.|to shorten a word
accessible|The building is accessible by ramp.|easy to reach or use
acknowledgment|She nodded in acknowledgment.|showing you noticed or accepted something
adolescence|Adolescence is the time between child and adult.|the teenage years
ambiguous|The answer was ambiguous.|could mean more than one thing
annihilate|The storm could annihilate the crops.|to destroy completely
arguably|He is arguably the best player.|it could be argued that
beneficial|Sleep is beneficial for your brain.|helpful and good for you
bureaucracy|The bureaucracy slowed everything down.|a system of many offices and rules
chauffeur|The chauffeur drove them to the airport.|a person paid to drive someone
conscientious|She is a conscientious student.|careful to do things well and right
contemptuous|He gave a contemptuous laugh.|showing you think something is worthless
criticism|He took the criticism well.|pointing out what is wrong
deterrent|The fence is a deterrent to deer.|something that discourages an action
discipline|It takes discipline to practice daily.|self-control and training
entrepreneur|The entrepreneur started a bakery.|someone who starts a business
exuberant|The fans were exuberant after the win.|full of energy and joy
facetious|He was only being facetious.|joking at a serious time
guerrilla|The rebels used guerrilla tactics.|a fighter in a small independent group
harassment|The school does not allow harassment.|repeated bothering or attacking
idiosyncrasy|Humming is his idiosyncrasy.|an unusual personal habit
inoculate|Doctors inoculate people against diseases.|to give a vaccine
irresistible|The cookies were irresistible.|too tempting to refuse
juxtaposition|The juxtaposition of old and new was striking.|placing things side by side to compare
millennium|A millennium is a thousand years.|a period of one thousand years
occurrence|Snow is a rare occurrence here.|something that happens
pharaoh|The pharaoh ruled ancient Egypt.|a king of ancient Egypt
questionnaire|Please fill out the questionnaire.|a list of questions to answer
renaissance|The town had a renaissance of art.|a rebirth or revival
silhouette|We saw her silhouette in the window.|a dark outline against a light background`,
  // 9th grade
  `aberration|The low score was an aberration.|something that is not normal
acquiesce|She had to acquiesce to the rules.|to agree without protest
alleviate|Medicine can alleviate the pain.|to make less severe
benevolent|The benevolent king helped the poor.|kind and generous
cacophony|A cacophony of horns filled the street.|a harsh mix of loud sounds
camaraderie|The team had great camaraderie.|friendship and trust within a group
connoisseur|He is a connoisseur of cheese.|an expert judge of something
deferential|He was deferential to his elders.|showing respect
dichotomy|There is a dichotomy between words and actions.|a split into two opposite parts
ebullient|She was ebullient after the news.|cheerful and full of energy
ephemeral|Fame can be ephemeral.|lasting a very short time
fallacious|The argument was fallacious.|based on a mistaken belief
gregarious|He is gregarious and loves parties.|enjoying the company of others
hierarchy|The army has a strict hierarchy.|a ranking from highest to lowest
impetuous|His impetuous choice caused problems.|acting quickly without thinking
incessant|The incessant rain lasted all week.|never stopping
lethargic|The heat made us lethargic.|sleepy and slow
meticulous|She is meticulous about her notes.|very careful about details
nonchalant|He acted nonchalant about the test.|calm and not worried
obsolete|Floppy disks are obsolete.|out of date; no longer used
paradigm|The discovery changed the paradigm.|a model or way of thinking
precocious|The precocious child read at age three.|showing skills early
quintessential|It was the quintessential summer day.|the perfect example of something
recalcitrant|The recalcitrant mule would not move.|stubborn and hard to control
sagacious|The sagacious judge made a fair ruling.|wise
superfluous|Remove the superfluous words.|more than needed
tenacious|The tenacious player never gave up.|holding on firmly; determined
ubiquitous|Phones are ubiquitous today.|found everywhere
vicarious|She felt vicarious joy at his success.|felt through someone else's experience
whimsical|The garden had whimsical statues.|playful and fanciful`,
  // 10th grade
  `abstinence|He practiced abstinence from sweets.|choosing not to do or have something
accolade|The film won every accolade.|an award or praise
anachronism|A phone in a castle movie is an anachronism.|something out of its proper time
antithesis|Laziness is the antithesis of success.|the exact opposite
belligerent|The belligerent man started a fight.|hostile and ready to fight
clandestine|They held a clandestine meeting.|kept secret
conflagration|The conflagration destroyed the forest.|a huge fire
convalescence|Her convalescence took six weeks.|the time spent getting better after illness
debilitate|The illness can debilitate a person.|to make weak
disparate|They come from disparate backgrounds.|very different
egregious|It was an egregious error.|shockingly bad
equanimity|She faced the news with equanimity.|calmness under stress
exacerbate|Scratching will exacerbate the rash.|to make worse
fastidious|He is fastidious about cleanliness.|very concerned about details and neatness
gratuitous|The scene had gratuitous violence.|uncalled for; not needed
heterogeneous|The class is a heterogeneous group.|made of different kinds
iconoclast|The artist was an iconoclast.|someone who attacks cherished beliefs
inconsequential|The mistake was inconsequential.|not important
lackadaisical|His lackadaisical effort cost the game.|lacking energy or care
magnanimous|The winner was magnanimous.|generous and forgiving
mnemonic|A mnemonic helps you remember the planets.|a trick to help memory
nefarious|The villain had a nefarious plan.|wicked
obsequious|The obsequious waiter bowed again and again.|too eager to please
pernicious|Rumors can have a pernicious effect.|harmful in a sneaky way
pusillanimous|The pusillanimous leader backed down.|cowardly
reconnaissance|The scouts went on reconnaissance.|exploring to gather information
surreptitious|She took a surreptitious glance at her phone.|done secretly
transient|The town has a transient population.|lasting only a short time
unscrupulous|The unscrupulous dealer cheated customers.|having no morals
vociferous|The crowd was vociferous.|loud and forceful`,
  // 11th grade
  `abstemious|He was abstemious with food.|eating and drinking only a little
acrimonious|The divorce was acrimonious.|bitter and angry
admonish|The teacher had to admonish the class.|to warn or scold gently
anomalous|The result was anomalous.|not normal or expected
bourgeois|They lived a bourgeois life.|middle class and conventional
capricious|The weather here is capricious.|changing suddenly without reason
chicanery|The election was full of chicanery.|clever tricks to deceive
circumlocution|His speech was full of circumlocution.|using too many words to avoid the point
connotation|The word has a negative connotation.|a feeling or idea a word suggests
deleterious|Smoking has deleterious effects.|harmful
didactic|The story was too didactic.|meant to teach a lesson
efficacious|The treatment was efficacious.|working well; effective
enervate|The heat would enervate anyone.|to drain of energy
esoteric|The book is full of esoteric facts.|understood by only a few
fortuitous|Our meeting was fortuitous.|happening by lucky chance
hegemony|The empire held hegemony over the region.|leadership or control by one group
impecunious|The impecunious student skipped lunch.|having little or no money
indefatigable|She is an indefatigable worker.|never tiring
intransigent|The intransigent leader refused to compromise.|refusing to change
loquacious|The loquacious guest talked all night.|very talkative
mellifluous|She has a mellifluous voice.|sweet and smooth sounding
obfuscate|Don't obfuscate the facts.|to make unclear on purpose
onomatopoeia|Buzz is an example of onomatopoeia.|a word that sounds like what it means
perfunctory|He gave a perfunctory wave.|done without care or interest
phlegmatic|The phlegmatic guard never panicked.|calm and hard to excite
proclivity|She has a proclivity for music.|a natural liking
sycophant|The king was surrounded by a sycophant or two.|someone who flatters to gain favor
taciturn|The taciturn farmer said little.|not saying much
vacillate|He tends to vacillate between choices.|to keep changing your mind
verisimilitude|The story had verisimilitude.|the look of being real or true`,
  // 12th grade
  `abnegation|Her abnegation of comfort was admirable.|giving up something you want
anathema|Cheating is anathema to him.|something hated
apocryphal|The story is probably apocryphal.|of doubtful truth
bellicose|The bellicose speech worried everyone.|eager to fight
chiaroscuro|The painting used chiaroscuro.|strong contrast of light and dark in art
concupiscence|The novel explores concupiscence.|strong desire
denouement|The denouement tied up every loose end.|the final part of a story where things are resolved
desiccate|The sun will desiccate the fruit.|to dry out completely
encomium|He delivered an encomium for his mentor.|a speech of high praise
epistemology|Epistemology studies how we know things.|the study of knowledge
eschew|She tries to eschew sugar.|to avoid on purpose
excoriate|Critics excoriate the film.|to criticize harshly
grandiloquent|His grandiloquent speech bored the crowd.|using big, showy words
idiosyncratic|Her style is idiosyncratic.|peculiar to one person
inexorable|The inexorable tide came in.|impossible to stop
insouciant|He gave an insouciant shrug.|carefree and unconcerned
legerdemain|The magician's legerdemain amazed us.|sleight of hand; trickery
machination|The plot was full of machination.|a scheming plan
munificent|The munificent donor built a library.|very generous
obstreperous|The obstreperous crowd was noisy.|noisy and hard to control
paucity|There is a paucity of evidence.|a small amount; scarcity
peregrination|His peregrination took him across Asia.|a long journey
perspicacious|The perspicacious detective solved it.|having sharp insight
pulchritude|The poem praised her pulchritude.|physical beauty
recrudescence|There was a recrudescence of the illness.|a breaking out again
sesquipedalian|The professor had a sesquipedalian vocabulary.|using long words
solipsism|His solipsism annoyed his friends.|the view that only oneself matters or exists
supercilious|She gave a supercilious smile.|acting superior to others
vicissitude|They survived every vicissitude.|a change of fortune
xenophobia|The speech warned against xenophobia.|fear or dislike of foreigners`,
];

const parse = (block: string): SpellingWord[] =>
  block
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [word, sentence, meaning] = line.split('|').map((x) => x.trim());
      return { word, sentence, meaning };
    });

/**
 * Is it usable? One word (letters only), its sentence uses that exact word (🔍 Spot the
 * misspellings misspells it there), and the meaning doesn't give it away.
 */
export function wordProblem(w: SpellingWord): string | null {
  if (!w.word || !w.sentence || !w.meaning) return 'missing a part';
  if (!/^[A-Za-z]+$/.test(w.word)) return 'not a single word';
  const tokens = w.sentence.split(/\s+/).map((t) => /^[^A-Za-z]*([A-Za-z']+)[^A-Za-z]*$/.exec(t)?.[1]?.toLowerCase());
  if (!tokens.includes(w.word.toLowerCase())) return 'sentence does not use the word';
  if (new RegExp(`\\b${w.word}\\b`, 'i').test(w.meaning)) return 'meaning gives the word away';
  return null;
}

const MORE = [MORE_K, MORE_1, MORE_2, MORE_3, MORE_4, MORE_5, MORE_6, MORE_7, MORE_8, MORE_9, MORE_10, MORE_11, MORE_12];

// Each grade: its words, then the extra lists (spellingMore*.ts). A word is used once — in the
// lowest grade it's in — and lines that don't pass wordProblem() are left out.
const seenWords = new Set<string>();
export const WORDS: SpellingWord[][] = RAW.map((block, g) =>
  [...parse(block), ...parse(MORE[g] ?? '')].filter((w) => {
    const k = w.word?.toLowerCase();
    if (!k || seenWords.has(k) || wordProblem(w)) return false;
    seenWords.add(k);
    return true;
  })
);

export const GRADE_COUNT = WORDS.length; // 13: K–12
