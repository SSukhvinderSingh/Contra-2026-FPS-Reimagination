# Contra-2026-FPS-Reimagination
**Prompt Wars: Virtual | H2S Challenge | Google**

A reimagination of the classic Contra as an AI-powered first-person shooter (FPS). This project is a 5-level web-based game featuring intelligent enemy behavior, dynamic particle systems, and live mission debriefings powered by Generative AI. 

## 🎮 Features
- **5 Progressive Levels**: Ranging from Jungle Outposts to Alien Lairs, each bringing increasing difficulty.
- **AI-Powered Narrative**: Powered by Google's Gemini API, providing dynamic mission briefings and post-mission performance analysis.
- **Dynamic Particle System**: Used for visual enhancements like bullet tracers, explosive sparks, and menu backgrounds.
- **Line-of-Sight & Cover Mechanics**: Enemies and the player utilize walls and pillars realistically, requiring tactical gameplay.

## 🛠️ Tech Stack & How It Was Built
This reimagination was built entirely as a standalone client-side web application for maximum portability and ease of access. 

- **Frontend Core**: Vanilla HTML5, CSS3, and JavaScript (ES Modules).
- **3D Engine**: [Three.js](https://threejs.org/) (imported directly via CDN with no required build step).
- **Rendering**: A blend of WebGL (for 3D environments) and HTML5 `<canvas>` (for 2D particle overlays and HUD).
- **AI Integration**: Direct integration with the **Google Gemini API** for generating contextual dialogue on the fly depending on player performance. 
- **Physics**: Custom mesh-based raycasting for hit detection and line-of-sight verification, ensuring bullets don't pass through solid walls.

## 🚀 How to Run Locally
Because the game uses ES Modules, it needs to be served via a local web server (opening the file directly via `file://` will block cross-origin module loading).

1. Clone this repository.
2. Start a simple local server in the project directory:
   - Python: `python -m http.server 3000`
   - Node: `npx serve -p 3000`
3. Open `http://localhost:3000` in your browser.
4. Obtain a free Gemini API Key from [Google AI Studio](https://aistudio.google.com/) and enter it to deploy your Operative. *(Keys are stored client-side in-memory only and are never saved to disk).*

---
*Red Falcon Never Died. Earth is counting on you.*
