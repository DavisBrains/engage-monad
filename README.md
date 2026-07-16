Engage

An AI comment assistant with a streak you can't fake, built on Monad.

 The problem

Every morning I scroll LinkedIn to engage with posts.. mutuals, and some good posts from people I don't follow too. It's part routine; warming up the algorithm, staying current with what people in my network are doing. But it eats time. Most LinkedIn posts run standard-length, not massive, but long enough that reading and replying to a handful of them properly takes over an hour some mornings. And that's not the only thing I'm supposed to be doing with my day.

I wanted something that reads the post, gives me the actual gist, and hands me a few comment options that sound like something I'd actually say, not generic engagement-bait. Cuts that hour down to 30-40 minutes. That's 25+ minutes back, daily.

It's not tied to LinkedIn specifically either, works for X or any text-heavy platform where you're writing replies.

 Why on-chain

A habit tool is only useful if you actually stick with it. Most streak trackers live in a local database, a number you could reset, fake, or just quietly stop trusting. Logging each session on Monad instead means the record is real; it's a transaction, not a stat I can edit. If I say I've engaged consistently for 12 days, that's checkable, not just a claim.

 What it does

1. Paste a post's text into the app
2. Get a short summary and three comment suggestions.. varied in approach, no hashtags, no "Great post!" filler
3. Log the session on-chain to keep your streak alive, the contract enforces a minimum gap so you can't spam your way to a fake streak, and resets you if you go more than 2 days without logging

 Tech stack

- Smart contract: Solidity, deployed on Monad Testnet
- Frontend: Plain HTML/CSS/JS, no build step
- AI: Groq API for summarization and comment generation
- Wallet/chain interaction: ethers.js + MetaMask

 Try it

- Live app: https://engage-monad.vercel.app
- Contract address: 0x6B607476A3647f2a2a29aD14F7f364b377af0202 (Monad Testnet)

You'll need your own free Groq API key to use the AI suggestions, grab one at [console.groq.com](https://console.groq.com), paste it into the app's setup section. It's stored only in your browser, never sent anywhere except Groq's API.

 Running it locally

1. Clone this repo
2. Open `index.html` through a local server (opening it directly as a file will block MetaMask from connecting)
3. Make sure MetaMask is set to Monad Testnet
4. Paste in a Groq API key when prompted in the app

Built for the BuildAnything Spark hackathon.
