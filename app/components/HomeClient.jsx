"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "./portableTextComponents";
import { initFinalResearch } from "./script-final-research";

function Circle({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1 -1 27 27"
      className={`w-[0.131em] h-[0.131em] shrink-0 overflow-visible transition-colors duration-150 ease-in-out ${
        active ? "text-[var(--color-highlight)]" : "text-[var(--color-secondary)]"
      }`}
    >
      <circle cx="12.5" cy="12.5" r="12.5" fill="currentColor" />
    </svg>
  );
}

// The originals are several thousand pixels wide while a tile renders at 235px
// at most, so the browser was resampling roughly a thousand megapixels every time
// the tiles changed size. Sanity's CDN resizes on delivery; ask it for something
// close to what is actually drawn, at twice the width to stay sharp on dense
// displays.
// Two passes: a light one sized for the resting grid, then a sharper one for the
// expanded Archive. The second is fetched only once the first has finished, so the
// page becomes usable before the heavier set arrives.
const TILE_SRC_SMALL = 240;
const TILE_SRC_LARGE = 480;

// Matches the fade-in/fade-out animations in the stylesheet.
const VIEWER_FADE_MS = 400;

// Left alone on the home screen, the grid starts cycling through the tag views on
// its own. Purely decorative: it commits nothing and stops at the first input.
// The shortest the opening sweep may take, however fast the images arrive.
const INTRO_MIN_MS = 1500;
// The wordmark fades first; the bar waits for it before starting.
const INTRO_NAME_MS = 700;

// Expanding fades the grid out, swaps the layout while nothing is visible, then
// fades it back in at the larger size.
const GRID_FADE_MS = 560;

const AMBIENT_IDLE_MS = 2500;
const AMBIENT_STEP_MS = 2500;
// Long and even, so the idle cycle drifts between views rather than snapping.
const AMBIENT_FADE = "duration-[1400ms] ease-linear";
const sizedTile = (url, w) =>
  url ? `${url}${url.includes("?") ? "&" : "?"}w=${w}&auto=format&q=75` : url;

// The original asset, unresized. Only `auto=format` is applied so modern browsers
// still get a modern codec rather than the raw JPEG.
const masterSrc = (url) =>
  url ? `${url}${url.includes("?") ? "&" : "?"}auto=format&q=90` : url;

// How long the index rule takes to travel the full height of the screen.
const INDEX_DRAW_MS = 225;
// How long each entry takes to fade once the rule reaches it.
const INDEX_ENTRY_FADE_MS = 40;

const items = [
  { big: "Information", small: "Information" },
  { big: "Archive", small: "Archive" },
];

export default function HomeClient({ information, clients, projects, tags }) {
  const isTouchDevice = useRef(false);
  useEffect(() => {
    isTouchDevice.current = window.matchMedia("(hover: none)").matches;
  }, []);

  const [hovered, setHovered] = useState(null);
  const [hoverLocked, setHoverLocked] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [infoPinned, setInfoPinned] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  // Kept mounted through the closing sequence so it can play out.
  const [indexClosing, setIndexClosing] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [hoveredTag, setHoveredTag] = useState(null);
  const barRowRef = useRef(null);
  const wordmarkRef = useRef(null);
  const rightAnchorRef = useRef(null);
  const ruleLeftRef = useRef(null);
  const ruleRightRef = useRef(null);
  const menuListRef = useRef(null);
  const gridScrollRef = useRef(null);
  // Set when a filter change came from clicking a tile, which should hold its
  // place rather than jumping to the top.
  const keepScroll = useRef(false);
  const infoBlockRef = useRef(null);

  // Load sequence: the wordmark fades in, the bar rule then reports progress as
  // the small images arrive, and the sharper set is fetched afterwards.
  const [loadedCount, setLoadedCount] = useState(0);
  const [smallsLoaded, setSmallsLoaded] = useState(false);
  // How far the bar has actually swept. Driven by a clock as well as the network,
  // so a warm cache still gets the full sweep rather than a jump to done.
  const [introProgress, setIntroProgress] = useState(0);
  const loadFractionRef = useRef(0);
  const [hiResReady, setHiResReady] = useState(false);
  // The image currently opened full-screen, by tile key.
  const [openedKey, setOpenedKey] = useState(null);
  // Mounted state and visible state are separate, so the modal can stay in the
  // tree while it fades back out.
  const [viewerVisible, setViewerVisible] = useState(false);
  const viewerTimer = useRef(null);
  const viewerFrame = useRef(null);
  const menuDelay = useRef(null);
  // True between the grid starting to fade out and the menu actually opening, so
  // nothing treats that gap as the resting home state.
  const [menuPending, setMenuPending] = useState(false);
  // The tag the idle cycle is currently resting on, or null when it isn't running.
  const [ambientTag, setAmbientTag] = useState(null);
  // Tile keys whose master-quality file has finished downloading.
  const [mastersReady, setMastersReady] = useState(() => new Set());
  // Layout size is separate from the view state: on the way in it only flips once
  // every tile has faded out, so the grid never reflows while anything is visible.
  const [expandedLayout, setExpandedLayout] = useState(false);
  const masterRequested = useRef(new Set());
  const galleryRef = useRef([]);


  // Every image, always. Filtering by tag fades the tiles that don't match back
  // to a faint 5% rather than dropping them: they keep their place in the layout,
  // so the grid never reloads, rebuilds or shifts.
  // A project switched off in the studio drops out of the grid and the unfiltered
  // Archive, but choosing its tag from the menu brings it back. Keyed on the
  // committed filter rather than the hovered one, so previewing a tag only changes
  // what is lit, never what is in the layout. Older documents have no field at
  // all, so only an explicit false hides one.
  const galleryImages = (projects ?? [])
    .filter(
      (p) =>
        p.visible !== false ||
        (selectedTag && (p.tags ?? []).some((t) => t._id === selectedTag))
    )
    .flatMap((p) =>
    (p.images ?? [])
      .filter((img) => img?.url)
      .map((img) => ({
        ...img,
        projectId: p._id,
        title: p.title,
        tagIds: (p.tags ?? []).map((t) => t._id),
      }))
  );

  galleryRef.current = galleryImages;
  const totalTiles = galleryImages.length;
  const loadFraction = smallsLoaded
    ? 1
    : totalTiles
      ? Math.min(1, loadedCount / totalTiles)
      : 1;
  loadFractionRef.current = loadFraction;
  // Everything downstream waits for the sweep, not just the network.
  const imagesReady = introProgress >= 1;

  const openedImage =
    openedKey === null
      ? null
      : galleryImages.find((img, i) => `${img.projectId}-${img._key ?? i}` === openedKey) ?? null;

  const infoActive = infoPinned;
  const archiveActive = pinned === "Archive";
  // Hovering a filter previews it. Hovering Archive previews "everything", so it
  // clears any committed filter for the duration of the hover.
  // A real hover always outranks the idle cycle.
  const previewTag =
    hovered === "Archive" ? null : hoveredTag ?? ambientTag ?? selectedTag;
  const previewing =
    Boolean(hoveredTag) || Boolean(ambientTag) || hovered === "Archive";
  // The Information text waits for the menu's closing pass to finish before it
  // opens the bar rule and fades in.
  const infoExpanded = infoActive && !indexClosing;
  const active = infoActive ? "Information" : archiveActive ? "Archive" : null;
  const isHighlighted = (label) =>
    hovered === label || (label === "Archive" ? pinned === "Archive" : infoPinned);

  // Hydrate state from URL on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const tag = params.get("tag");
    if (view === "info") {
      setInfoPinned(true);
    } else if (view === "archive") {
      setPinned("Archive");
      if (tag) setSelectedTag(tag);
    }
  }, []);

  // Sync URL whenever archive/info state changes.
  useEffect(() => {
    let url = "/";
    if (infoPinned) {
      url = "/?view=info";
    } else if (pinned === "Archive") {
      if (selectedTag) {
        url = `/?view=archive&tag=${encodeURIComponent(selectedTag)}`;
      } else {
        url = "/?view=archive";
      }
    }
    window.history.replaceState(null, "", url);
  }, [pinned, infoPinned, selectedTag]);

  useEffect(() => {
    if (!pinned && !infoPinned && openedKey === null) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // The viewer sits on top, so it is what Escape dismisses first.
      if (openedKey !== null) closeViewer();
      else returnToIndex();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, infoPinned, openedKey]);

  // The bar always takes at least this long to cross, even from cache, and never
  // runs ahead of what has actually loaded.
  useEffect(() => {
    const started = performance.now();
    let frame = requestAnimationFrame(function tick() {
      // Held at zero until the wordmark has had its moment.
      const elapsed = Math.max(0, performance.now() - started - INTRO_NAME_MS);
      const byClock = Math.min(1, elapsed / INTRO_MIN_MS);
      // The clock sets the floor so a warm cache still sweeps; the network can
      // only ever hold it back.
      const next = Math.min(byClock, loadFractionRef.current);
      setIntroProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // First pass: every tile at the small size. Progress drives the bar rule.
  useEffect(() => {
    const list = galleryRef.current;
    if (!list.length) {
      setSmallsLoaded(true);
      return;
    }
    let cancelled = false;
    let done = 0;
    const settle = () => {
      if (cancelled) return;
      done += 1;
      setLoadedCount(done);
      if (done === list.length) setSmallsLoaded(true);
    };
    const loaders = list.map((img) => {
      const im = new Image();
      im.onload = settle;
      im.onerror = settle;
      im.src = sizedTile(img.url, TILE_SRC_SMALL);
      return im;
    });
    return () => {
      cancelled = true;
      loaders.forEach((im) => {
        im.onload = null;
        im.onerror = null;
      });
    };
  }, [totalTiles]);

  // Second pass, once the grid is up: warm the sharper set so expanding the
  // Archive or choosing a filter swaps to it from cache rather than fetching.
  useEffect(() => {
    if (!imagesReady) return;
    const list = galleryRef.current;
    if (!list.length) {
      setHiResReady(true);
      return;
    }
    let cancelled = false;
    let done = 0;
    const settle = () => {
      if (cancelled) return;
      done += 1;
      if (done === list.length) setHiResReady(true);
    };
    const loaders = list.map((img) => {
      const im = new Image();
      im.onload = settle;
      im.onerror = settle;
      im.src = sizedTile(img.url, TILE_SRC_LARGE);
      return im;
    });
    return () => {
      cancelled = true;
      loaders.forEach((im) => {
        im.onload = null;
        im.onerror = null;
      });
    };
  }, [imagesReady]);

  // In grid mode, fetch the master-quality file for whatever is actually on screen
  // so that clicking a tile opens the full-quality image rather than an upscaled
  // thumbnail. Off-screen tiles are left alone until they scroll into view.
  useEffect(() => {
    if (!archiveActive || !imagesReady) return;
    const root = gridScrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          requestMaster(entry.target.dataset.tileKey);
        }
      },
      { root, rootMargin: "200px" }
    );

    root.querySelectorAll("[data-tile-key]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [archiveActive, imagesReady, previewTag]);

  // The credit line's hover behaviour lives in its own script.
  useEffect(() => initFinalResearch(), []);

  // Both directions are the same two steps: fade the grid out, change its size
  // while nothing is visible, fade it back in. Done on the container rather than
  // per tile, so the layout can never reflow under anything on screen.
  const prevArchive = useRef(archiveActive);
  useEffect(() => {
    const was = prevArchive.current;
    prevArchive.current = archiveActive;
    // Nothing to play on first mount, only on a change.
    if (was === archiveActive) return;

    const root = gridScrollRef.current;
    if (!root) {
      setExpandedLayout(archiveActive);
      return;
    }

    // Every element whose size, gap or opacity is class-driven has to be held, or
    // the resize animates back in view instead of happening instantly while the
    // grid is hidden.
    const grid = root.querySelector("div.grid");
    const held = [root, grid, ...(grid ? grid.querySelectorAll("img") : [])].filter(
      Boolean
    );
    held.forEach((el) => {
      el.style.transition = "none";
    });

    // Where the grid settles once it is back: full strength expanded, and its
    // resting dimness otherwise.
    const settled = archiveActive ? 1 : previewing ? 0.2 : 0.1;

    let cancelled = false;
    let anim = root.animate(
      [{ opacity: getComputedStyle(root).opacity }, { opacity: 0 }],
      { duration: GRID_FADE_MS, easing: "linear", fill: "both" }
    );

    anim.finished
      .then(() => {
        if (cancelled) return;
        setExpandedLayout(archiveActive);
        // Invisible here, so it can simply start from the top: no need to hold a
        // position or force one against a container that is changing.
        root.scrollTop = 0;
        requestAnimationFrame(() => {
          root.scrollTop = 0;
          if (cancelled) return;
          anim = root.animate([{ opacity: 0 }, { opacity: settled }], {
            duration: GRID_FADE_MS,
            easing: "linear",
            fill: "both",
          });
          anim.finished
            .then(() => {
              if (cancelled) return;
              held.forEach((el) => el.style.removeProperty("transition"));
              anim.cancel();
            })
            .catch(() => {});
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      held.forEach((el) => el.style.removeProperty("transition"));
      anim.cancel();
    };
  }, [archiveActive]);

  // Switching filters without leaving the grid has no fade to hide behind, so the
  // jump to the top happens here. Entering and leaving the grid are handled in the
  // fade itself, at the point where nothing is visible.
  useEffect(() => {
    if (keepScroll.current) {
      keepScroll.current = false;
      return;
    }
    if (!archiveActive) return;
    const el = gridScrollRef.current;
    if (el) el.scrollTop = 0;
  }, [selectedTag]);

  // Growing and shrinking are timed separately: the transition that runs is the
  // one belonging to the state being entered, so this reads as the grow duration
  // on the way in and the shrink duration on the way out.
  const EXPAND_TIMING = archiveActive
    ? "duration-[229ms] ease-linear"
    : "duration-[687ms] ease-linear";

  // The cycle runs on the bare home screen and behind the Information text, and
  // only once the grid is there to look at.
  const ambientEligible =
    imagesReady && !pinned && !indexOpen && !indexClosing && openedKey === null;

  useEffect(() => {
    if (!ambientEligible || !tags?.length) {
      setAmbientTag(null);
      return;
    }

    let idleTimer = null;
    let stepTimer = null;
    let i = 0;

    const start = () => {
      i = 0;
      setAmbientTag(tags[0]._id);
      stepTimer = setInterval(() => {
        i = (i + 1) % tags.length;
        setAmbientTag(tags[i]._id);
      }, AMBIENT_STEP_MS);
    };

    // Behind the Information text it starts straight away and keeps going: the
    // visitor is reading, not browsing, so there is nothing to wait for and
    // nothing their pointer should interrupt.
    if (infoExpanded) {
      start();
      return () => {
        if (stepTimer) clearInterval(stepTimer);
      };
    }

    const reset = () => {
      clearTimeout(idleTimer);
      if (stepTimer) {
        clearInterval(stepTimer);
        stepTimer = null;
      }
      setAmbientTag(null);
      idleTimer = setTimeout(start, AMBIENT_IDLE_MS);
    };

    const events = ["pointermove", "pointerdown", "wheel", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearTimeout(idleTimer);
      if (stepTimer) clearInterval(stepTimer);
    };
  }, [ambientEligible, infoExpanded, tags]);

  // Clicking an entry unmounts the menu, so its mouseleave never fires and the
  // hovered tag would stay set — which keeps previewing a filter that is no
  // longer chosen. Clear it whenever the menu goes away.
  useEffect(() => {
    if (!indexOpen) setHoveredTag(null);
  }, [indexOpen]);

  // Opening the index draws the rule from the top of the screen to the bottom at
  // a constant speed, and each entry fades in as the rule arrives at it. Delays
  // come from each element's own height, so the travel stays even no matter how
  // many entries there are. Driven by the Web Animations API rather than classes
  // so the timings can be computed without reaching for a JSX style prop.
  useEffect(() => {
    const list = menuListRef.current;
    if (!list) return;

    const listBox = list.getBoundingClientRect();
    if (!listBox.height) {
      list.style.opacity = "1";
      return;
    }

    const closing = !indexOpen;
    const pxPerMs = listBox.height / INDEX_DRAW_MS;

    // Each element's slot, timed from where it actually sits rather than from a
    // running total of heights, so the gaps between entries are travelled too.
    const slots = [...list.children].map((el) => {
      const box = el.getBoundingClientRect();
      const isEntry = el.hasAttribute("data-menu-item");
      return {
        el,
        isEntry,
        delay: (box.top - listBox.top) / pxPerMs,
        duration: isEntry ? INDEX_ENTRY_FADE_MS : Math.max(1, box.height / pxPerMs),
      };
    });

    // Closing is the opening pass run backwards end to end, not merely each piece
    // played in reverse: mirroring every slot about the total duration makes the
    // rule retract from the bottom of the screen upward and the entries leave in
    // the opposite order to the one they arrived in.
    const span = Math.max(...slots.map((s) => s.delay + s.duration));

    const running = slots.map(({ el, isEntry, delay, duration }) =>
      el.animate(
        isEntry
          ? [{ opacity: 0 }, { opacity: 0.8 }]
          : [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
        {
          duration,
          delay: closing ? span - delay - duration : delay,
          easing: isEntry ? "ease-out" : "linear",
          direction: closing ? "reverse" : "normal",
          // `both` holds the start state through the delay and the end state
          // afterwards, so nothing flashes at either end of the sequence.
          fill: "both",
        }
      )
    );

    // Safe now: every element is holding the first frame of its own animation.
    list.style.opacity = "1";

    if (closing) {
      Promise.all(running.map((a) => a.finished.catch(() => {}))).then(() =>
        setIndexClosing(false)
      );
    }

    return () => running.forEach((a) => a.cancel());
  }, [indexOpen, indexClosing, tags?.length]);

  // Position the bar rule around the index entry that lands on the bar line. The
  // bar row spans the viewport, so its own 50% is the screen centre the vertical
  // menu is aligned to. Written to the nodes directly to keep measured values out
  // of JSX style props.
  useEffect(() => {
    const apply = () => {
      const row = barRowRef.current;
      const wm = wordmarkRef.current;
      const left = ruleLeftRef.current;
      const right = ruleRightRef.current;
      if (!row || !wm || !left || !right) return;

      const rowBox = row.getBoundingClientRect();
      const anchor = rightAnchorRef.current;
      const startX = wm.getBoundingClientRect().right - rowBox.left + 6;
      const endX =
        (anchor ? anchor.getBoundingClientRect().left : rowBox.right) - rowBox.left - 6;

      if (!imagesReady) {
        // The rule is a progress bar first: it grows from the wordmark and stops
        // where the index control begins.
        left.style.left = `${startX}px`;
        left.style.width = `${Math.max(0, (endX - startX) * introProgress)}px`;
        right.style.display = "none";
        return;
      }

      let gapHalf = 0;
      let centre = 0;
      const info = infoBlockRef.current;
      const list = menuListRef.current;
      if (info) {
        // Whole-pixel top, so the text never lands on a half pixel.
        info.style.top = `${Math.round((window.innerHeight - info.offsetHeight) / 2)}px`;
      }
      if (list) {
        const lineY = rowBox.top + rowBox.height / 2;
        for (const el of list.querySelectorAll("[data-menu-item]")) {
          const b = el.getBoundingClientRect();
          if (b.top - 6 <= lineY && b.bottom + 6 >= lineY) {
            gapHalf = b.width / 2 + 6;
            centre = b.left + b.width / 2 - rowBox.left;
            break;
          }
        }
      }

      if (gapHalf > 0) {
        left.style.left = `${startX}px`;
        left.style.width = `${Math.max(0, centre - gapHalf - startX)}px`;
        right.style.removeProperty("display");
        right.style.left = `${centre + gapHalf}px`;
        right.style.width = `${Math.max(0, endX - centre - gapHalf)}px`;
      } else {
        left.style.left = `${startX}px`;
        left.style.width = `${Math.max(0, endX - startX)}px`;
        right.style.display = "none";
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    if (barRowRef.current) ro.observe(barRowRef.current);
    if (menuListRef.current) ro.observe(menuListRef.current);
    if (infoBlockRef.current) ro.observe(infoBlockRef.current);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [indexOpen, indexClosing, pinned, infoPinned, infoExpanded, tags?.length, selectedTag, imagesReady, introProgress]);

  // Opening and closing both go through here so the mounted state and the
  // animation phase always change together. Setting them in one handler keeps
  // them in a single render: closing via two separate updates unmounted the menu
  // for a frame and flashed it back in.
  const toggleIndex = () => {
    if (menuPending) {
      if (menuDelay.current) clearTimeout(menuDelay.current);
      setMenuPending(false);
      setHoverLocked(true);
      setHovered(null);
      return;
    }
    if (indexOpen) {
      setIndexOpen(false);
      setIndexClosing(true);
      // Lock hover on the way out so the pointer can't re-trigger a view.
      setHoverLocked(true);
    } else {
      setIndexClosing(false);
      setIndexOpen(true);
      // ...but leave it unlocked on the way in, or the first hover over an entry
      // does nothing.
      setHoverLocked(false);
    }
    setHovered(null);
  };

  // The wordmark is a reset: it dismisses whatever is open and returns to the
  // resting home view without reloading the page.
  const goHome = (e) => {
    e.preventDefault();
    // Otherwise the click also reaches `main`, which would reopen the index.
    e.stopPropagation();
    if (viewerTimer.current) clearTimeout(viewerTimer.current);
    if (viewerFrame.current) cancelAnimationFrame(viewerFrame.current);
    if (menuDelay.current) clearTimeout(menuDelay.current);
    setMenuPending(false);
    setOpenedKey(null);
    setViewerVisible(false);
    const wasExpanded = archiveActive;
    setPinned(null);
    setInfoPinned(false);
    setHovered(null);
    setHoverLocked(true);
    setIndexOpen(false);
    setIndexClosing(false);
    if (wasExpanded) {
      // Let the grid fade out exactly as it looks now. Clearing the filter here
      // would light the dimmed tiles back up while it is still on screen; it is
      // dropped later, once the grid is hidden.
      menuDelay.current = setTimeout(() => setSelectedTag(null), GRID_FADE_MS);
    } else {
      setSelectedTag(null);
    }
  };

  const requestMaster = (key) => {
    if (!key || masterRequested.current.has(key)) return;
    const img = galleryRef.current.find(
      (g, i) => `${g.projectId}-${g._key ?? i}` === key
    );
    if (!img) return;
    masterRequested.current.add(key);
    const full = new Image();
    full.onload = () =>
      setMastersReady((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    full.src = masterSrc(img.url);
  };

  const openViewer = (key) => {
    if (viewerTimer.current) clearTimeout(viewerTimer.current);
    setOpenedKey(key);
    // If this one was never on screen long enough to be fetched, start it now.
    requestMaster(key);
    // Mount at zero, then flip on the next frame so the transition has somewhere
    // to run from.
    viewerFrame.current = requestAnimationFrame(() => setViewerVisible(true));
  };

  // A transition rather than a keyframe pass, so closing reverses from wherever
  // the opening got to instead of snapping to full first.
  const closeViewer = () => {
    if (openedKey === null || !viewerVisible) return;
    setViewerVisible(false);
    viewerTimer.current = setTimeout(() => setOpenedKey(null), VIEWER_FADE_MS);
  };

  useEffect(() => () => {
    if (viewerTimer.current) clearTimeout(viewerTimer.current);
    if (viewerFrame.current) cancelAnimationFrame(viewerFrame.current);
    if (menuDelay.current) clearTimeout(menuDelay.current);
  }, []);

  // Leaving any view drops back to the index rather than all the way out, since
  // there is no other route back to the menu from inside a view.
  const returnToIndex = () => {
    setHovered(null);
    setHoverLocked(false);
    // Leaving the expanded grid, the menu holds back until the grid has faded
    // out, so it draws itself while the grid fades back in rather than over the
    // top of it on its way out.
    const wasExpanded = archiveActive;
    setPinned(null);
    setInfoPinned(false);
    setIndexClosing(false);
    if (menuDelay.current) clearTimeout(menuDelay.current);
    if (wasExpanded) {
      setMenuPending(true);
      menuDelay.current = setTimeout(() => {
        setMenuPending(false);
        // Held until the grid is hidden: clearing it any earlier would light the
        // filtered-out tiles back up while the grid is still on screen, so it
        // would fade out in a different state to the one it was in.
        setSelectedTag(null);
        setIndexOpen(true);
      }, GRID_FADE_MS);
    } else {
      setSelectedTag(null);
      setIndexOpen(true);
    }
  };

  const handleClick = (label) => {
    setHoverLocked(true);
    setHovered(null);
    // Let the menu run its closing pass rather than vanishing; the chosen view
    // waits for it to finish.
    if (indexOpen) setIndexClosing(true);
    setIndexOpen(false);
    if (label === "Information") {
      setInfoPinned((prev) => !prev);
      setPinned(null);
    } else {
      // Archive means "show everything", so it always opens rather than toggling:
      // choosing it while a tag was active used to close the view instead of
      // clearing the filter.
      setPinned(label);
      setInfoPinned(false);
      if (label === "Archive") setSelectedTag(null);
    }
  };

  const toggleTag = (id) => {
    setSelectedTag((prev) => {
      const next = prev === id ? null : id;
      // Picking a tag from the index is a request to see the Archive filtered by
      // it; clearing one leaves whatever view is already open alone.
      if (next && pinned !== "Archive") {
        setPinned("Archive");
        setInfoPinned(false);
        setHovered(null);
        setHoverLocked(true);
        // Let the menu run its closing pass, the same as choosing Archive or
        // Information; without this it simply vanished.
        if (indexOpen) setIndexClosing(true);
        setIndexOpen(false);
      }
      return next;
    });
  };

  // Menu and filters share one list, so the centre rule can be broken between
  // every entry regardless of which kind it is.
  const menuEntries = [
    ...items.map((item) => ({
      key: item.small,
      label: item.small,
      active: isHighlighted(item.big),
      onMouseEnter: () => { if (!isTouchDevice.current && !hoverLocked) setHovered(item.big); },
      onMouseLeave: () => {
        if (!isTouchDevice.current) setHovered(null);
        setHoverLocked(false);
      },
      onClick: () => handleClick(item.big),
    })),
    ...(tags ?? []).map((tag) => ({
      key: tag._id,
      label: tag.name,
      active: selectedTag === tag._id || hoveredTag === tag._id,
      onMouseEnter: () => { if (!isTouchDevice.current) setHoveredTag(tag._id); },
      onMouseLeave: () => { if (!isTouchDevice.current) setHoveredTag(null); },
      onClick: () => toggleTag(tag._id),
    })),
  ];

  const galleryTiles = () =>
    galleryImages.map((img, i) => {
      const key = `${img.projectId}-${img._key ?? i}`;
      const filteredOut = previewTag && !img.tagIds.includes(previewTag);
      // Desaturated per image rather than through a pane laid over the top: on the
      // home screen every tile is grey, and inside the Archive only the ones
      // outside the current filter are.
      const desaturate = filteredOut || !expandedLayout;
      return (
        <img
          key={key}
          // Left unset until the first pass completes: otherwise the markup's own
          // images start downloading before hydration and the progress bar has
          // nothing left to report.
          src={
            imagesReady
              ? sizedTile(img.url, hiResReady ? TILE_SRC_LARGE : TILE_SRC_SMALL)
              : undefined
          }
          data-tile-key={key}
          alt={filteredOut ? "" : img.title || ""}
          aria-hidden={filteredOut || undefined}
          onClick={
            archiveActive
              ? (e) => {
                  e.stopPropagation();
                  // A tile outside the current filter switches the view to its own
                  // group rather than opening; one inside it opens as usual.
                  if (filteredOut) {
                    const next =
                      img.tagIds.find((t) => t !== selectedTag) ?? img.tagIds[0];
                    if (next) {
                      keepScroll.current = true;
                      setSelectedTag(next);
                    }
                    return;
                  }
                  openViewer(key);
                }
              : undefined
          }
          // Capped well under the track width, so the tiles sit small and centred
          // inside their six columns rather than filling them. Opening the Archive
          // lifts the cap to the track width, which is what makes them grow.
          className={`w-full h-auto transition-[max-width,opacity,filter] ${
            // The idle cycle drifts; everything the visitor drives stays quick.
            ambientTag ? AMBIENT_FADE : EXPAND_TIMING
          } ${
            archiveActive ? "cursor-pointer" : "pointer-events-none"
          } ${
            expandedLayout
              ? "max-w-[calc(25vw-4.5px)] md:max-w-[calc(16.6666vw-5px)]"
              : "max-w-[9vw] md:max-w-[6vw]"
          } ${filteredOut ? "opacity-5" : "opacity-100"} ${
            desaturate ? "grayscale" : "grayscale-0"
          }`}
        />
      );
    });

  return (
    <main
      className="min-h-screen"
      onClick={() => {
        // Anywhere on the resting home view is a target for opening the index.
        // Scrolling is untouched: the gallery is its own scroll container and
        // nothing here blocks pointer events on it.
        if (imagesReady && !pinned && !infoPinned && !indexOpen && !menuPending) {
          setIndexOpen(true);
          setHoverLocked(false);
          setHovered(null);
        }
      }}
    >
      {galleryImages.length > 0 && (
        <>
          <div
            ref={gridScrollRef}
            // The grid stays put in every state. Information simply draws on top
            // of it, the Archive brings it to full strength, and hovering a tag
            // lifts it part way so the matching tiles read at about 20%.
            className={`fixed inset-0 overscroll-contain [overflow-anchor:none] z-0 transform-gpu will-change-[opacity] transition-opacity ${
              ambientTag ? AMBIENT_FADE : EXPAND_TIMING
            } ${
              expandedLayout ? "overflow-y-auto" : "overflow-hidden"
            } ${
              !imagesReady
                ? "opacity-0"
                : expandedLayout
                  ? "opacity-100"
                  : previewing
                    ? "opacity-20"
                    : "opacity-10"
            }`}
          >
            {/* Four equal columns on phones, six on desktop, across the whole
                viewport either way. items-start matters:
                grid items stretch to the tallest in their row by default, which
                would override the tiles' auto height and distort them. */}
            <div
              className={`grid w-full grid-cols-4 md:grid-cols-6 items-start justify-items-center gap-x-[6px] transition-[row-gap] ${EXPAND_TIMING} ${
                // Expanded, the last row should meet the bottom of the viewport.
                expandedLayout ? "pb-0" : "pb-[30px]"
              } ${
                expandedLayout ? "gap-y-[6px]" : "gap-y-[8vh]"
              }`}
            >
              {galleryTiles()}
            </div>
          </div>

        </>
      )}

      {/* Temporarily commented out — big bottom text. Keep for possible reuse.
      <div className="fixed bottom-[30px] left-0 right-0 text-left text-[clamp(40px,18vw,190px)] md:text-[clamp(30px,13.5vw,142px)] select-none leading-none tracking-[-0.03em] px-[15px] text-[var(--color-main)] flex flex-wrap items-end gap-x-[0.131em] overflow-visible">
      </div>
      */}

      {/* Opening the index draws a rule down the centre of the screen, broken by
          every entry. The two flex-1 segments run to the top and bottom edges;
          the fixed 48px segments sit between entries, and with 6px either side
          they set the 60px spacing. The wrapper stays transparent to the pointer
          so the grid still scrolls behind it. */}
      {(indexOpen || indexClosing) && (
        <div
          ref={menuListRef}
          // Starts hidden: when the open is triggered by a timer rather than a
          // click, React doesn't flush the animation effect before paint, and the
          // menu would flash fully drawn for a frame. The effect reveals it.
          className="fixed inset-0 z-20 flex flex-col items-center gap-[25px] text-[var(--color-text)] pointer-events-none opacity-0"
        >
          <div className="flex-1 w-px origin-top bg-current opacity-50" aria-hidden="true" />
          {menuEntries.map((entry) => (
            <Fragment key={entry.key}>
              <span
                data-menu-item=""
                className={`pointer-events-auto opacity-80 text-[15px] leading-none font-menu tracking-[-0.03em] cursor-pointer select-none transition-colors duration-200 ease-out ${
                  entry.active ? "text-[var(--color-highlight)]" : ""
                }`}
                onMouseEnter={entry.onMouseEnter}
                onMouseLeave={entry.onMouseLeave}
                onClick={entry.onClick}
              >
                {entry.label}
              </span>
            </Fragment>
          ))}
          <div className="flex-1 w-px origin-top bg-current opacity-50" aria-hidden="true" />
        </div>
      )}

      {/* A single image, centred in the viewport with its project title along the
          bottom. The image is contained within the viewport, leaving room for the
          title rather than filling the screen. It carries its own translucent fill
          and backdrop filter, so the grid behind is dimmed and desaturated by this
          one element fading in rather than by animating every tile. */}
      {openedImage && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-80)] backdrop-grayscale cursor-pointer transition-opacity duration-[400ms] ease-linear ${
            viewerVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            closeViewer();
          }}
        >
          {/* Two layers. The duplicate of the tile is what actually appears, fading
              in with the modal itself since the browser already has it. It sits
              blurred right down until the master is in hand, at which point the
              master crossfades over the top. */}
          <div className="relative h-[calc(100vh-90px)] w-[calc(100vw-60px)]">
            <img
              src={sizedTile(openedImage.url, hiResReady ? TILE_SRC_LARGE : TILE_SRC_SMALL)}
              alt={openedImage.title || ""}
              className={`absolute inset-0 h-full w-full object-contain transition-[filter] duration-[400ms] ease-linear ${
                mastersReady.has(openedKey) ? "blur-0" : "blur-[32px]"
              }`}
            />
            {mastersReady.has(openedKey) && (
              <img
                src={masterSrc(openedImage.url)}
                alt=""
                aria-hidden="true"
                className="animate-fade-in-quick absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
          <span className="pointer-events-none absolute bottom-[15px] left-1/2 -translate-x-1/2 inline-flex items-center justify-center bg-[var(--color-bg)] p-[3px] text-[var(--color-text-80)] text-[15px] leading-none font-menu tracking-[-0.03em]">
            <span className="block translate-y-[1.375px]">{openedImage.title}</span>
          </span>
        </div>
      )}

      {/* The bar is anchored by its own top edge rather than centred, so the lift
          is a plain transform. The Information column hangs directly beneath the
          bar row inside the same element, hidden until the bar rises. */}
      <header
        className="fixed top-[calc(var(--bar-top)_-_15px)] left-0 right-0 text-[var(--color-text)] z-30 pointer-events-none"
      >
        {/* The whole bar steps aside while an image is open, on the same timing as
            everything else in that transition. */}
        <div
          ref={barRowRef}
          className={`relative h-[30px] px-[15px] flex items-center justify-between transition-opacity duration-[400ms] ease-linear ${
            viewerVisible ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
        <a
          ref={wordmarkRef}
          href="/"
          onClick={goHome}
          className="animate-fade-in pointer-events-auto inline-flex items-center justify-center bg-[var(--color-bg)] p-[3px] -m-[3px] text-[var(--color-text-80)] text-[15px] leading-none font-menu tracking-[-0.03em] select-none transition-colors duration-200 ease-out md:hover:text-[var(--color-highlight)]"
        >
          {/* The labels have no descenders, so the font's descent space leaves the
              ink sitting high in the plate. Nudge it down to optically centre it
              while keeping the padding at 1px. */}
          <span className="block translate-y-[1.375px]">Eric Tsui</span>
        </a>
        {/* The rule is two absolutely positioned halves rather than one flex child,
            so it can leave a gap around whichever index entry sits on the bar
            line. Their offsets are measured below. With the index shut the right
            half is hidden and the left one spans the whole run. */}
        {/* Hidden while the index is up, so the centre rule is the only line on
            screen; while the Information text is up, which wants a clear field;
            and while the grid is expanded, so nothing cuts across it. It returns
            once those have gone. */}
        <div
          ref={ruleLeftRef}
          className={`absolute top-1/2 w-0 h-px bg-current transition-opacity duration-300 ease-in-out ${
            indexOpen || indexClosing || infoExpanded || archiveActive || menuPending
              ? "opacity-0"
              : "opacity-50"
          }`}
          aria-hidden="true"
        />
        <div
          ref={ruleRightRef}
          className={`absolute top-1/2 w-0 h-px bg-current transition-opacity duration-300 ease-in-out ${
            indexOpen || indexClosing || infoExpanded || archiveActive || menuPending
              ? "opacity-0"
              : "opacity-50"
          }`}
          aria-hidden="true"
        />
        {/* The same control opens and closes the index, so it renames itself. The
            click on main can't reopen it: that handler bails while indexOpen is
            still true in this render. */}
        {/* Present from the start even while invisible, so it holds its place in
            the row: the bar measures its end against this element, and without it
            the opening sweep would run past to the edge of the screen and then
            snap back once it appeared. */}
        {!(pinned || infoPinned) && (
          <span
            ref={rightAnchorRef}
            className={`inline-flex items-center justify-center bg-[var(--color-bg)] p-[3px] -m-[3px] text-[var(--color-text-80)] text-[15px] leading-none font-menu tracking-[-0.03em] select-none transition-[color,opacity] duration-[1600ms] ease-out md:hover:text-[var(--color-highlight)] ${
              imagesReady
                ? "pointer-events-auto cursor-pointer opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            onClick={imagesReady ? toggleIndex : undefined}
          >
            <span className="block translate-y-[1.375px]">
              {indexOpen || menuPending ? "Close" : "Index"}
            </span>
          </span>
        )}
        {(pinned || infoPinned) && (
            <button
              ref={rightAnchorRef}
              type="button"
              onClick={returnToIndex}
              className="pointer-events-auto inline-flex items-center justify-center bg-[var(--color-bg)] p-[3px] -m-[3px] text-[var(--color-text-80)] text-[15px] leading-none font-menu tracking-[-0.03em] cursor-pointer select-none transition-colors duration-200 ease-out md:hover:text-[var(--color-highlight)]"
            >
              <span className="block translate-y-[1.375px]">
                {archiveActive ? "Index" : "Close"}
              </span>
            </button>
        )}
        {/* Centred in the viewport rather than on the bar, so it stays put if the
            bar ever moves off centre. Fixed, so it adds no height to the header.
            It sits above everything and takes pointer events while it is up, so
            the text can be selected and its links followed; while it is hidden it
            inherits the header's pointer-events:none and lets the grid scroll. The
            vertical offset is set in the effect below, rounded to a whole pixel. */}
        <div
          ref={infoBlockRef}
          className={`fixed left-1/2 z-40 w-[35%] -translate-x-1/2 text-center font-menu-roman text-[14px] leading-none tracking-[-0.03em] transition-opacity duration-300 ease-in-out ${
            infoExpanded ? "opacity-80 pointer-events-auto" : "opacity-0"
          }`}
        >
          {information?.body && (
            <div className="text-[14px] pb-[var(--info-gap)]">
              <PortableText value={information.body} components={portableTextComponents} />
            </div>
          )}
          {clients?.header && (
            <div className="mt-[4em]">
              <PortableText value={clients.header} components={portableTextComponents} />
            </div>
          )}
          {clients?.list && (
            <div className="mt-[1em]">
              <PortableText value={clients.list} components={portableTextComponents} />
            </div>
          )}
          <div className="mt-[4em] pb-[15px]">
            <a
              id="final-research"
              href="https://finalresearch.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="final-research-default">website by FINAL RESEARCH</span>
              <span className="final-research-hover" aria-hidden="true" />
            </a>
          </div>
        </div>
        </div>
      </header>
    </main>
  );
}
