# Ambition - Oracle Engine Sandbox

A text/browser/map-based sandbox where the **Oracle Engine** turns free-text ambitions into a solvable requirement graph, proposes actions, simulates a living world, and narrates outcomes.

## 🎯 Overview

Express your ambition in natural language—"I want to be a just king," "I want to be a great warrior," or "I want to be a wise scholar"—and watch the Oracle Engine transform your words into an interactive journey of choice, consequence, and character development.

## 🏗️ Architecture

This is a **pnpm monorepo** with three packages:

- **`packages/oracle-engine`** - TypeScript library containing the core game logic
- **`apps/api`** - Fastify REST API server with Zod validation
- **`apps/web`** - Next.js 15 frontend with TanStack Query and Tailwind CSS

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This will start:
- API server at http://localhost:8787
- Web frontend at http://localhost:3000

## 📖 Sample Walkthrough

1. **Visit** http://localhost:3000
2. **Click** "Start Your Journey"
3. **Enter** "I want to be a just king who protects his people"
4. **Watch** the Oracle Engine generate:
   - Requirement graph (Land → People → Army → Treasury → Legitimacy)
   - Living world with regions, factions, and resources
   - Actionable proposals with costs, risks, and rewards
5. **Choose** an action like "Win the People via Charity"
6. **Observe** how the world responds with events and new opportunities

## 🧠 Core Concepts

### Intent Parser
Maps free-text → `{archetypes, virtues, vices, weights}`
- **Archetypes**: king, warrior, merchant, scholar, priest, rogue
- **Virtues**: honor, courage, wisdom, compassion, justice, loyalty
- **Vices**: pride, greed, wrath, envy, sloth, treachery

### Requirement Graph (DAG)
Nodes like `land/people/army/treasury/legitimacy` with multiple paths:
- **Land**: conquest, purchase, grant, marriage
- **Army**: recruitment, mercenaries, conscription
- **People**: charity, justice, protection

### Knowledge DSL (YAML)
Small, readable rules defining:
- **Requirements** with multiple satisfaction paths
- **Generators** that create opportunities based on world conditions

### Planner (GOAP-lite)
Selects unmet goals, enumerates valid paths, chains sub-goals, scores by utility:
- Progress value (does this advance our goals?)
- Resource costs (can we afford it?)
- Risk assessment (what could go wrong?)
- Time efficiency (how long will it take?)

### Sim Core
Simple but effective simulation of:
- **Economy**: gold/grain/iron production and consumption
- **People**: loyalty/unrest/faith dynamics
- **Forces**: units/morale/supply management
- **Factions**: relationship changes and power shifts

### Event Alchemist
Converts state diffs → readable event cards with meaningful choices and consequences.

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @ambition/oracle-engine test
pnpm --filter @ambition/api test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## 📁 Project Structure

```
ambition/
├── packages/oracle-engine/        # Core game logic
│   ├── src/
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── modules/               # Core modules
│   │   │   ├── intentParser.ts    # Parse free-text ambitions
│   │   │   ├── graphForge.ts      # Generate requirement graphs
│   │   │   ├── worldGen.ts        # Create living worlds
│   │   │   ├── dsl.ts             # Load YAML knowledge base
│   │   │   ├── planner.ts         # GOAP action planning
│   │   │   ├── sim.ts             # World simulation
│   │   │   └── events.ts          # Event generation
│   │   └── index.ts               # Main exports
│   ├── fixtures/                  # Test data and examples
│   │   ├── dsl/rules.base.yaml    # Base game rules
│   │   └── seeds/ambition.samples.json
│   └── __tests__/                 # Vitest test suite
├── apps/api/                      # Fastify REST API
│   ├── src/
│   │   ├── routes/game.ts         # Game endpoints
│   │   ├── schemas/               # Zod validation
│   │   ├── repository/            # In-memory storage
│   │   └── index.ts               # Server entry point
│   └── __tests__/                 # API tests
├── apps/web/                      # Next.js frontend
│   ├── src/
│   │   ├── app/                   # App router pages
│   │   ├── components/            # React components
│   │   └── lib/api.ts             # API client
│   └── tailwind.config.js         # Styling configuration
├── package.json                   # Root package configuration
├── pnpm-workspace.yaml           # Workspace definition
└── README.md                     # This file
```

## 🔌 API Endpoints

- **`POST /start`** - Start new game with ambition
- **`GET /state?playerId=X`** - Get current game state  
- **`POST /choose`** - Choose action or event choice
- **`POST /advance`** - Advance one tick without action

## 💡 Key Features

### Deterministic Gameplay
Same seed + ambition = identical world generation and first 2 ticks

### Scalable Action Planning
Planner surfaces 3-5 viable actions unless world facts block all paths

### Dynamic Knowledge Base
YAML DSL allows easy modification of game rules and opportunities

### Responsive Event System
Events generate from world state changes with meaningful narrative context

### Resource Management
Balance gold, grain, iron, wood, stone while managing loyalty and unrest

## 🎮 Gameplay Mechanics

### Turn Structure
1. **Action Phase**: Choose from 3-5 AI-proposed actions
2. **Resolution**: Apply costs, risks, and effects
3. **Simulation**: World advances one tick with economic/political drift
4. **Events**: Narrative cards with choices based on what changed
5. **Planning**: New action proposals generated

### Victory Conditions
Complete your requirement graph by fulfilling all nodes through strategic action selection.

### Failure States
- Resource depletion (no viable actions)
- Popular revolt (loyalty too low + unrest too high)
- Military defeat (attacked with insufficient forces)

## 🔧 Development

### Architecture Decisions
- **TypeScript strict mode** everywhere for type safety
- **pnpm workspaces** for efficient monorepo management
- **Vitest** for fast, modern testing
- **Zod** for runtime validation and type inference
- **TanStack Query** for client state management
- **Tailwind CSS** for rapid UI development

### Extension Points
- Add new archetypes in `intentParser.ts`
- Create new requirement templates in `graphForge.ts`
- Extend YAML DSL with new rule types
- Add new event generators in `events.ts`
- Implement persistent storage in `repository/`

## 📋 TODO / Roadmap

- [ ] Add hex map visualization
- [ ] Implement memory/tags system (oathbreaker, merciful)
- [ ] Add persistent storage (PostgreSQL)
- [ ] Create admin dashboard
- [ ] Add multiplayer sessions
- [ ] Implement achievement system
- [ ] Add sound effects and music
- [ ] Create mobile-responsive design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `pnpm test`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

Built with modern TypeScript, React, and Node.js ecosystem tools. Inspired by goal-oriented action planning (GOAP) systems and narrative-driven strategy games.

---

**Start your journey at http://localhost:3000 after running `pnpm dev`**