export function initFinalResearch() {
  const finalResearchLink = document.getElementById("final-research");
  const finalResearchHover = document.querySelector(".final-research-hover");
  const finalResearchDefault = document.querySelector(".final-research-default");

  if (!finalResearchLink || !finalResearchHover) return () => {};

  // The default text ("website by FINAL RESEARCH") swaps to this on hover
  // (desktop) / tap (mobile). Separate constants so the two platforms can carry
  // distinct copy if needed.
  const DESKTOP_HOVER_LABEL = "FINALRESEARCH.ORG";
  const MOBILE_HOVER_LABEL = "FINALRESEARCH.ORG";

  let svg = null;
  let isHovering = false;

  function resetToDefaultState() {
    const orphanedSvg = document.querySelector(".final-research-corner-lines");
    if (orphanedSvg) orphanedSvg.remove();
    removeCornerLines();
    hideHoverState();
    isHovering = false;
  }

  function isMobile() {
    // Judged by the input device rather than the window width: a desktop browser
    // narrowed to 574px still has a pointer that can hover, and was previously
    // being treated as a phone and losing the effect entirely.
    return window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }

  function createCornerLines() {
    if (svg) svg.remove();

    requestAnimationFrame(() => {
      const rect = finalResearchHover.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Use the brand accent (highlight) color so the lines are visible on the
      // white page background; fall back to white if the var is unset.
      const lineColor =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent")
          .trim() || "#ffffff";

      const screenCorners = [
        { x: 0, y: 0 },
        { x: viewportWidth, y: 0 },
        { x: 0, y: viewportHeight },
        { x: viewportWidth, y: viewportHeight },
      ];

      const blockCorners = [
        { x: rect.left, y: rect.top },
        { x: rect.right, y: rect.top },
        { x: rect.left, y: rect.bottom },
        { x: rect.right, y: rect.bottom },
      ];

      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "final-research-corner-lines");
      svg.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483647;
        overflow: visible;
      `;
      svg.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");

      screenCorners.forEach((screenCorner, i) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", screenCorner.x);
        line.setAttribute("y1", screenCorner.y);
        line.setAttribute("x2", blockCorners[i].x);
        line.setAttribute("y2", blockCorners[i].y);
        line.setAttribute("stroke", lineColor);
        line.setAttribute("stroke-width", "1");
        svg.appendChild(line);
      });

      // 1px viewport border in the highlight color, on all four edges.
      const rect_top = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect_top.setAttribute("x", "0");
      rect_top.setAttribute("y", "0");
      rect_top.setAttribute("width", viewportWidth);
      rect_top.setAttribute("height", "1");
      rect_top.setAttribute("fill", lineColor);
      svg.appendChild(rect_top);

      const rect_bottom = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect_bottom.setAttribute("x", "0");
      rect_bottom.setAttribute("y", viewportHeight - 1);
      rect_bottom.setAttribute("width", viewportWidth);
      rect_bottom.setAttribute("height", "1");
      rect_bottom.setAttribute("fill", lineColor);
      svg.appendChild(rect_bottom);

      const rect_left = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect_left.setAttribute("x", "0");
      rect_left.setAttribute("y", "0");
      rect_left.setAttribute("width", "1");
      rect_left.setAttribute("height", viewportHeight);
      rect_left.setAttribute("fill", lineColor);
      svg.appendChild(rect_left);

      const rect_right = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect_right.setAttribute("x", viewportWidth - 1);
      rect_right.setAttribute("y", "0");
      rect_right.setAttribute("width", "1");
      rect_right.setAttribute("height", viewportHeight);
      rect_right.setAttribute("fill", lineColor);
      svg.appendChild(rect_right);

      document.body.appendChild(svg);
    });
  }

  function removeCornerLines() {
    if (svg) {
      svg.remove();
      svg = null;
    }
  }

  function showHoverState() {
    if (finalResearchDefault) {
      finalResearchDefault.style.transition = "none";
      finalResearchDefault.style.opacity = "0";
      finalResearchDefault.style.visibility = "hidden";
    }
    if (finalResearchHover) {
      finalResearchHover.textContent = isMobile()
        ? MOBILE_HOVER_LABEL
        : DESKTOP_HOVER_LABEL;
      finalResearchHover.style.transition = "none";
      finalResearchHover.style.opacity = "1";
      finalResearchHover.style.visibility = "visible";
    }
  }

  function hideHoverState() {
    if (finalResearchDefault) {
      finalResearchDefault.style.transition = "";
      finalResearchDefault.style.opacity = "";
      finalResearchDefault.style.visibility = "";
    }
    if (finalResearchHover) {
      finalResearchHover.style.transition = "";
      finalResearchHover.style.opacity = "0";
      finalResearchHover.style.visibility = "";
    }
  }

  function handleClick(e) {
    if (isMobile()) {
      e.preventDefault();
      showHoverState();
      createCornerLines();
      setTimeout(() => {
        window.location.href = finalResearchLink.href;
      }, 1000);
    }
  }

  function handleMouseEnter() {
    if (!isMobile()) {
      isHovering = true;
      showHoverState();
      createCornerLines();
    }
  }

  function handleMouseLeave() {
    if (!isMobile()) {
      isHovering = false;
      hideHoverState();
      removeCornerLines();
    }
  }

  function handlePageShow(event) {
    if (event.persisted) resetToDefaultState();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible" && !isHovering) resetToDefaultState();
  }

  function handleFocus() {
    if (!isHovering) resetToDefaultState();
  }

  function handleResize() {
    if (isHovering && svg) createCornerLines();
  }

  function handleScroll() {
    if (isHovering && svg) createCornerLines();
  }

  finalResearchLink.addEventListener("click", handleClick);
  finalResearchLink.addEventListener("mouseenter", handleMouseEnter);
  finalResearchLink.addEventListener("mouseleave", handleMouseLeave);
  window.addEventListener("pageshow", handlePageShow);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", resetToDefaultState);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("resize", handleResize);
  window.addEventListener("scroll", handleScroll, { passive: true });

  return function cleanup() {
    finalResearchLink.removeEventListener("click", handleClick);
    finalResearchLink.removeEventListener("mouseenter", handleMouseEnter);
    finalResearchLink.removeEventListener("mouseleave", handleMouseLeave);
    window.removeEventListener("pageshow", handlePageShow);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", resetToDefaultState);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("scroll", handleScroll);
    resetToDefaultState();
  };
}
