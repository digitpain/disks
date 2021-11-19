// Sketchy Square, 2021

// TODO
// * Encode turns on the bottom.
// * Store and play back turns / run backwards and forwards through them?
// * Add modes for playback / preload.

const { ceil } = Math;

// Overall sequence mode.
let state = "rest";
let sketch;

// Dragging & making a selection.
// TODO: This should be baked into Pen.
let dragging = false;
let selection, selectionBuffer;

// This should be a simple switchbox that can reset?
let boxIsBlinking = false,
  boxBlink = false,
  blinkCount = 0;

// History
let history,
  turn,
  turns = [],
  plottedTurns = 0;

// 🥾 Boot
export function boot({ resize, pixels, screen, wipe, ink }) {
  resize(64, 64 + 1);

  const palette = {
    light: {
      grey: 80,
      blue: [100, 100, 150],
    },
    dark: {
      grey: 40,
      blue: [40, 40, 60],
    },
  };

  // Make starting image a dark background with a light square in the center.
  sketch = pixels(screen.width, screen.height - 1, (w, h) => {
    const hw = ceil(w / 2);
    wipe(palette.dark)
      .ink(palette.light)
      .box(hw, ceil(h / 2), hw, "fill*center");
  });

  history = pixels(screen.width, 1, () => wipe(0));
}

// 🧮 Simulate
export function sim({ screen, pen, geo, cursor }) {
  // Start drag.
  if (pen.is("down")) {
    if (state === "rest") state = "select";
    dragging = true;
  }

  // Continue drag.
  if (pen.is("drawing")) {
    if (state === "select") {
      selection = new geo.Box(
        pen.dragStartPos.x,
        pen.dragStartPos.y,
        pen.dragAmount.x,
        pen.dragAmount.y
      ).fromTopLeft.croppedTo(0, 0, sketch.width, sketch.height);

      const s = selection;
      turn = [s.x, s.y, s.w, s.h];

      cursor("none");
    } else if (state === "move") {
      selection.x += pen.dragDelta.x;
      selection.y += pen.dragDelta.y;
      cursor("tiny");
    }
  }

  // End drag.
  if (pen.is("up")) {
    if (state === "move") {
      // Get finished turn data.
      turn.push(selection.x, selection.y);

      // Only add turn if we actually moved.
      if (turn[0] !== turn[4] || turn[1] !== turn[5]) {
        // And the destination is inside of the screen.
        const dx = turn[4];
        const dy = turn[5];
        const dw = turn[2];
        const dh = turn[3];

        const sx = 0;
        const sy = 0;
        const sw = screen.width;
        const sh = screen.height - 1;

        if ((dx + dw <= 0 || dx >= sw || dy + dh <= 0 || dy >= sh) === false) {
          // And we have enough pixels.
          if (turns.length < history.width / 2) {
            turns.push(turn); // x, y, w, h, endx, endy
          } else {
            console.log("Turn buffer is full!");
          }
        }
      }

      boxIsBlinking = false;
      state = "rest";
      cursor("precise");
    } else if (state === "select" && selection) {
      state = "move";
      blinkCount = 0;
      boxBlink = false;
      boxIsBlinking = true;
      cursor("tiny");
    }

    dragging = false;
  }
}

// 🎨 Paint
export function paint({
  ink,
  copy,
  plot,
  paste,
  clear,
  line,
  box,
  pixels,
  screen,
  setBuffer,
  pen,
  paintCount,
}) {
  // 1. Caching
  // Always render the first frame, and then only on pen change,
  // or if actively dragging a selection.
  if (paintCount !== 0 && pen.changed === false && boxIsBlinking === false) {
    return false;
  }

  // 2. Background (surfaceBuffer)
  paste(sketch);

  // 2. Selection box
  if (selection && (state === "select" || state === "move")) {
    if (state === "select") ink(255, 0, 0, 128);
    else if (state === "move") ink(200, 0, 0, 128);

    if (state === "move" && dragging) {
      if (blinkCount % 60 === 0) {
        boxBlink = !boxBlink;
      }
      blinkCount += 1;
      ink(200, 0, 0, boxBlink ? 64 : 0);
    }

    box(selection.x, selection.y, selection.w, selection.h, "outline");
  }

  // 3. Create selection buffer if needed.
  // TODO: This should move to another function or be created in sim.
  if (
    state === "move" &&
    !selectionBuffer &&
    selection.w > 0 &&
    selection.h > 0
  ) {
    selectionBuffer = pixels(selection.w, selection.h, (w, h) => {
      // Copy the screen rectangle into our selection buffer.
      for (let x = 0; x < w; x += 1) {
        for (let y = 0; y < h; y += 1) {
          copy(x, y, selection.x + x, selection.y + y, sketch);
        }
      }
    });
    console.log("Captured selection:", selectionBuffer);
  }

  // 4. Move selection buffer.
  if (state === "move" && selectionBuffer) {
    // Fill rectangular bitmap of selection.
    paste(selectionBuffer, selection.x, selection.y);
  }

  // 5. Paste selection buffer.
  if (state === "rest" && selectionBuffer) {
    // Switch to surfaceBuffer.
    setBuffer(sketch);
    paste(selectionBuffer, selection.x, selection.y);
    // Copy selectionBuffer to surfaceBuffer.
    selectionBuffer = undefined;
    selection = undefined;

    // Switch back to screen buffer.
    setBuffer(screen);

    // Repaint screen with surfaceBuffer.
    paste(sketch);
  }

  // 6. Draw every turn, and plot the last if needed.
  if (plottedTurns < turns.length) {
    setBuffer(history);
    const turnToPlot = turns[plottedTurns];

    ink(turnToPlot[0], turnToPlot[1], turnToPlot[2]);
    plot(plottedTurns * 2, 0);

    // 4 and 5 are ending coordinates and can be signed, so we will add 127 to
    // them and when reading back, treat 127 as 0. This should work for a
    // resolution of up to 128?

    ink(turnToPlot[3], turnToPlot[4] + 127, turnToPlot[5] + 127);
    plot(plottedTurns * 2 + 1, 0);

    setBuffer(screen);

    plottedTurns += 1;
  }

  paste(history, 0, screen.height - 1);
}

// 💗 Beat
export function beat($api) {
  // TODO: Play a sound here!
}

// 📚 Library
// ...
