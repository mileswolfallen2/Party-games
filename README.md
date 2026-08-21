# Party Games

A zero-dependency collection of five party games that run on one laptop and everyone's phones. Built for couches, kitchens, and county fairs.

```
npm start          # serves on http://localhost:6897
npm test           # runs the full test suite
```

No npm installs. No build step. No frameworks. Just Node's standard library and vanilla JS.

## The Games

### Count the Jar
The classic "guess how many" fundraiser, settled by computer vision instead of cheating. Snap a photo of any candy jar and a server-side counting pipeline estimates the contents -- including beans hidden by overlap. Everyone else guesses; closest wins.

- HSV segmentation + Otsu thresholding + connected components
- Distance-transform peak detection for touching objects
- Hex-lattice subdivision for dense piles
- Coverage-aware correction for occluded beans

### Texas Hold'em
Full No-Limit Hold'em against three house bots with distinct aggression. Includes proper blinds, side pots, all-in run-outs, and uncalled-bet refunds -- plus a built-in tutorial and quiz for total beginners.

### Forehead Charades
Heads-up style charades: hold the phone to your forehead while your team acts out the word. Six decks (Animals, Movies & TV, Actions, Objects, Places, Food), configurable timers, team scoring, and round recaps.

### Truth or Dare
An animated wheel picks the victim; they pick Truth or Dare. Three spice levels (Mild / Spicy / Wild) with 90+ hand-written prompts. No tracking, no accounts, no mercy.

### Reaction Duel
Two players, one split screen. Wait for green, slam your side first. False starts lose instantly. Best of 3/5/7 with millisecond timing.

## Hosting a Party

1. Run `npm start` on any laptop.
2. Open `http://localhost:6897` on the big screen.
3. Click **Show join QR code** -- guests scan it to open the games on their phones.

The QR code encodes whatever URL you set in `public/config.js`. Until you deploy somewhere public, it contains a placeholder:

```js
window.PARTY_CONFIG = { siteUrl: "https://YOUR-PARTY-URL.example.com" };
```

Replace it with your real URL (a LAN IP like `http://192.168.x.x:6897` works great for house parties) and every guest gets a working scannable code.

## Project Structure

```
server.js                  HTTP server + JSON API (port 6897)
public/
  index.html               Game hub + host QR panel
  config.js                Your site URL for the QR code
  qr.js                    Self-contained QR encoder (SVG output)
  styles.css               Shared design system (textures, tickets, blobs)
  lib/
    counter.js             Jar-counting vision pipeline
    poker-engine.js        Hold'em rules, evaluator, betting, side pots
    ai.js                  Bot decision-making
  count-the-jar/           Photo guessing game UI
  poker/                   Poker table UI + tutorial + quiz
  charades/                Forehead charades UI + word decks
  truth-or-dare/           Wheel spinner UI + prompt banks
  reaction/                Reaction duel UI
test/
  run-tests.js             Everything: QR validity, counter accuracy, poker integrity
```

## API

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/health` | GET | Liveness check |
| `/api/count-jar` | POST | `{width, height, data}` where `data` is base64 RGBA pixels. Returns bean count, marker positions, and coverage stats. |

## Testing

```bash
npm test
```

The suite verifies:

- **QR codes** are structurally valid (Reed-Solomon syndromes check across versions/masks)
- **Counter accuracy**: 0% error on sparse jars, within tolerance on dense overlapping piles
- **Poker integrity**: hand rankings, split pots, heads-up blinds, and full multi-hundred-hand simulations where total chips must be conserved exactly

## Contributing

Contributions from everyone are welcome -- bug fixes, new games, better prompts, smarter bots, faster counting. Open an issue or send a pull request. By contributing, you agree your work is licensed under the project license below.

## License

PolyForm Noncommercial License 1.0.0 -- free for anyone to use, modify, and contribute for **noncommercial purposes** (parties, hobbies, education, research). Commercial use by companies requires a separate agreement. See [LICENSE](LICENSE), [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md), and [PRIVACY_POLICY.md](PRIVACY_POLICY.md).
