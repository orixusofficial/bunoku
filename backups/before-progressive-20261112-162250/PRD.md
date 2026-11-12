# BUNOKU — PRODUCT REQUIREMENTS DOCUMENT

**Project:** Bunoku  
**Status:** Pre-development  
**Platform:** HTML5 browser game  
**Primary target:** CrazyGames  
**Technology:** Bun + Vite + React + TypeScript + CSS

## 1. Product Vision

Bunoku is a relaxing but challenging grid-based logic puzzle game featuring original rabbit characters.

The goal is to create a simple-to-learn, difficult-to-master puzzle experience that encourages players to solve one more level.

The game takes inspiration from established region-based logic puzzles. All artwork, branding, code, interface, tutorials and puzzle content must be original.

## 2. Core Gameplay

Players must place exactly one rabbit in each colored region.

Rules:

1. Exactly one rabbit per colored region.
2. Exactly one rabbit per row.
3. Exactly one rabbit per column.
4. Rabbits cannot touch horizontally, vertically or diagonally.
5. Puzzles must be solvable through logical deduction.
6. Incorrect placements count as mistakes.

The game should automatically mark impossible cells when a rabbit is placed.

Players should be able to mark cells manually where appropriate.

## 3. Game Features

### MVP (first playable version)

- Interactive puzzle grid.
- Rabbit placement.
- Colored regions.
- Automatic cell elimination.
- Manual cell marking.
- Mistake counter.
- Level completion detection.
- Restart and undo.
- Basic hints.
- Multiple original puzzles.
- Responsive desktop and mobile layouts.

### Future features

- Daily challenges.
- Streaks.
- Achievements.
- Rabbit character customization.
- More board sizes.
- Difficulty progression.
- Sound effects and animations.
- Dark mode.

Do not implement future features before the core game works.

### Main menu and tutorial screens

- The main menu uses the Bunoku wordmark, a sound toggle, the unmodified `public/bunny/bunny-menu.svg` mascot centered with responsive `object-fit: contain`, a welcome heading, and Play, Daily Puzzle, How to Play, and Settings actions.
- The primary main-menu action is labeled “Let's Play!” and opens the game screen directly.
- Play opens the current game screen. Daily Puzzle is a placeholder and does not include daily puzzle logic.
- How to Play opens a four-rule visual tutorial. Its rules explain one rabbit per region, row and column, no touching in any direction, and the three-carrot mistake limit.
- The tutorial offers Let's Play! to open the game and Back to Menu to return.
- Settings provides a sound preference control. The sound toggle is shared across screens.
- Moving between screens preserves the current game screen state. These screens do not add puzzle-solving logic or alter the established rules and level schedule.
- The game header includes a compact, tappable Main Menu control with a home icon beside the Bunoku wordmark; the sound toggle remains on the right.

## 4. Visual Identity

**Working name:** Bunoku

**Theme:** Cute rabbits, cozy and minimalist.

**Main palette:**
- Warm cream: #F4F1E8
- Sage green: #A8B99A
- Soft sand: #D9C7A3
- Forest grey: #687565

**Puzzle-region palette (additional to the brand palette):**
Use these nine soft region colors for boards containing up to nine regions. Keep adjacent regions different where practical, with clear boundaries and readable rabbit placements on every color.

1. Sand: #D9C7A3
2. Sage: #C8D5B9
3. Blush: #E7D9D0
4. Sky: #C9D8DF
5. Lavender: #D8D0E5
6. Butter: #E8DCA8
7. Peach: #E7C8B5
8. Mint: #BFD8CC
9. Stone: #D4D0C4

**Design direction:**
- Smooth and comfortable on the eyes.
- Clean, uncluttered interface.
- Rounded shapes.
- Subtle animations.
- Clear contrast between board regions.
- Original rabbit illustrations.

Avoid copying Meowdoku's artwork, UI, logo, animations or branding.

## 5. Technology

- Bun for package management and runtime.
- Vite for development and production builds.
- React for the interface.
- TypeScript for game logic.
- CSS for styling and animations.

No Next.js, Three.js or unnecessary backend.

The game should be exportable as a static HTML5 build.

## 6. Technical Architecture

Keep the project modular.

Suggested structure:

- `src/components/` — UI components and game board.
- `src/game/` — puzzle rules, validation and game logic.
- `src/data/` — puzzle definitions and levels.
- `src/hooks/` — reusable React hooks.
- `src/styles/` — global and component styles.
- `src/assets/` — illustrations, icons and sounds.

Separate puzzle logic from visual components.

Puzzle validation must be deterministic and reliable.

## 7. Quality Requirements

- No broken puzzle rules.
- No impossible or unsolvable levels.
- No accidental invalid placements.
- Smooth interactions.
- Responsive design.
- Fast loading.
- Keyboard and touch support.
- No unnecessary dependencies.
- No copied third-party game assets.

## 8. Development Roadmap

Phase 1: Project setup and documentation.

Phase 2: Character design and visual identity.

Phase 3: Board and UI design.

Phase 4: Core game logic.

Phase 5: First playable prototype.

Phase 6: Puzzle generation and difficulty progression.

Phase 7: Testing and polish.

Phase 8: HTML5 export and CrazyGames submission.

## 9. AI Development Instructions

IMPORTANT: Before making any project changes:

1. Read this PRD.md completely.
2. Inspect the existing project structure and relevant files.
3. Understand the existing implementation before modifying anything.
4. Follow the established architecture and visual identity.
5. Do not unnecessarily rewrite working code.
6. Avoid adding dependencies without a clear reason.
7. Do not implement features outside the agreed scope.
8. Test affected functionality after changes.
9. Report modified files and any remaining issues.
10. If requirements change, propose the PRD update before implementing the change.

This document is the project's source of truth.

**Never assume a feature has been approved just because it was suggested.**

## 10. Typography

**Primary font:** Nunito (Google Fonts)

**Font weights:** 400, 500, 600, 700, 800.

Design requirements:
- Rounded, friendly appearance.
- Highly readable for children and adults.
- Clear distinction between headings and body text.
- Avoid overly decorative fonts.
- Maintain comfortable spacing and line height.
- Use large, readable text for instructions and buttons.

Nunito is the primary font throughout Bunoku.
