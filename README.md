# Lumen One — VR headset concept site

A minimalist, Apple-style product page for **Lumen One**, a fictional standalone mixed-reality headset. Scroll the hero and the headset turns and comes apart into an exploded view of its components; stop scrolling and the film stops, scroll up and it plays backward.

> Concept project. Lumen One is not a real product, and all specifications and prices are illustrative.

## Features

- **Scroll-scrubbed hero film**: 145 frames drawn to a `<canvas>` and driven by GSAP ScrollTrigger, with Lenis smooth scrolling.
- **Six glass callouts** that appear on the exploded view, anchored to each part.
- **"What it supports"** bento grid, **Inside** component cards, **Specs** tabs with a sliding indicator, **Compare** plans with an animated storage/price toggle, FAQ and a sticky glass buy bar.
- White + Burberry palette (`#0404CD`, `#543025`, `#9D8F8A`) with Apple neutrals and glass UI.
- Reduced-motion support: no scrubbing, the exploded view and labels shown as a still.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

```bash
npm run build
```

The production build goes to `dist/`.

## Stack

Vite · TypeScript · GSAP + ScrollTrigger · Lenis · plain CSS.

## How the visuals were made

- Product film: generated with Seedance 2.5 on Higgsfield (start frame → exploded end frame), then AI-upscaled locally to 2560×1440 with [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN).
- Stills and close-ups: generated with GPT Image 2.6 on Higgsfield.
- Frames cut and encoded to WebP with ffmpeg.
