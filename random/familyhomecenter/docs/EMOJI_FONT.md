# Emoji font on the Pi

Every avatar, chore/to-do icon, Adventure Map icon, and celebration in the app is an **emoji** —
the app saves just the character (say 🧹), and each screen draws it with **its own emoji font**.
Nothing is downloaded to show them. So which emoji look right on the Pi depends on the Pi's emoji
font; a phone or tablet uses its own.

An emoji the font doesn't have shows as an empty box ("tofu"). The emoji pickers check this:
**More emoji…** only lists ones the screen can actually draw, so a newer font simply means more
choices show up there — no change in the app needed.

**Newer is better.** A newer emoji font still has every older emoji, so nothing already picked
changes (some may look slightly redrawn). Chromium on the Pi handles the standard font fine.

## 1. See what the Pi has

On the Pi:

```bash
fc-list | grep -i emoji
dpkg -l fonts-noto-color-emoji | tail -1
```

- **Nothing listed** → there's no color emoji font at all; the browser is borrowing emoji from an
  older black-and-white font, which is why newer ones show as boxes. Do step 2.
- **`fonts-noto-color-emoji` is listed** → note its version. Raspberry Pi OS Bookworm's is from
  around 2023, which covers nearly everything; to get the very newest, do step 3.

## 2. Install the system emoji font (recommended)

```bash
sudo apt update
sudo apt install fonts-noto-color-emoji
fc-cache -f
```

Then restart the kiosk browser (or just reboot the Pi).

## 3. Optional: the very newest emoji

Google's latest Noto Color Emoji, installed for everyone on the Pi alongside the system one:

```bash
sudo mkdir -p /usr/local/share/fonts
sudo wget -O /usr/local/share/fonts/NotoColorEmoji.ttf \
  https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf
fc-cache -f
fc-match -v "Noto Color Emoji" | grep -E 'file|fontversion'
```

The last line shows which file the Pi now uses — it should be the one in `/usr/local/share/fonts`
(when two fonts share a name, the newer version wins). Restart the kiosk browser.

That's a one-time ~10 MB download from Google's official GitHub; nothing about the app or your
family is sent. To undo: `sudo rm /usr/local/share/fonts/NotoColorEmoji.ttf && fc-cache -f`.
