# atguilds

Portable Gaming Guild communities built on top of the ATProtocol

## Developing

Install dependencies with `pnpm install`.

Start a development server:

```bash
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

## Building

To create a production version of your app:

```bash
pnpm run build
```

You can preview the production build with `pnpm run preview`.

## Speed Insights

Once deployed on Vercel, you can benefit from [Speed Insights](https://vercel.com/docs/concepts/speed-insights) simply by navigating to Vercel's dashboard, clicking on the 'Speed Insights' tab, and enabling the product.

You will get data once your application will be re-deployed and will receive visitors.

## Lexicon Code Gen

`./node_modules/.bin/lex gen-server ./src/libs/lexicon ./lexicons/*`