# RankForge

Local video-ranking editor for YouTube "Top N" automation workflow. Single user, no auth, everything runs on your machine.

## Install & Run

```
npm install
npm run dev
```

- Client: http://localhost:5173
- Server API: http://localhost:4000

Data is stored in `server/data/db.json`. Uploaded media files are stored in `server/uploads/`.

## Notes
- Export button generates a downloadable EDL/manifest JSON (`edit decision list`) describing the timeline, title overlay, ranking blocks and assigned media/audio — ready to feed into a rendering pipeline (e.g. ffmpeg script) later.
- Drag the title box on the preview canvas to reposition it; drag a corner handle to resize.
- Reorder ranking blocks with the up/down arrows on each card.
