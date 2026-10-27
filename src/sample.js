// A made-up grandmother, Rosa Delgado, and her made-up grandson Leo, so anyone
// can try Marigold without real messages. The chat is written in WhatsApp's
// Android export format. EXPECTED and QUERIES are what scripts/test.mjs and
// the eval page check against.

export const PERSON = {
  name: 'Rosa Delgado',
  short: 'Abuela Rosa',
  relation: 'my grandmother',
  you: 'Leo',
  born: '1941',
  died: '2025',
};

export const CHAT = `14/01/2023, 07:12 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
14/01/2023, 07:12 - Abuela Rosa: Buenos días mijo. Did you eat breakfast? 🙏
14/01/2023, 08:40 - Leo: morning abuela, just coffee
14/01/2023, 08:41 - Abuela Rosa: Coffee is not breakfast mijo. Eat something
14/01/2023, 08:41 - Abuela Rosa: Dios te bendiga ❤️
22/01/2023, 18:03 - Abuela Rosa: It is cold today, ponte un suéter
22/01/2023, 18:30 - Leo: I'm inside abuela lol
22/01/2023, 18:31 - Abuela Rosa: Inside also. Ponte un suéter
02/02/2023, 07:05 - Abuela Rosa: Today is Candelaria, I am making tamales for the family. Come Sunday mijo
02/02/2023, 07:06 - Abuela Rosa: The ones with rajas and cheese that you like
02/02/2023, 12:15 - Leo: I'll be there!! save me 6
02/02/2023, 12:20 - Abuela Rosa: 6 😂 I will save you a dozen
19/02/2023, 07:31 - Abuela Rosa: My roses are coming back already. The red one your abuelo planted
19/02/2023, 07:32 - Abuela Rosa: <Media omitted>
19/02/2023, 09:10 - Leo: so pretty
11/03/2023, 21:45 - Leo: abuela I failed my chemistry exam
11/03/2023, 21:52 - Abuela Rosa: Ay mijo. One exam is not your life
11/03/2023, 21:53 - Abuela Rosa: Everything passes. Todo pasa. You study and you try again
11/03/2023, 21:53 - Abuela Rosa: I am proud of you anyway
11/03/2023, 21:54 - Abuela Rosa: Dios te bendiga mijo, now go to sleep
25/03/2023, 16:20 - Abuela Rosa: They played Pedro Infante on the radio and I cried a little. Your abuelo used to sing Amorcito Corazón to me in the kitchen
25/03/2023, 16:40 - Leo: aww I didn't know that
25/03/2023, 16:42 - Abuela Rosa: Very bad voice 😂 but I loved it
09/04/2023, 08:00 - Abuela Rosa: Feliz Pascua mijo! Did you go to church?
09/04/2023, 10:12 - Leo: happy easter! no 😬
09/04/2023, 10:13 - Abuela Rosa: I prayed for you anyway 🙏
30/04/2023, 19:05 - Abuela Rosa: Call your mother, she misses you. She won't say it but I know
30/04/2023, 19:30 - Leo: ok ok I'll call her tonight
14/05/2023, 09:02 - Leo: Happy Mother's Day abuela ❤️ love you
14/05/2023, 09:04 - Abuela Rosa: Ay mijo thank you. I love you more than all the stars
14/05/2023, 09:04 - Abuela Rosa: Dios te bendiga
03/06/2023, 07:20 - Abuela Rosa: Did you eat? You looked skinny on the video call
03/06/2023, 07:45 - Leo: I eat abuela I promise
03/06/2023, 07:46 - Abuela Rosa: Eat more. I will send you some mole when your tía drives up
21/06/2023, 20:10 - Abuela Rosa: Tell me how is the new job
21/06/2023, 20:30 - Leo: it's good! a bit scary
21/06/2023, 20:32 - Abuela Rosa: Scary is good. It means it matters. Everything passes, the scary also
08/07/2023, 06:58 - Abuela Rosa: The tomatoes are so big this year 🍅 I will make salsa for everybody
08/07/2023, 06:59 - Abuela Rosa: Ponte bloqueador, it is very hot today
23/07/2023, 15:00 - Abuela Rosa: Remember when we went to the beach in Puerto Escondido and you lost your shoe? 😂
23/07/2023, 15:10 - Leo: I was 7 and I still think the ocean took it personally
23/07/2023, 15:12 - Abuela Rosa: The ocean has your shoe forever mijo
12/08/2023, 07:15 - Abuela Rosa: Buenos días mijo. It is your birthday soon, what do you want me to cook
12/08/2023, 07:40 - Leo: the chiles rellenos!! please
12/08/2023, 07:41 - Abuela Rosa: Chiles rellenos it is. And a tres leches cake
19/08/2023, 21:00 - Abuela Rosa: Happy birthday mijo! 26 years. I remember the day you were born, you had so much hair
19/08/2023, 21:01 - Abuela Rosa: Dios te bendiga mijo, always
19/08/2023, 21:20 - Leo: thank you abuela, the chiles were the best
16/09/2023, 18:00 - Abuela Rosa: Viva México! 🇲🇽 I am watching the Grito on the TV
16/09/2023, 18:01 - Abuela Rosa: Your abuelo always cried at the Grito, such a sentimental man
04/10/2023, 07:30 - Abuela Rosa: It is getting cold, ponte un suéter
04/10/2023, 08:00 - Leo: 😂 it's 70 degrees abuela
04/10/2023, 08:01 - Abuela Rosa: For me that is cold
22/10/2023, 17:15 - Abuela Rosa: I am starting the ofrenda for your abuelo this week. I bought the cempasúchil at the mercado
22/10/2023, 17:16 - Abuela Rosa: The marigolds are so orange this year, he would like them
22/10/2023, 18:00 - Leo: can I help this year?
22/10/2023, 18:02 - Abuela Rosa: Yes mijo come Saturday. You can make the papel picado, my hands are too shaky now
27/10/2023, 07:40 - Abuela Rosa: I am making pan de muerto today. The whole house smells like orange blossom
27/10/2023, 07:41 - Abuela Rosa: Come before your cousins eat everything
01/11/2023, 20:30 - Abuela Rosa: Thank you for helping with the ofrenda mijo. Your abuelo is happy, I know it
01/11/2023, 20:31 - Abuela Rosa: I put his cigarettes and his café de olla. He was a terrible man with the cigarettes 😂
01/11/2023, 20:31 - Abuela Rosa: Dios te bendiga
02/11/2023, 21:10 - Abuela Rosa: The ones we remember never die all the way. Remember that mijo
24/11/2023, 10:00 - Abuela Rosa: Did you eat? Thanksgiving is not a day to be skinny
24/11/2023, 10:30 - Leo: I'm on my third plate 🦃
24/11/2023, 10:31 - Abuela Rosa: That is my boy
12/12/2023, 06:45 - Abuela Rosa: Día de la Virgen. I went to the early mass, 5 in the morning, so cold
12/12/2023, 06:46 - Abuela Rosa: I lit a candle for you and your sister
24/12/2023, 22:00 - Abuela Rosa: Feliz Navidad mijo! The tamales are ready, 200 tamales this year 😅
24/12/2023, 22:01 - Abuela Rosa: And champurrado for the children
24/12/2023, 22:30 - Leo: feliz navidad abuela ❤️ save me the green ones
07/01/2024, 08:00 - Abuela Rosa: Buenos días mijo. I found the rosca, I got the baby Jesus so I owe everybody tamales again 😂
21/01/2024, 19:00 - Abuela Rosa: It is so cold, ponte un suéter
21/01/2024, 19:05 - Leo: wearing two 🧥
21/01/2024, 19:06 - Abuela Rosa: Good boy
10/02/2024, 07:20 - Abuela Rosa: I am doing the crossword in the newspaper. What is a 7 letter word for remember? 🤔
10/02/2024, 07:50 - Leo: recall? no that's 6. memorialize is too long. RECOLLECT is 9 lol
10/02/2024, 07:52 - Abuela Rosa: Never mind, I asked your tía. It was "recount"
02/03/2024, 18:00 - Leo: abuela I got the promotion!!!
02/03/2024, 18:02 - Abuela Rosa: AY MIJO 🎉🎉 I knew it. I told everybody at church already
02/03/2024, 18:02 - Abuela Rosa: Dios te bendiga, I am so proud
17/03/2024, 16:00 - Abuela Rosa: Sunday lotería with the señoras, I won 3 times 😎
17/03/2024, 16:01 - Abuela Rosa: Doña Carmen is very angry with me
06/04/2024, 07:10 - Abuela Rosa: Did you eat? You never answer this question mijo
06/04/2024, 07:30 - Leo: avocado toast 🥑
06/04/2024, 07:31 - Abuela Rosa: That is not food, that is a sandwich with no top
28/04/2024, 20:00 - Abuela Rosa: I am watching my telenovela, the bad sister finally got what she deserves 😤
28/04/2024, 20:01 - Abuela Rosa: Don't call now
19/05/2024, 09:00 - Abuela Rosa: The doctor says my heart is tired. Don't worry mijo. Everything passes
19/05/2024, 09:20 - Leo: abuela what do you mean? do you want me to come?
19/05/2024, 09:22 - Abuela Rosa: No no, I am fine, I have my pills. Come in summer like always
19/05/2024, 09:22 - Abuela Rosa: Call your mother, she worries too much
09/06/2024, 07:00 - Abuela Rosa: Buenos días mijo. I dreamed of Oaxaca last night, the house where I grew up with the blue door
09/06/2024, 07:02 - Abuela Rosa: My mother made tlayudas on the comal outside and we ate them standing up
09/06/2024, 08:15 - Leo: you should tell me more about Oaxaca
09/06/2024, 08:20 - Abuela Rosa: When you come in summer. I will tell you everything
13/07/2024, 15:00 - Abuela Rosa: So nice having you here mijo. The house is too quiet when you leave
13/07/2024, 15:01 - Abuela Rosa: Take the mole in the blue container, it is for you
04/08/2024, 07:15 - Abuela Rosa: My roses are tired from the heat like me 😂
04/08/2024, 07:16 - Abuela Rosa: Ponte bloqueador mijo
19/08/2024, 07:00 - Abuela Rosa: Happy birthday mijo! 27! Dios te bendiga, every day of this year
19/08/2024, 07:01 - Abuela Rosa: I sent you a card with the mail
19/08/2024, 08:00 - Leo: got it ❤️ thank you abuela
14/09/2024, 18:30 - Abuela Rosa: Listen to this one, Bésame Mucho, the old version. This was our song, your abuelo and me
14/09/2024, 18:31 - Abuela Rosa: We danced to Bésame Mucho at our wedding in the church of Santo Domingo
14/09/2024, 18:50 - Leo: I'll listen tonight
06/10/2024, 07:20 - Abuela Rosa: It is getting cold. Ponte un suéter mijo
06/10/2024, 07:30 - Leo: I KNEW you would say that 😂
06/10/2024, 07:31 - Abuela Rosa: Because I love you
20/10/2024, 17:00 - Abuela Rosa: Ofrenda time again. This year it's for your abuelo and for my sister Lupe 🕯️
20/10/2024, 17:01 - Abuela Rosa: Lupe loved the guava candies, I need to find them
20/10/2024, 17:30 - Leo: I'll look for them here
27/10/2024, 07:45 - Abuela Rosa: Making the pan de muerto today. Come Saturday for the papel picado, you are the expert now 😉
27/10/2024, 07:46 - Abuela Rosa: And bring your sister
27/10/2024, 08:30 - Leo: we'll be there abuela
02/11/2024, 21:00 - Abuela Rosa: Thank you mijo for the beautiful ofrenda. The ones we remember never die all the way
02/11/2024, 21:01 - Abuela Rosa: Someday you will make one for me. Make the pan de muerto with orange blossom, not the store one 😂
02/11/2024, 21:10 - Leo: don't say that abuela
02/11/2024, 21:11 - Abuela Rosa: It is not sad mijo. It is love. Dios te bendiga
28/11/2024, 10:00 - Abuela Rosa: Did you eat? Happy Thanksgiving mijo, I am thankful for you
24/12/2024, 21:00 - Abuela Rosa: Feliz Navidad! Only 120 tamales this year, my hands are slow 😅 your tía helped
24/12/2024, 21:01 - Abuela Rosa: Champurrado is ready, come
24/12/2024, 21:30 - Leo: on our way!!
19/01/2025, 07:30 - Abuela Rosa: It is cold, ponte un suéter
19/01/2025, 07:31 - Abuela Rosa: And call your mother
19/01/2025, 08:00 - Leo: yes and yes 😂❤️
16/02/2025, 07:00 - Abuela Rosa: I am in the hospital mijo, don't worry, just a check
16/02/2025, 07:30 - Leo: abuela I'm coming this weekend
16/02/2025, 07:31 - Abuela Rosa: Bring me a café de olla from the bakery, the hospital coffee is terrible 😂
09/03/2025, 19:00 - Abuela Rosa: Home again. My roses missed me
30/03/2025, 08:10 - Abuela Rosa: Buenos días mijo. Did you eat?
30/03/2025, 08:30 - Leo: yes! eggs and beans like you taught me
30/03/2025, 08:31 - Abuela Rosa: 🥹 that is my boy
27/04/2025, 18:00 - Abuela Rosa: I am writing down my recipes for you in a notebook. The mole, the tamales, the pan de muerto. So you don't forget
27/04/2025, 18:20 - Leo: abuela that's the best gift
27/04/2025, 18:21 - Abuela Rosa: You will cook for your children some day. Dios te bendiga mijo
18/05/2025, 16:00 - Abuela Rosa: Sunday lotería, I lost everything 😂 Doña Carmen is happy now
15/06/2025, 07:20 - Abuela Rosa: My heart is tired mijo. But I am happy. I had a good life
15/06/2025, 07:21 - Abuela Rosa: Everything passes. The good and the bad. Remember the good
15/06/2025, 08:00 - Leo: I love you abuela. I'm coming next week
15/06/2025, 08:01 - Abuela Rosa: I love you more than all the stars. Dios te bendiga mijo
20/07/2025, 20:00 - Abuela Rosa: Thank you for coming mijo. Pedro Infante on the radio again, your abuelo is saying hello 😊
19/08/2025, 07:05 - Abuela Rosa: Happy birthday mijo, 28. I am so proud of you
19/08/2025, 07:06 - Abuela Rosa: Dios te bendiga, always always
19/08/2025, 07:30 - Leo: thank you abuela ❤️ I'll call you tonight
07/09/2025, 07:10 - Abuela Rosa: Buenos días mijo. Did you eat?
07/09/2025, 07:11 - Abuela Rosa: Ponte un suéter, it's going to rain
07/09/2025, 07:40 - Leo: yes abuela. love you
07/09/2025, 07:41 - Abuela Rosa: Dios te bendiga ❤️`;

// A birthday card she mailed, typed out by Leo.
export const LETTER = {
  title: 'Birthday card, 2024',
  date: '2024-08-15',
  text: `Mijo,

Twenty seven years ago I held you in the hospital and you grabbed my finger so strong. You have not let go since, and I hope you never do.

Your abuelo would be so proud of the man you are. You work hard, you call your mother (sometimes), and you still eat my tamales like a little boy.

Remember, everything passes. The hard days pass and the good days pass too, so you have to enjoy them. Make the coffee with cinnamon the way I showed you and sit down to drink it. Don't drink it walking.

Dios te bendiga mijo, every day of this year.

Your Abuela Rosa`,
};

// Things Leo remembers that never made it into a message.
export const MEMORIES = [
  'Every summer she sat on the back step snapping green beans into a bowl and telling me about Oaxaca, the blue door, the comal in the yard.',
  'She hummed while she cooked and pretended she didn\'t. If you caught her she would say it was the radio.',
  'She kept the papel picado from every Día de Muertos in a shoebox under the bed, flattened between newspaper.',
];

// What a person reading the sample would put on the altar. Used to score the
// offering finder: anything outside this list counts as a wrong offering.
export const EXPECTED = {
  food: ['tamales', 'pan de muerto', 'mole', 'chiles rellenos', 'tres leches', 'tlayudas', 'salsa', 'guava candies', 'rajas', 'rosca'],
  drink: ['café de olla', 'champurrado', 'coffee'],
  music: ['Pedro Infante', 'Amorcito Corazón', 'Bésame Mucho'],
  place: ['Oaxaca', 'Puerto Escondido', 'Santo Domingo', 'mercado', 'church'],
  love: ['roses', 'cempasúchil', 'marigolds', 'crossword', 'lotería', 'telenovela', 'tomatoes', 'papel picado'],
};

// "Listen" queries and a phrase the right message contains.
export const QUERIES = [
  { q: 'when I failed my exam', want: 'One exam is not your life' },
  { q: 'what did she say about her heart', want: 'my heart is tired' },
  { q: 'my grandfather singing', want: 'Amorcito Corazón' },
  { q: 'their wedding song', want: 'Bésame Mucho' },
  { q: 'where she grew up', want: 'blue door' },
  { q: 'her recipes', want: 'writing down my recipes' },
  { q: 'losing my shoe at the beach', want: 'lost your shoe' },
  { q: 'being scared at work', want: 'Scary is good' },
  { q: 'what she wanted on her ofrenda', want: 'Someday you will make one for me' },
  { q: 'playing games with friends', want: 'lotería' },
  { q: 'my promotion', want: 'promotion' },
  { q: 'christmas', want: 'Feliz Navidad' },
];
