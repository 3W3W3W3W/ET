"use client";

import { useState, useEffect, useRef } from "react";
import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "./portableTextComponents";

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

const items = [
  { big: "Information", small: "Information" },
  { big: "Archive", small: "Archive" },
];

export default function HomeClient({ information, clients, projects, tags, portfolio }) {
  const isTouchDevice = useRef(false);
  useEffect(() => {
    isTouchDevice.current = window.matchMedia("(hover: none)").matches;
  }, []);

  const [hovered, setHovered] = useState(null);
  const [hoverLocked, setHoverLocked] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [infoPinned, setInfoPinned] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [hoveredTag, setHoveredTag] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const expandedItemRefs = useRef({});
  const panelRef = useRef(null);

  // Flat list of all portfolio images in order: project 1 images, project 2 images, …
  const carouselImages = (portfolio?.projects ?? []).flatMap((p) =>
    (p.images ?? []).filter((img) => img?.url).map((img) => ({ ...img, projectTitle: p.title }))
  );
  const totalImages = carouselImages.length;

  // Single global index across all carousel images.
  const [globalIndex, setGlobalIndex] = useState(0);
  const safeIndex = totalImages > 0 ? ((globalIndex % totalImages) + totalImages) % totalImages : 0;
  const homeImage = carouselImages[safeIndex] ?? null;
  const activeTitle = homeImage?.projectTitle ?? null;

  const wheelCooldown = useRef(false);

  const [autoplay, setAutoplay] = useState(true);
  const autoplayRef = useRef(true);
  const [displayedGlobalIndex, setDisplayedGlobalIndex] = useState(0);
  const [displayedTitle, setDisplayedTitle] = useState(null);
  const [bottomVisible, setBottomVisible] = useState(true);
  const displayedIndexTimer = useRef(null);

  // Two persistent image layers for crossfade.
  const [layerUrls, setLayerUrls] = useState([null, null]);
  const [visibleLayer, setVisibleLayer] = useState(0);
  const visRef = useRef(0);
  const prevUrlRef = useRef(null);
  const forceImmediateRef = useRef(false);

  // Refs so the crossfade effect can read current values without them being deps.
  const globalIndexRef = useRef(safeIndex);
  useEffect(() => { globalIndexRef.current = safeIndex; }, [safeIndex]);
  const activeTitleRef = useRef(activeTitle);
  useEffect(() => { activeTitleRef.current = activeTitle; }, [activeTitle]);

  // Images shown in the Archive grid — all of them, or filtered by selected tag.
  const archiveImages = (
    selectedTag
      ? (projects ?? []).filter((p) => p.tags?.some((t) => t._id === selectedTag))
      : projects ?? []
  ).flatMap((p) =>
    (p.images ?? [])
      .filter((img) => img?.url)
      .map((img) => ({ ...img, projectId: p._id, title: p.title }))
  );

  const infoActive = infoPinned || hovered === "Information";
  const archiveActive = pinned === "Archive" || hovered === "Archive";
  const active = infoActive ? "Information" : archiveActive ? "Archive" : null;
  const isHighlighted = (label) =>
    hovered === label || (label === "Archive" ? pinned === "Archive" : infoPinned);

  // Preload all images.
  const preloadCache = useRef(new Map());
  useEffect(() => {
    const sources = [...(projects ?? []), ...(portfolio?.projects ?? [])];
    const urls = sources.flatMap((p) =>
      (p.images ?? []).map((img) => img?.url).filter(Boolean)
    );
    const cache = preloadCache.current;
    urls.forEach((url) => {
      if (cache.has(url)) return;
      const im = new Image();
      im.src = url;
      im.decode().catch(() => {});
      cache.set(url, im);
    });
  }, [projects, portfolio]);

  // Hydrate state from URL on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const tag = params.get("tag");
    const image = params.get("image");
    if (view === "info") {
      setInfoPinned(true);
    } else if (view === "archive") {
      setPinned("Archive");
      if (tag) setSelectedTag(tag);
      if (image) setExpandedKey(image);
    }
  }, []);

  // Sync URL whenever archive/info state changes.
  useEffect(() => {
    let url = "/";
    if (infoPinned) {
      url = "/?view=info";
    } else if (pinned === "Archive") {
      if (expandedKey) {
        url = `/?view=archive&image=${encodeURIComponent(expandedKey)}`;
      } else if (selectedTag) {
        url = `/?view=archive&tag=${encodeURIComponent(selectedTag)}`;
      } else {
        url = "/?view=archive";
      }
    }
    window.history.replaceState(null, "", url);
  }, [pinned, infoPinned, expandedKey, selectedTag]);

  useEffect(() => {
    if (!pinned && !infoPinned && !expandedKey) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (expandedKey) {
          setExpandedKey(null);
        } else {
          setPinned(null);
          setInfoPinned(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, infoPinned, expandedKey]);

  useEffect(() => {
    if (!expandedKey) return;
    const el = expandedItemRefs.current[expandedKey];
    if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
  }, [expandedKey]);

  // Scroll navigates through all images in sequence.
  useEffect(() => {
    if (active || totalImages === 0) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (wheelCooldown.current) return;
      wheelCooldown.current = true;
      setTimeout(() => (wheelCooldown.current = false), 120);
      forceImmediateRef.current = true;
      setGlobalIndex((i) => i + (e.deltaY > 0 ? 1 : -1));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [active, totalImages]);

  // Autoplay: advance one image every 4.3s.
  useEffect(() => {
    if (!autoplay || totalImages === 0) return;
    const t = setTimeout(() => {
      setGlobalIndex((i) => i + 1);
    }, 4300);
    return () => clearTimeout(t);
  }, [autoplay, globalIndex, totalImages]);

  // Any user interaction pauses autoplay; resumes after 5s of inactivity.
  useEffect(() => {
    let resumeTimer = null;
    const pause = () => {
      autoplayRef.current = false;
      setAutoplay(false);
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { autoplayRef.current = true; setAutoplay(true); }, 5000);
    };
    const opts = { passive: true };
    window.addEventListener("wheel", pause, opts);
    window.addEventListener("pointerdown", pause, opts);
    window.addEventListener("touchstart", pause, opts);
    window.addEventListener("keydown", pause, opts);
    return () => {
      clearTimeout(resumeTimer);
      window.removeEventListener("wheel", pause);
      window.removeEventListener("pointerdown", pause);
      window.removeEventListener("touchstart", pause);
      window.removeEventListener("keydown", pause);
    };
  }, []);

  // Crossfade effect: drives image layers, title, and count in sync.
  useEffect(() => {
    const url = homeImage?.url ?? null;
    if (url === prevUrlRef.current) return;
    const first = prevUrlRef.current === null;
    prevUrlRef.current = url;
    if (!url) return;

    const immediate = forceImmediateRef.current;
    forceImmediateRef.current = false;
    const animate = !first && !immediate && autoplay;

    if (!animate) {
      const cur = visRef.current;
      setLayerUrls((prev) => {
        const next = [...prev];
        next[cur] = url;
        next[1 - cur] = url;
        return next;
      });
      clearTimeout(displayedIndexTimer.current);
      setBottomVisible(true);
      setDisplayedGlobalIndex(globalIndexRef.current);
      setDisplayedTitle(activeTitleRef.current);
      return;
    }

    const target = 1 - visRef.current;
    visRef.current = target;
    setLayerUrls((prev) => {
      const next = [...prev];
      next[target] = url;
      return next;
    });
    // Two rAFs let the new layer render at opacity-0 before the transition fires.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVisibleLayer(target);
      });
    });
    // Title + count fade out with old image, update + fade in with new image at 1400ms.
    clearTimeout(displayedIndexTimer.current);
    setBottomVisible(false);
    displayedIndexTimer.current = setTimeout(() => {
      setDisplayedGlobalIndex(globalIndexRef.current);
      setDisplayedTitle(activeTitleRef.current);
      setBottomVisible(true);
    }, 1400);
  }, [homeImage?.url, autoplay]);

  // Forward wheel events to the info panel while hovering (panel has pointer-events-none).
  useEffect(() => {
    if (!infoActive || infoPinned) return;
    if (panelRef.current) panelRef.current.scrollTop = 0;
    const onWheel = (e) => {
      const el = panelRef.current;
      if (!el) return;
      if (el.scrollHeight - el.clientHeight <= 1) return;
      el.scrollTop += e.deltaY;
      e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [infoActive, infoPinned]);

  const handleClick = (label) => {
    setHoverLocked(true);
    setHovered(null);
    if (label === "Information") {
      setInfoPinned((prev) => !prev);
      setPinned(null);
    } else {
      setPinned((prev) => (prev === label ? null : label));
      setInfoPinned(false);
      setExpandedKey(null);
    }
  };

  // Click navigation: step through images (and projects) immediately.
  const handleNav = (goNext) => {
    if (totalImages <= 1) return;
    forceImmediateRef.current = true;
    setGlobalIndex((i) => i + (goNext ? 1 : -1));
  };

  const toggleTag = (id) => {
    setSelectedTag((prev) => (prev === id ? null : id));
  };

  return (
    <main className="min-h-screen">
      {homeImage?.url && pinned !== "Archive" && (
        <div
          className={`fixed top-[30px] left-0 right-0 bottom-0 z-0 transition-opacity duration-150 ${
            active ? "opacity-20 pointer-events-none" : "opacity-100"
          }`}
        >
          {totalImages > 1 && (
            <>
              <div
                className="absolute top-0 left-0 w-1/4 h-full cursor-w-resize z-10"
                onClick={() => handleNav(false)}
              />
              <div
                className="absolute top-0 right-0 w-3/4 h-full cursor-e-resize z-10"
                onClick={() => handleNav(true)}
              />
            </>
          )}
          {[0, 1].map((i) =>
            layerUrls[i] ? (
              <img
                key={i}
                src={layerUrls[i]}
                alt=""
                aria-hidden={visibleLayer !== i}
                decoding="sync"
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[70vh] max-w-[70vw] w-auto h-auto transition-opacity ease-in-out duration-[1400ms] ${
                  visibleLayer === i ? "opacity-100 delay-[1400ms]" : "opacity-0 delay-0"
                }`}
              />
            ) : null
          )}
        </div>
      )}

      {activeTitle && pinned !== "Archive" && (
        <div className={`fixed bottom-0 left-0 right-0 h-[30px] px-[15px] flex items-center justify-between text-white z-20 select-none pointer-events-none transition-opacity duration-150 bg-black ${active === "Information" ? "opacity-20" : "opacity-100"}`}>
          <span className={`transition-opacity duration-[1400ms] ${bottomVisible ? "opacity-100" : "opacity-0"}`}>
            {displayedTitle ?? activeTitle}
          </span>
          {totalImages > 0 && (
            <span className={`transition-opacity duration-[1400ms] ${bottomVisible ? "opacity-100" : "opacity-0"}`}>
              {displayedGlobalIndex + 1} of {totalImages}
            </span>
          )}
        </div>
      )}

      {pinned === "Archive" && tags?.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 h-[30px] px-[15px] flex items-center z-20 select-none">
          <span className="text-white">
            <span>Type:</span>
            <span
              className={`cursor-pointer ml-[15px] ${selectedTag === null ? "text-[var(--color-highlight)]" : "hover:text-[var(--color-highlight)]"}`}
              onClick={() => setSelectedTag(null)}
            >
              All
            </span>
            {tags.map((tag) => (
              <span key={tag._id}>
                <span>, </span>
                <span
                  className={`cursor-pointer ${selectedTag === tag._id || hoveredTag === tag._id ? "text-[var(--color-highlight)]" : ""}`}
                  onMouseEnter={() => { if (!isTouchDevice.current) setHoveredTag(tag._id); }}
                  onMouseLeave={() => { if (!isTouchDevice.current) setHoveredTag(null); }}
                  onClick={() => toggleTag(tag._id)}
                >
                  {tag.name}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}

      {infoActive && (
        <div ref={panelRef} className={`fixed top-[30px] left-[15px] right-[15px] bottom-[30px] flex items-center overflow-y-auto text-white text-[15px] leading-none tracking-[-0.03em] z-10 ${infoPinned ? "" : "pointer-events-none [&_*]:pointer-events-none"}`}>
          <div>
            {information?.body && (
              <PortableText value={information.body} components={portableTextComponents} />
            )}
            {clients?.header && (
              <div className="mt-[4em]">
                <PortableText value={clients.header} components={portableTextComponents} />
              </div>
            )}
            {clients?.list && (
              <PortableText value={clients.list} components={portableTextComponents} />
            )}
            <div className="mt-[4em]">
              <p className="text-[11px] tracking-normal">website by FINAL RESEARCH</p>
            </div>
          </div>
        </div>
      )}

      {archiveActive && archiveImages.length > 0 && (
        <div className={`fixed top-[30px] left-0 right-0 bottom-0 overflow-y-auto z-0 transition-opacity duration-150 ${infoActive ? "opacity-20 pointer-events-none" : "opacity-100"} ${pinned === "Archive" && !infoActive ? "" : "pointer-events-none"}`}>
          {expandedKey ? (
            <div className="flex flex-col items-center gap-[30px] pb-[30px]">
              {archiveImages.map((img) => {
                const key = `${img.projectId}-${img._key}`;
                return (
                  <img
                    key={key}
                    ref={(el) => { expandedItemRefs.current[key] = el; }}
                    src={img.url}
                    alt={img.title || ""}
                    onClick={() => setExpandedKey(null)}
                    className="max-w-full max-h-[95vh] w-auto h-auto cursor-pointer sm:max-w-[95vw]"
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-[5px] pb-[5px]">
              {archiveImages.map((img) => {
                const key = `${img.projectId}-${img._key}`;
                return (
                  <img
                    key={key}
                    src={img.url}
                    alt={img.title || ""}
                    onClick={() => setExpandedKey(key)}
                    className="w-full h-auto cursor-pointer"
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Temporarily commented out — big bottom text. Keep for possible reuse.
      <div className="fixed bottom-[30px] left-0 right-0 text-left text-[clamp(40px,18vw,190px)] md:text-[clamp(30px,13.5vw,142px)] select-none leading-none tracking-[-0.03em] px-[15px] text-[var(--color-main)] flex flex-wrap items-end gap-x-[0.131em] overflow-visible">
      </div>
      */}

      <header
        className="fixed top-0 left-0 right-0 h-[30px] px-[15px] flex items-center justify-between text-white z-20"
        onMouseLeave={() => setHoverLocked(false)}
      >
        <a
          href="/"
          className="select-none transition-opacity duration-150 ease-in-out md:hover:opacity-50"
        >Eric Tsui</a>
        <div className="flex items-center gap-[15px]">
          {!(pinned || infoPinned) && items.map((item) => (
            <span
              key={item.small}
              className={`cursor-pointer select-none transition-colors duration-150 ease-in-out ${
                isHighlighted(item.big) ? "text-[var(--color-highlight)]" : ""
              }`}
              onMouseEnter={() => { if (!isTouchDevice.current && !hoverLocked) setHovered(item.big); }}
              onMouseLeave={() => { if (!isTouchDevice.current) setHovered(null); }}
              onClick={() => handleClick(item.big)}
            >
              {item.small}
            </span>
          ))}
          {(pinned || infoPinned) && (
            <button
              type="button"
              onClick={() => {
                setPinned(null);
                setInfoPinned(false);
                setExpandedKey(null);
                setHovered(null);
                setHoverLocked(true);
              }}
              className="cursor-pointer select-none bg-[var(--color-highlight)] text-black px-[15px] leading-none self-stretch -mr-[15px] h-[30px]"
            >
              close
            </button>
          )}
        </div>
      </header>
    </main>
  );
}
