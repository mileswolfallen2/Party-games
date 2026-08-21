"use strict";

const TRUTHS = {
  mild: [
    "What's the most embarrassing song on your playlist?",
    "What was your last Google search?",
    "What's a food combination you love that everyone thinks is gross?",
    "Who in this room would survive longest in a zombie apocalypse?",
    "What's the weirdest thing you've done to avoid plans?",
    "What's your most irrational fear?",
    "What's the worst haircut you've ever had?",
    "If you could swap lives with anyone here for a day, who and why?",
    "What's the pettiest reason you've ever disliked someone?",
    "What app do you waste the most time on, honestly?",
    "What's your go-to karaoke song?",
    "What's the biggest lie you told as a kid?",
    "What trend did you fall for hard?",
    "What's the strangest compliment you've received?",
    "Which fictional character is your alter ego?"
  ],
  spicy: [
    "What's the most trouble you got into at school or work?",
    "Who was your worst first date, and what happened?",
    "What's a secret talent nobody in this room knows about?",
    "What's the pettiest thing you've done after an argument?",
    "Have you ever stalked someone's profile way too deep? Whose?",
    "What's the most ridiculous thing you've cried about?",
    "What rumor about you turned out to be kind of true?",
    "What's the boldest message you've ever sent someone?",
    "Whose contact name in your phone is the funniest, and what is it?",
    "What's the worst thing you've said by accident in public?",
    "What's a hill you'll die on that everyone here disagrees with?",
    "What's the longest you've gone without sleep, and why?",
    "What purchase over $100 do you regret the most?",
    "What's the most childish thing you still do in private?",
    "If you had to delete one app forever, which and why would it hurt?"
  ],
  wild: [
    "What's the most rebellious thing you've ever done?",
    "Tell us about the time you completely embarrassed yourself in front of a crowd.",
    "What's the craziest thing you've done to impress someone?",
    "What's the most dramatic friendship ending you've experienced?",
    "What's the wildest place you've ever fallen asleep?",
    "What's the biggest secret you've kept from your family?",
    "What's the most absurd excuse you've used to get out of something?",
    "What's the riskiest thing you've ever eaten or drunk?",
    "What's the furthest you've traveled for something silly?",
    "What's the most chaotic thing that happened at your worst party?",
    "What dare from this game would you absolutely refuse, and why?",
    "What's the strangest thing you've convinced someone to believe?",
    "What's the most money you've wasted in one night?",
    "What's the boldest thing you've done with zero planning?",
    "If you had to relive one embarrassing moment on stage right now, which one?"
  ]
};

const DARES = {
  mild: [
    "Do your best impression of another player until they guess who.",
    "Speak only in questions for the next three rounds.",
    "Let the group post any emoji-only text from your phone to a group chat of their choice.",
    "Do 15 jumping jacks while narrating like a sports commentator.",
    "Sing everything you say for the next two rounds.",
    "Show the group your five most recent photos \u2014 no skipping.",
    "Do a dramatic reading of your last text message.",
    "Balance a shoe on your head until your next turn.",
    "Invent a dance move and name it after yourself.",
    "Talk in a whisper for the rest of this round.",
    "Give a heartfelt award-acceptance speech thanking the couch.",
    "Let the player to your left redo your hair however they want.",
    "Act like a tour guide describing this room for one minute.",
    "Say the alphabet backwards \u2014 start over if you slip.",
    "Compliment every player in the room, no repeats."
  ],
  spicy: [
    "Call a friend or family member and explain the plot of a movie badly until they guess it.",
    "Let the group pick your profile picture for 24 hours from your camera roll.",
    "Do your best runway walk down the hallway \u2014 twice.",
    "Text the fifth person in your contacts 'I have a confession...' and show the reply.",
    "Perform a soap opera scene with the player across from you.",
    "Imitate each player until someone laughs.",
    "Read your last five emojis aloud with full emotional backstory.",
    "Let the group add one song to your queue right now.",
    "Reenact a scene from your favorite reality TV moment.",
    "Swap one clothing item with the player on your right for two rounds.",
    "Speak with an accent chosen by the group until your next turn.",
    "Attempt a magic trick; if nobody claps, try again once.",
    "Serenade the snack table. Full commitment required.",
    "Let the group dictate your next social media story.",
    "Do a stand-up comedy set about the person who spun the wheel."
  ],
  wild: [
    "Let the group write a text to anyone in your recents and send it unread.",
    "Perform an interpretive dance of your morning routine.",
    "Keep a running commentary of everything you feel for three rounds, like a nature documentary.",
    "Trade seats with every player, then correctly recall where everyone sat.",
    "Wear your clothes backwards for the rest of the round.",
    "Deliver a eulogy for the nearest household object, then avenge it.",
    "Convince a player to trade one snack item using only charades.",
    "Be the group's personal butler for the next two rounds \u2014 yes sir, no sir included.",
    "Start a conga line. If nobody joins, perform solo with full energy.",
    "Record a voicemail greeting the group approves, and keep it for one day.",
    "Answer every question with a rhyme until your next turn.",
    "Host a fake awards ceremony honoring the room's furniture.",
    "Let the group give you a new name and backstory for the rest of the game.",
    "Do your best weather forecast for tomorrow, outdoors if possible.",
    "Freeze dramatically whenever anyone says your real name for three rounds."
  ]
};
