# atguilds

Portable Gaming Guild communities built on top of the ATProtocol

## Developing

Install dependencies with `pnpm install`.

Start a development server:

```bash
# start postgres
docker-compose up -d

# run app
pnpm run dev
```

### Lexicon Code Gen

To (re)generate TypeScript [code](src/lib/lexicon) for guild lexicons

`./node_modules/.bin/lex gen-server ./src/lib/lexicon ./lexicons/*`


## Building

To create a production version of your app:

```bash
pnpm run build
```

You can preview the production build with `pnpm run preview`.


## About

Winner of "Best Bluesky Fun Project" @ Jan 2025 [LFC.DEV](https://lfc.dev/) - [Bluesky/ATProto Hackathon](https://lu.ma/olts6pug) 