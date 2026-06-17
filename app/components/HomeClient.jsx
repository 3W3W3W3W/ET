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
  const [hovered, setHovered] = useState(null);
  const [hoverLocked, setHoverLocked] = useState(false);
  const [pinned, setPinned] = useState(null);
  // Information is an overlay that dims whatever is behind it (home carousel or
  // archive grid), so it's tracked separately from the Archive pin.
  const [infoPinned, setInfoPinned] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [hoveredTag, setHoveredTag] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const expandedItemRefs = useRef({});
  const panelRef = useRef(null);

  // The home image sits in a fixed-size box sized to contain every image in the
  // active project (portrait or landscape), so the title below never shifts as
  // images swap. Sizing is in pixels, recomputed on resize.
  const homeBoxRef = useRef(null);

  // Project image carousel (left corner).
  const [projectIndex, setProjectIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [imgHovered, setImgHovered] = useState(false);
  const [projectPinned, setProjectPinned] = useState(false);
  const wheelCooldown = useRef(false);

  // Auto-slideshow: cycles through the active project's images and advances to
  // the next project at the end, looping forever. Any user interaction stops it
  // permanently (until the page is reloaded).
  const [autoplay, setAutoplay] = useState(true);
  const autoplayRef = useRef(true);
  const [displayedImageIndex, setDisplayedImageIndex] = useState(0);
  const displayedIndexTimer = useRef(null);
  // Two persistent image layers that never unmount; a transition swaps which one
  // is visible by cross-animating opacity, so there's never a blank seam frame.
  const [layerUrls, setLayerUrls] = useState([null, null]);
  const [visibleLayer, setVisibleLayer] = useState(0);
  const visRef = useRef(0);
  const prevUrlRef = useRef(null);
  // Set to force the next image change to cross-fade even when autoplay is off
  // (e.g. clicking between projects), while plain scrolling stays instant.
  const animateNextRef = useRef(false);

  // The corner carousel is driven by the curated Portfolio, not the full Archive.
  const carouselProjects = portfolio?.projects ?? [];
  const projectCount = carouselProjects.length;
  const activeProject =
    projectCount > 0 ? carouselProjects[((projectIndex % projectCount) + projectCount) % projectCount] : null;
  const projectImages = activeProject?.images ?? [];
  const mainImage =
    projectImages.length > 0
      ? projectImages[
          ((imageIndex % projectImages.length) + projectImages.length) %
            projectImages.length
        ]
      : null;
  const showProjectTitle = (imgHovered || projectPinned) && activeProject && !pinned;

  // Home view: the current image of the active Portfolio project. Scrolling
  // swaps to the next/previous image within the project; clicking the body
  // switches projects.
  // Portrait images fill the height (minus the bottom UI bar); landscape fills the width.
  const homeImage = mainImage;

  // Size the box to the smallest rectangle that contains every image in the
  // project at its largest "contain" size within the 70vw × 70vh bounds — the
  // widest image sets the width, the tallest sets the height. Images then use
  // object-contain, so none is cropped or stretched and the title stays put.
  const measureHomeBox = () => {
    const el = homeBoxRef.current;
    if (!el) return;
    const ratios = projectImages
      .map((img) => img?.aspectRatio)
      .filter((r) => typeof r === "number" && r > 0);
    if (ratios.length === 0) return;
    const maxW = window.innerWidth * 0.7;
    const maxH = window.innerHeight * 0.7;
    let boxW = 0;
    let boxH = 0;
    for (const ar of ratios) {
      boxW = Math.max(boxW, Math.min(maxW, maxH * ar));
      boxH = Math.max(boxH, Math.min(maxH, maxW / ar));
    }
    el.style.width = `${Math.round(boxW)}px`;
    el.style.height = `${Math.round(boxH)}px`;
  };
  useEffect(() => {
    measureHomeBox();
    window.addEventListener("resize", measureHomeBox);
    return () => window.removeEventListener("resize", measureHomeBox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIndex, projectImages.length, pinned]);

  // Images shown in the Archive grid — all of them, or filtered by selected tag.
  const archiveImages = (
    selectedTag
      ? (projects ?? []).filter((p) =>
          p.tags?.some((t) => t._id === selectedTag)
        )
      : projects ?? []
  ).flatMap((p) =>
    (p.images ?? [])
      .filter((img) => img?.url)
      .map((img) => ({ ...img, projectId: p._id, title: p.title }))
  );

  // Information is an overlay (dims the background but keeps it visible);
  // Archive is a background swap that replaces the home carousel. Hovering
  // either one previews it over a dimmed background; clicking commits it.
  const infoActive = infoPinned || hovered === "Information";
  const archiveActive = pinned === "Archive" || hovered === "Archive";
  const active = infoActive ? "Information" : archiveActive ? "Archive" : null;
  const isHighlighted = (label) =>
    hovered === label || (label === "Archive" ? pinned === "Archive" : infoPinned);

  // Preload every Archive and carousel image once on mount so the grid (shown
  // on hover) and the home slideshow are instant — a decoded image sizes
  // immediately, avoiding a reflow when it swaps in. Uses off-DOM Image objects.
  // Keep a module-level cache so images are never GC'd or cancelled between renders.
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

  useEffect(() => {
    if (!pinned && !infoPinned && !projectPinned) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setPinned(null);
        setInfoPinned(false);
        setProjectPinned(false);
        setImgHovered(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, infoPinned, projectPinned]);

  // When expanded view opens, scroll the clicked image into the center of the viewport.
  useEffect(() => {
    if (!expandedKey) return;
    const el = expandedItemRefs.current[expandedKey];
    if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
  }, [expandedKey]);

  // Scrolling anywhere on the page swaps through the active project's images,
  // looping — except when a text overlay is up (hovered/pinned), in which case
  // scrolling drives that content instead.
  useEffect(() => {
    if (active || projectPinned || projectImages.length === 0) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (wheelCooldown.current) return;
      wheelCooldown.current = true;
      setTimeout(() => (wheelCooldown.current = false), 120);
      const dir = e.deltaY > 0 ? 1 : -1;
      setImageIndex((i) => i + dir);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [active, projectPinned, projectImages.length]);

  // Pinned: scrolling steps through the current project's images first, then
  // advances to the next/previous project at the ends.
  useEffect(() => {
    if (!projectPinned || projectCount === 0) return;
    const len = projectImages.length;
    const cur = len > 0 ? ((imageIndex % len) + len) % len : 0;
    const onWheel = (e) => {
      e.preventDefault();
      if (wheelCooldown.current) return;
      wheelCooldown.current = true;
      setTimeout(() => (wheelCooldown.current = false), 120);
      if (e.deltaY > 0) {
        if (cur < len - 1) {
          setImageIndex((i) => i + 1);
        } else {
          setProjectIndex((i) => i + 1);
          setImageIndex(0);
        }
      } else {
        if (cur > 0) {
          setImageIndex((i) => i - 1);
        } else {
          setProjectIndex((i) => i - 1);
          setImageIndex(0);
        }
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [projectPinned, projectCount, projectImages.length, imageIndex]);

  // Reset to the project's first image whenever the project changes or the
  // carousel is unpinned.
  useEffect(() => {
    setImageIndex(0);
  }, [projectIndex, projectPinned]);

  // Advance the slideshow: next image within the project, then next project at
  // the end. Each frame holds for 1.5s after its 1s fade-in completes.
  useEffect(() => {
    if (!autoplay || projectImages.length === 0) return;
    const len = projectImages.length;
    const cur = ((imageIndex % len) + len) % len;
    const t = setTimeout(() => {
      if (cur < len - 1) {
        setImageIndex((i) => i + 1);
      } else {
        setProjectIndex((i) => i + 1);
        setImageIndex(0);
      }
    }, 4300);
    return () => clearTimeout(t);
  }, [autoplay, imageIndex, projectIndex, projectImages.length]);

  // In autoplay mode: fade the count out, swap the number at the midpoint, fade back in.
  const [countVisible, setCountVisible] = useState(true);
  useEffect(() => {
    clearTimeout(displayedIndexTimer.current);
    if (autoplayRef.current) {
      setCountVisible(false);
      displayedIndexTimer.current = setTimeout(() => {
        setDisplayedImageIndex(imageIndex);
        setCountVisible(true);
      }, 700);
    } else {
      setDisplayedImageIndex(imageIndex);
    }
    return () => clearTimeout(displayedIndexTimer.current);
  }, [imageIndex]);

  // Any user interaction pauses the slideshow; it resumes after 5s of inactivity.
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

  // When the home image changes, keep the outgoing image mounted underneath for
  // the fade duration so the new one can crossfade over it.
  useEffect(() => {
    const url = homeImage?.url ?? null;
    if (url === prevUrlRef.current) return;
    const first = prevUrlRef.current === null;
    prevUrlRef.current = url;
    if (!url) return;
    const animate = !first && (autoplay || animateNextRef.current);
    animateNextRef.current = false;
    if (!animate) {
      // First paint or plain scrolling: swap in place on the visible layer,
      // no animation.
      const cur = visRef.current;
      setLayerUrls((prev) => {
        const next = [...prev];
        next[cur] = url;
        return next;
      });
      return;
    }
    // Auto-slideshow: load the new image into the hidden layer, then flip which
    // layer is visible so they cross-animate (old fades out, new fades in).
    const target = 1 - visRef.current;
    visRef.current = target;
    setLayerUrls((prev) => {
      const next = [...prev];
      next[target] = url;
      return next;
    });
    setVisibleLayer(target);
  }, [homeImage?.url, autoplay]);

  // While hovering (not pinned) the panel has pointer-events-none, so wheel
  // events never reach it. Forward them to the panel so it can scroll without
  // the cursor being directly over the content.
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

  // Only one section can be pinned at a time: pinning one clears the other.
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

  // Clicking the body switches projects: right 75% advances, left 25% goes
  // back. Looping is infinite, but it's a no-op when there's only one project.
  const handleBodyClick = (e) => {
    if (projectCount <= 1) return;
    const goNext = e.clientX > window.innerWidth * 0.25;
    animateNextRef.current = true;
    setProjectIndex((i) => i + (goNext ? 1 : -1));
    setImageIndex(0);
  };

  const toggleTag = (id) => {
    setSelectedTag((prev) => (prev === id ? null : id));
  };

  return (
    <main className="min-h-screen">
      {homeImage?.url && pinned !== "Archive" && (
        <div
          onClick={handleBodyClick}
          className={`fixed top-[30px] left-0 right-0 bottom-0 z-0 flex items-center justify-center transition-opacity duration-150 ${
            active ? "opacity-20 pointer-events-none" : "opacity-100"
          } ${projectCount > 1 ? "cursor-pointer" : ""}`}
        >
          <div ref={homeBoxRef} className="relative">
            {[0, 1].map((i) =>
              layerUrls[i] ? (
                <img
                  key={i}
                  src={layerUrls[i]}
                  alt=""
                  aria-hidden={visibleLayer !== i}
                  decoding="sync"
                  className={`absolute inset-0 w-full h-full object-contain object-center transition-opacity ease-in-out duration-[1400ms] ${
                    visibleLayer === i
                      ? "opacity-100 delay-[1400ms]"
                      : "opacity-0 delay-0"
                  }`}
                />
              ) : null
            )}
          </div>
        </div>
      )}

      {activeProject?.title && pinned !== "Archive" && (
        <div className={`fixed bottom-0 left-0 right-0 h-[30px] px-[15px] flex items-center justify-between text-white z-20 select-none pointer-events-none transition-opacity duration-150 ${active === "Information" ? "opacity-20" : "opacity-100"}`}>
          <span>{activeProject.title}</span>
          {projectImages.length > 0 && (
            <span className={`transition-opacity duration-300 ${countVisible ? "opacity-100" : "opacity-0"}`}>
              ({(((displayedImageIndex % projectImages.length) + projectImages.length) % projectImages.length) + 1}/{projectImages.length})
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
                  onMouseEnter={() => setHoveredTag(tag._id)}
                  onMouseLeave={() => setHoveredTag(null)}
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
                <PortableText
                  value={information.body}
                  components={portableTextComponents}
                />
              )}
              {clients?.header && (
                <div className="mt-[4em]">
                  <PortableText
                    value={clients.header}
                    components={portableTextComponents}
                  />
                </div>
              )}
              {clients?.list && (
                <PortableText
                  value={clients.list}
                  components={portableTextComponents}
                />
              )}
              <div className="mt-[4em]">
                <p className="text-[11px] tracking-normal">website by FINAL RESEARCH</p>
              </div>
          </div>
        </div>
      )}

      {archiveActive && archiveImages.length > 0 && (
        <div className={`fixed top-[45px] left-0 right-0 bottom-0 overflow-y-auto z-0 transition-opacity duration-150 ${infoActive ? "opacity-20 pointer-events-none" : "opacity-100"} ${pinned === "Archive" && !infoActive ? "" : "pointer-events-none"}`}>
          {expandedKey ? (
            <div className="flex flex-col items-center gap-[30px] py-[30px]">
              {archiveImages.map((img) => {
                const key = `${img.projectId}-${img._key}`;
                return (
                  <img
                    key={key}
                    ref={(el) => { expandedItemRefs.current[key] = el; }}
                    src={img.url}
                    alt={img.title || ""}
                    onClick={() => setExpandedKey(null)}
                    className="max-w-[80vw] max-h-[80vh] w-auto h-auto object-contain cursor-pointer"
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-[15px] p-[15px]">
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
        {pinned === "Archive" ? (
          <>
            {tags?.map((tag) => {
              const tagActive =
                selectedTag === tag._id || hoveredTag === tag._id;
              return (
                <div
                  key={tag._id}
                  className="flex items-start gap-[0.053em] cursor-pointer overflow-visible"
                  onMouseEnter={() => setHoveredTag(tag._id)}
                  onMouseLeave={() => setHoveredTag(null)}
                  onClick={() => toggleTag(tag._id)}
                >
                  <span
                    className={`relative inline-block ${
                      tagActive ? "text-[var(--color-secondary)]" : ""
                    }`}
                  >
                    {tagActive && (
                      <span
                        aria-hidden
                        className="absolute left-0 right-0 bottom-[0.16em] h-[0.52em] bg-[var(--color-main)] -z-10"
                      />
                    )}
                    {tag.name}
                  </span>
                  <Circle active={tagActive} />
                </div>
              );
            })}
          </>
        ) : showProjectTitle ? (
          <span className="text-white">
            {activeProject.title || ""}
            <span className="ml-[0.053em] inline-block align-top text-[11px] tracking-normal leading-none text-[var(--color-highlight)]">
              ({projectImages.length > 0
                ? (((imageIndex % projectImages.length) + projectImages.length) %
                    projectImages.length) + 1
                : 0}
              /{projectImages.length})
            </span>
          </span>
        ) : (
          <>
        {items.map((item) => (
          <div
            key={item.big}
            className="flex items-start gap-[0.053em] cursor-pointer overflow-visible"
            onMouseEnter={() => setHovered(item.big)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleClick(item.big)}
          >
            <span
              className={`relative inline-block ${
                isHighlighted(item.big) ? "text-[var(--color-secondary)]" : ""
              }`}
            >
              {isHighlighted(item.big) && (
                <span
                  aria-hidden
                  className="absolute left-0 right-0 bottom-[0.16em] h-[0.52em] bg-[var(--color-main)] -z-10"
                />
              )}
              {item.big}
            </span>
            <Circle active={isHighlighted(item.big)} />
          </div>
        ))}
        <div className="whitespace-nowrap font-['Arial',sans-serif] text-[var(--color-secondary)]">
          Eric Tsui
        </div>
          </>
        )}
      </div>
      */}

      <header
        className="fixed top-0 left-0 right-0 h-[30px] px-[15px] flex items-center justify-between text-white z-20"
        onMouseLeave={() => setHoverLocked(false)}
      >
        <div>Eric Tsui</div>
        <div className="flex items-center gap-[15px]">
          {!(pinned || infoPinned || projectPinned) && items.map((item) => (
            <span
              key={item.small}
              className={`cursor-pointer select-none transition-colors duration-150 ease-in-out ${
                isHighlighted(item.big) ? "text-[var(--color-highlight)]" : ""
              }`}
              onMouseEnter={() => { if (!hoverLocked) setHovered(item.big); }}
              onMouseLeave={() => setHovered(null)}
              onClick={() => handleClick(item.big)}
            >
              {item.small}
            </span>
          ))}
          {(pinned || infoPinned || projectPinned) && (
            <button
              type="button"
              onClick={() => {
                setPinned(null);
                setInfoPinned(false);
                setProjectPinned(false);
                setImgHovered(false);
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
