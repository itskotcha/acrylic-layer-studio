# Licenses and acknowledgements

The demo geometric compositions in src/demo.ts were authored for this project. No reference product photograph or third-party character artwork is bundled. Application source and demo artwork may be used and modified by the recipient under the MIT License in LICENSE.

Noto Sans Thai: Copyright the Noto Project Authors; SIL Open Font License 1.1. Full license: licenses/Noto-Sans-Thai-OFL.txt. Font files are provided by @fontsource/noto-sans-thai, installed by npm and bundled locally by Vite. No Google Fonts request occurs at runtime.

Direct libraries retain their own licenses: React/React DOM (MIT); Konva/react-konva (MIT); Three.js (MIT); React Three Fiber/Drei (MIT); Zustand (MIT); idb-keyval (Apache-2.0); JSZip (MIT or GPLv3, used under MIT); Lucide (ISC); Vite, TypeScript, Vitest and Playwright under their respective upstream licenses. Installed packages include their individual LICENSE files; npm package-lock.json identifies exact versions.

Reference API documentation consulted:

- https://konvajs.org/docs/react/Transformer.html
- https://konvajs.org/docs/react/Free_Drawing.html
- https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- https://threejs.org/docs/pages/Material.html
- https://r3f.docs.pmnd.rs/api/canvas

Version 2 adds these locally bundled typefaces through Fontsource, each under SIL Open Font License 1.1:

- Sarabun: full upstream copyright and terms in licenses/Sarabun-OFL.txt
- Mali: full upstream copyright and terms in licenses/Mali-OFL.txt
- Chonburi: full upstream copyright and terms in licenses/Chonburi-OFL.txt

The application does not claim ownership of imported user fonts/images. Embedding user font files is optional and should only be used when the user's font license permits it. Built-in font binaries are installed from the locked npm packages and bundled into the production build. Prettier is a development-only MIT-licensed formatter.
