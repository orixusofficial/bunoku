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

The game calculates impossible cells internally when a rabbit is placed. Players mark Xs manually by clicking or dragging; the game does not display automatic Xs.

### Approved progressive generation

- Regions may have unequal sizes. Every region remains connected through edges and has exactly one rabbit in the completed solution.
- All rabbits start hidden. Exactly one starting region contains one box (within the approved 1–2 box range); its color is identified by the existing outline and a separate color swatch.
- A correct rabbit placement displays only the rabbit. Its row, column, eight surrounding cells, and solved region become logically unavailable internally, even while those cells remain visually unmarked.
- Internal eliminations are derived from real rabbit placements. Players can add or remove manual Xs on logically unavailable cells; rabbit placement remains prohibited there. Manual pencil Xs remain separate, so Undo and Restart restore the exact previous state.
- Logical remaining-box counts exclude internally eliminated cells regardless of visible Xs. Player availability also accounts for manual Xs, rabbits, and failed-carrot cells. Manual marks are not evidence for a forced placement.
- Generation constructs connected region membership around a calculated valid solution. It must replay a complete sequence of justified region singles using only visible eliminations, recording each region's counts before and after every rabbit. Every nonfinal placement must reduce another unsolved region's count. A two-box region is never treated as a forced choice.
- Accepted puzzles have a verified complete solving certificate. Generation has a fixed attempt limit and runs in a worker in the live game; failure produces a retry message rather than an invalid board.
- Normal Play uses level 1: 4×4; levels divisible by 10: 9×9; levels ending in 5: 8×8; all other levels: 6×6. There is one rabbit per region, row, and column. Daily Puzzle remains a separate 9×9 prototype.
- Completing a normal puzzle unlocks and saves the next level in browser storage. Next opens that level; Restart reuses the current puzzle. Returning to Play resumes the mounted game, or the saved level after a reload. Storage failure does not block play.
- Every ten levels the difficulty selection tier increases, up to four increases. Later tiers select from more verified layouts using a score for fewer simultaneous forced colors, remaining-box ambiguity, and region boundary complexity. This increases selection pressure within each grid size; it is a difficulty heuristic, not a measured human difficulty guarantee. Every candidate still requires the complete no-guess progression certificate.
- Hints use actual rabbit placements and a provable next move. A highlighted hint preview does not act as a placed rabbit.

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
- Play opens the current normal game. Daily Puzzle uses the shared 9×9 progressive engine and unlocks after completing Level 10. The menu shows ten-level progress, a lock, and then a countdown. One successful puzzle start consumes one attempt for 24 hours; failed generation consumes nothing. Daily attempts cannot restart or open another puzzle during the cooldown. There are no midnight resets or streaks.
- How to Play opens a four-rule visual tutorial. Its rules explain one rabbit per region, row and column, no touching in any direction, and the three-carrot mistake limit.
- The tutorial offers Let's Play! to open the game and Back to Menu to return.
- Settings provides a sound preference control. The sound toggle is shared across screens.
- Moving between screens preserves the current game screen state. These screens do not add puzzle-solving logic or alter the established rules and level schedule.
- The game header includes a compact, tappable Main Menu control with a home icon beside the Bunoku wordmark; the sound toggle remains on the right.

## 4. Visual Identity

### Persistent allowances and optional rewards

- Each player has five lifetime free Hint uses and five lifetime free Undo uses. A successful hint preview or actual Undo consumes one use. Invalid actions, level changes, Restart and Undo never replenish an allowance.
- After the free allowance, the corresponding action spends one saved reward credit. Control badges show free uses plus saved credits; zero displays a small video icon. Depleted Hint and Undo controls directly request a CrazyGames rewarded ad. A completed ad grants three uses of that action without consuming any automatically.
- CrazyGames SDK v3 rewarded callbacks alone control the outcome. Audio is muted and SDK gameplay suspended only after adStarted, and restored after completion/error. Only a completed started ad grants credits; errors, missing ads, cancelled requests and duplicate callbacks grant nothing. The UI remains blocked during the SDK request until a terminal callback; an arbitrary timeout cannot safely cancel an SDK ad that might still start.
- New balances and Daily timestamps use a versioned localStorage record, preserving existing level progress and audio preferences. Failed persistence blocks scarce actions rather than silently replenishing uses. This setup has not enabled CrazyGames Data cloud saving. Client clock rollback is handled with a saved high-water clock plus elapsed session time; clearing storage or deliberately changing the clock across reloads cannot be secured without a trusted service.

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

### Submission persistence and localization

- Daily Puzzle saves its verified layout, placed rabbits, manual marks, remaining lives, failed cells, Hint preview/history, Undo history and combo count with the start timestamp in one ledger record. Resume restores the same unfinished attempt after refresh or Main Menu navigation, even after the cooldown expires. Finished attempts cannot resume and remain locked until the original 24-hour cooldown expires.
- SDK adCooldown, unfilled, adsDisabled and adblock outcomes are logged and returned separately. They grant nothing, restore audio, and do not set a custom timer or permanent application lock. A later player attempt asks the SDK again; SDK restrictions remain authoritative.
- With no saved valid language preference, use SDK v3 user.systemInfo.locale, normalize supported language variants, and fall back to English. Manual selection overrides SDK locale on later launches.

- The Rewards page and its menu navigation have been removed. Direct gameplay ad requests are a product choice that conflicts with the previously reviewed CrazyGames placement requirement and need platform review before submission.
