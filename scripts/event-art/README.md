# Weekly event icons

`events.py` draws one 16 x 16 icon for each kind of weekly event in `game/events.json` (race,
festival, bloom, bosses, bounty, training, gold, season) and writes them to
`ui/art/events/<kind>.png` at 32 x 32. The pixels are written by hand in the script; it needs
nothing but Python 3.

```bash
python3 scripts/event-art/events.py
```

`npm run check` fails when a kind has no icon.
