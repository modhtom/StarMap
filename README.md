# Interactive Star Map

**Welcome to the Cosmic Experience!** This interactive web app lets you explore the night sky in real time. Customize your celestial view, tweak the stars, and generate your own personalized star map!

- See it live! Check out the interactive star map at [star.modhtom.com](https://star.modhtom.com).

---

## Features

- **What's Up Tonight?** – Instantly see the sky above you with a single click using your device's location.

- **Galactic GPS** – Pick any location on Earth using an interactive map or search bar.

- **Time Machine & Animation** – Set any date and time, or press play to watch the sky animate forward in minutes, hours, or days.

- **Stargazing Tweaks**:

  - Zoom in/out for different fields of view.
  - Customize star brightness and size.
  - Toggle a rich set of overlays:
  - Milky Way: Display the beautiful galactic band.
  - Constellations: Show both the classic lines and official IAU borders.
  - Celestial Grid: Add a Right Ascension and Declination grid for reference.
  - Planets & DSOs: View planets and deep-sky objects.

- **Full Customization:**

  - Change the colors of the background, constellations, DSOs, and the grid.
  - Switch constellation labels between English, Arabic, and default abbreviations.

- **Save Your Sky** – Download your custom star map as a high-resolution PNG.

- **Nerdy Details** – Get real-time latitude, longitude, and local sidereal time for your selected view.

---

## Installation

1. **Clone the repo**:
   ```bash
   git clone https://github.com/modhtom/StarMap.git
   cd StarMap
   ```

---

## How to Use

1. **Select your location** (Yes, even Antarctica works).
2. **Pick a time** (Past, present, future—you’re in control!).
3. **Tweak your view** (Zoom, brightness, labels, constellations—you name it!).
4. **Hit "Generate Star Map"** (Boom! The night sky at your fingertips!).
5. **Download it** (Frame it, flex it, or use it as wallpaper!).

---

## 🤝 Contributing

Got an idea? Found a bug? PRs and issues are welcome!

---

## 🚨 Troubleshooting

**Seeing errors?** Here’s what to check:

- Data files missing? Make sure they’re in the `DATA/` directory.
- Local files not loading? Try running a local server (`python -m http.server`).
- Weird map issues? Ensure your browser supports WebGL and JS.
