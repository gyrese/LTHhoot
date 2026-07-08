---
name: Animation Salon
colors:
  surface: '#131317'
  surface-dim: '#131317'
  surface-bright: '#39393d'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#2a2a2e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e7'
  on-surface-variant: '#d2c5ab'
  inverse-surface: '#e4e1e7'
  inverse-on-surface: '#303034'
  outline: '#9a9078'
  outline-variant: '#4e4632'
  surface-tint: '#f1c100'
  primary: '#ffedc3'
  on-primary: '#3d2f00'
  primary-container: '#ffcc00'
  on-primary-container: '#6f5700'
  inverse-primary: '#745b00'
  secondary: '#d3fbff'
  on-secondary: '#00363a'
  secondary-container: '#00eefc'
  on-secondary-container: '#00686f'
  tertiary: '#ffe9e9'
  on-tertiary: '#680019'
  tertiary-container: '#ffc3c5'
  on-tertiary-container: '#b60033'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe08b'
  primary-fixed-dim: '#f1c100'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#584400'
  secondary-fixed: '#7df4ff'
  secondary-fixed-dim: '#00dbe9'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f54'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b5'
  on-tertiary-fixed: '#40000c'
  on-tertiary-fixed-variant: '#920027'
  background: '#131317'
  on-background: '#e4e1e7'
  surface-variant: '#353439'
typography:
  display-hero:
    fontFamily: anybody
    fontSize: 72px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-hero-mobile:
    fontFamily: anybody
    fontSize: 40px
    fontWeight: '900'
    lineHeight: '1.1'
  headline-lg:
    fontFamily: anybody
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: anybody
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-md:
    fontFamily: anybody
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: plusJakartaSans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.6'
  body-md:
    fontFamily: plusJakartaSans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: geist
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-mobile: 1.5rem
  container-padding-desktop: 4rem
  gutter: 1.5rem
  stack-sm: 0.5rem
  stack-md: 1.5rem
  stack-lg: 3rem
---

## Brand & Style
The design system is engineered for high-energy, cinematic gamification. It targets a multi-generational audience of pop-culture enthusiasts, students, and competitive social groups. The UI must feel like a premium broadcast event—part game show, part immersive cinematic experience.

The design style is a hybrid of **High-Contrast / Bold** and **Glassmorphism**. It utilizes deep, atmospheric base layers to allow theme-specific textures (like Jurassic foliage or Manga speed lines) to reside in the background without sacrificing legibility. Every interaction is designed to evoke excitement, using "heroic" proportions and a sense of physical depth.

**Key Visual Principles:**
- **Cinematic immersion:** Use full-bleed background environments tailored to the current theme.
- **Dynamic Energy:** UI elements should feel "active," using high-contrast borders and vibrant glows.
- **Celebratory Focus:** Win states, podiums, and rankings are treated with maximalist visual flair.

## Colors
The system operates exclusively in **Dark Mode** to preserve the cinematic intensity and ensure that neon accents and thematic textures pop. 

- **Base Surfaces:** Deep charcoals and near-blacks (#1A1A1E) provide the canvas.
- **Accents:** High-vibrancy primary (Gold/Yellow), secondary (Cyan/Electric Blue), and tertiary (Vivid Pink) colors are used for action states, correct answers, and urgent UI.
- **Ranking Palette:** Specific metallic-inspired tokens for 1st, 2nd, and 3rd place podium positions to differentiate the leaders clearly during high-stakes moments.
- **Thematic Overlays:** When switching themes (e.g., Jurassic to Manga), the accent colors may shift slightly in hue, but must maintain the defined luminosity levels.

## Typography
Typography is the primary driver of the "Heroic" vibe. 

- **Display & Headings:** Uses **Anybody**, a variable font that feels mechanical yet expressive. For rankings and scores, use the widest and heaviest weights to create an "impact" aesthetic.
- **Body Text:** Uses **Plus Jakarta Sans** for its high legibility and friendly, rounded character, balancing the aggression of the display type.
- **Technical Labels:** Uses **Geist** for timers, code entries, and metadata. Its monospaced feel provides a "high-tech" or "scientific" contrast to the organic themes.

*Note: Large display type should use tight letter-spacing to feel like a movie poster headline.*

## Layout & Spacing
The layout follows a **Fluid Grid** model designed for "Stage Presence." 

- **Stage Area:** A central 12-column grid for desktop where the question and primary visual reside.
- **Verticality:** Elements like podiums and leaderboards should use vertical stacking with generous "Stack-LG" spacing to emphasize height.
- **Mobile Reflow:** On mobile devices, the 4-choice answer grid shifts from a 2x2 layout to a 4x1 vertical stack to maximize the tap area for fast-paced gameplay.
- **Safe Areas:** Maintain high horizontal margins (4rem on desktop) to ensure background environmental art is visible on the peripheries.

## Elevation & Depth
This design system uses **Glassmorphism** and **Tonal Layers** to create a sense of floating UI over a rich environment.

- **The Backdrop:** Environmental art (Jurassic jungle, Manga lines) sits at the lowest level with a slight darken-vignette.
- **Glass Containers:** Primary UI cards use a 10-20% opacity white fill with a heavy **Backdrop Blur (20px-40px)**.
- **Inner Glows:** Instead of traditional drop shadows, use 1px inner borders with a 50% opacity primary color to simulate "Neon Edge" lighting.
- **Elevation via Scale:** During active states (hover or selection), elements should physically scale up (1.05x) and increase their glow intensity rather than just changing color.

## Shapes
The shape language is **Rounded**, balancing the aggressive typography with accessible, friendly interaction points.

- **Primary Containers:** 0.5rem (8px) radius for answer buttons and list items.
- **Large Cards:** 1.5rem (24px) for the main question stage and podium blocks.
- **Avatar Frames:** Strictly circular (Pill-shaped) to provide a recurring organic element in the structured grid.
- **Theme modifiers:** While the "Rounded" token is the default, the Manga theme may introduce sharp-angled "cut-outs" on the corners of buttons via clip-paths to match the cel-shaded style.

## Components
Consistent component behavior ensures the game remains intuitive despite shifting visual themes.

- **Answer Buttons:** Large, tactile blocks with a heavy bottom border (4px) to simulate a physical "buzzer." On press, the border disappears to provide haptic visual feedback.
- **Epic Podiums:** The leaderboard uses three-dimensional blocks of varying heights. 1st place should be 20% wider than 2nd and 3rd, featuring a unique "Aura Glow" in Gold.
- **Dynamic Avatar Frames:** Frames should change based on user rank (e.g., a "Scientific Hazard" border for the Science theme or "Metallic Chrome" for the Superhero theme).
- **Thematic Chips:** Small status indicators (e.g., "5x Combo") use high-contrast backgrounds with the **Label-Caps** typography level.
- **Celebratory Particles:** Non-interactive background layers that trigger on "Correct" or "Win" states—ranging from floating DNA strands (Science) to falling fossil dust (Jurassic).
- **Input Fields:** Minimalist glass-morphic fields with a persistent bottom-line focus state in the Primary Color.