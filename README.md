# ulde-stats

Ultimate frisbee statistics recorder and viewer. Record pass events during a game, then review throwing/catching stats and play-by-play afterwards.

## Architecture

```
ulde-stats/
├── client/          React + Vite frontend
├── server/          Express + TypeScript API
│   └── data/        Game JSON files (source of truth)
└── package.json     Root scripts
```

The server stores all game data as JSON files under `server/data/`. The client communicates with the server API during recording. The static viewer build bundles these JSON files directly into the frontend — no server needed at runtime.

## Development

Install dependencies:

```sh
npm run install:all
```

Start both client and server in development mode:

```sh
npm run dev
```

- Client: `http://localhost:5173`
- Server API: `http://localhost:3001`

## Static Viewer Build

The viewer is a **read-only, server-free** version of the app. It shows only game selection, statistics, and play-by-play. All game data from `server/data/*.json` is bundled into the JavaScript output at build time — no server or API calls at runtime.

### How it works

Running `npm run build:viewer` sets the `VITE_VIEWER=true` environment variable, which changes the build in two ways:

1. **API is swapped out**: Vite's alias config replaces `src/api.ts` with `src/api.viewer.ts`. The viewer version uses `import.meta.glob` to read all `server/data/*.json` files at build time and bundles them into the JS bundle. Write operations (create game, save event, etc.) throw errors and are never called.

2. **Recording UI is excluded**: The app starts directly on the game selection screen. All recording screens (launch, game setup, player setup, recording) are compiled out via the `VITE_VIEWER` compile-time constant.

The result is a fully self-contained `client/dist-viewer/` folder with `index.html` and hashed JS/CSS assets. No `.json` files appear in the output — all game data is embedded in the JS bundle.

### Adding games to the viewer

Game JSON files committed to `server/data/` are automatically included in the next viewer build. No manual copy step is needed. Just commit the game files and rebuild.

### Build

```sh
npm run build:viewer
```

Output is written to `client/dist-viewer/`.

To preview locally before deploying:

```sh
npx serve client/dist-viewer
```

### Deploy to AWS S3

The app uses React state for navigation (no URL changes), so no special redirect rules are needed.

**1. Create an S3 bucket with static website hosting**

In the AWS console (or CLI), create a bucket and enable static website hosting:
- Index document: `index.html`
- Error document: `index.html` (optional — only needed if you add client-side routing later)

**2. Set the bucket policy for public read access**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

**3. Upload the build output**

```sh
aws s3 sync client/dist-viewer s3://your-bucket-name --delete
```

The `--delete` flag removes files from S3 that no longer exist in the local build (e.g. old hashed asset files after a rebuild).

**4. Access the site**

The static website URL is shown in the S3 bucket's "Properties" tab under "Static website hosting". It looks like:

```
http://your-bucket-name.s3-website.eu-north-1.amazonaws.com
```

