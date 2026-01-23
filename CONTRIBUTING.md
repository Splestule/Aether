# Contributing to Aether

Thanks for your interest in contributing! 🎉

## Quick Start

```bash
# Prerequisites: Node.js 18+, npm

# 1. Fork & clone
git clone https://github.com/YOUR_USERNAME/Aether.git
cd Aether

# 2. Install dependencies
npm run install:all

# 3. Set up environment
cp server/.env.example server/.env

# 4. Start dev server
npm run dev

# 🎮 You're in! Client: http://localhost:5173, Server: http://localhost:3001
```

## Development Tips

- **VR Testing**: Use Meta Quest browser or WebXR emulator Chrome extension
- **API Limits**: OpenSky has rate limits - add your credentials to `.env` for higher limits

## Making Changes

1. Create a branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run `npm run format` to format code
4. Test locally with `npm run dev`
5. Push & open a PR

## Code Style

We use [Prettier](https://prettier.io/) for formatting. Run `npm run format` before committing.

## Good First Issues

Look for issues tagged [`good first issue`](https://github.com/Splestule/Aether/labels/good%20first%20issue) - these are great for getting started!

## Questions?

Open a [GitHub Discussion](https://github.com/Splestule/Aether/discussions) - we're happy to help!
