import { useEffect, useState, type RefObject } from "react";

const SIMPLE_MOBILE_HEADER_FALLBACK_HEIGHT = 52;
const MOBILE_MESSAGES_GAP_WITH_PANEL = 8;
const MOBILE_MESSAGES_GAP_SIMPLE = 2;
const MOBILE_VIEWPORT_WARMUP_FRAMES = 20;

type MobileGeometry = {
  hasPanelHeader: boolean;
  panelHeaderBottom: number;
  contentTopOffset: number;
  conversationHeaderBottom: number;
  conversationHeaderHeight: number;
  composerHeight: number;
};

function measureMobileAnchors(
  doc: Document,
  hasPanelHeader: boolean,
  conversationHeaderEl: HTMLElement | null,
  composerEl: HTMLElement | null
): MobileGeometry {
  const headerRow = doc.getElementById("panel-mobile-extra-row");
  const mobileHeader = headerRow?.closest("header") as HTMLElement | null;
  const mobileMainNav = doc.getElementById("mobile-main-nav") as HTMLElement | null;
  const messagesPage = doc.querySelector(".messages-page") as HTMLElement | null;
  const mobileHeaderRect = mobileHeader?.getBoundingClientRect();
  const headerRowRect = headerRow?.getBoundingClientRect();
  const mobileMainNavRect = mobileMainNav?.getBoundingClientRect();
  const messagesPageRect = messagesPage?.getBoundingClientRect();
  const conversationHeaderRect = conversationHeaderEl?.getBoundingClientRect();
  const composerRect = composerEl?.getBoundingClientRect();

  return {
    hasPanelHeader,
    panelHeaderBottom: mobileHeaderRect?.bottom ?? headerRowRect?.bottom ?? 0,
    contentTopOffset: mobileMainNavRect?.bottom ?? messagesPageRect?.top ?? 0,
    conversationHeaderBottom: conversationHeaderRect?.bottom ?? 0,
    conversationHeaderHeight: conversationHeaderRect?.height ?? SIMPLE_MOBILE_HEADER_FALLBACK_HEIGHT,
    composerHeight: composerRect?.height ?? 0,
  };
}

function computeMobileGeometry(input: MobileGeometry) {
  const conversationTop = input.hasPanelHeader
    ? input.panelHeaderBottom
    : Math.max(0, input.contentTopOffset);

  const headerBottom = conversationTop + input.conversationHeaderHeight;

  const messagesTop = Math.max(
    0,
    Math.round(
      headerBottom + (input.hasPanelHeader ? MOBILE_MESSAGES_GAP_WITH_PANEL : MOBILE_MESSAGES_GAP_SIMPLE)
    )
  );

  return {
    conversationTop: Math.max(0, Math.round(conversationTop)),
    messagesTop,
    messagesBottom: Math.max(0, Math.round(input.composerHeight)),
  };
}

function scheduleWarmupFrames(frameCount: number, onFrame: () => void) {
  let rafId = 0;
  let warmupFrames = 0;
  const run = () => {
    onFrame();
    warmupFrames += 1;
    if (warmupFrames < frameCount) {
      rafId = window.requestAnimationFrame(run);
    }
  };
  rafId = window.requestAnimationFrame(run);
  return () => window.cancelAnimationFrame(rafId);
}

export function useMobileConversationViewport(
  conversationId: string,
  hasPanelHeader: boolean,
  composerRef: RefObject<HTMLDivElement | null>,
  mobileConversationHeaderRef: RefObject<HTMLDivElement | null>
) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileConversationTop, setMobileConversationTop] = useState(0);
  const [mobileMessagesTop, setMobileMessagesTop] = useState(0);
  const [mobileMessagesBottom, setMobileMessagesBottom] = useState(0);

  const resetMobileBounds = () => {
    setMobileMessagesTop(0);
    setMobileMessagesBottom(0);
    setMobileConversationTop(0);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateViewport);
      return () => mediaQuery.removeEventListener("change", updateViewport);
    }
    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport || typeof window === "undefined" || typeof document === "undefined") {
      resetMobileBounds();
      return;
    }

    const updateViewportBounds = () => {
      const anchors = measureMobileAnchors(
        document,
        hasPanelHeader,
        mobileConversationHeaderRef.current,
        composerRef.current
      );
      const geometry = computeMobileGeometry(anchors);

      setMobileConversationTop(geometry.conversationTop);
      setMobileMessagesTop(geometry.messagesTop);
      setMobileMessagesBottom(geometry.messagesBottom);
    };

    updateViewportBounds();
    const cancelWarmup = scheduleWarmupFrames(MOBILE_VIEWPORT_WARMUP_FRAMES, updateViewportBounds);
    window.addEventListener("resize", updateViewportBounds);
    window.addEventListener("orientationchange", updateViewportBounds);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateViewportBounds) : null;
    const headerRow = document.getElementById("panel-mobile-extra-row");
    const mobileHeader = headerRow?.closest("header");
    const mobileMainNav = document.getElementById("mobile-main-nav");
    if (hasPanelHeader && resizeObserver && headerRow) resizeObserver.observe(headerRow);
    if (hasPanelHeader && resizeObserver && mobileHeader) resizeObserver.observe(mobileHeader);
    if (resizeObserver && mobileMainNav) resizeObserver.observe(mobileMainNav);
    if (resizeObserver && composerRef.current) resizeObserver.observe(composerRef.current);

    return () => {
      cancelWarmup();
      window.removeEventListener("resize", updateViewportBounds);
      window.removeEventListener("orientationchange", updateViewportBounds);
      resizeObserver?.disconnect();
    };
  }, [conversationId, hasPanelHeader, isMobileViewport, composerRef, mobileConversationHeaderRef]);

  return {
    isMobileViewport,
    mobileConversationTop,
    mobileMessagesTop,
    mobileMessagesBottom,
  };
}

export function forceScrollContainerToBottom(container: HTMLDivElement) {
  container.scrollTop = container.scrollHeight;
}

export function scheduleBottomAlignment(onFrame: () => void) {
  // Run a few frames to stabilize scroll position after fixed-layout recalculation.
  onFrame();
  const raf1 = window.requestAnimationFrame(onFrame);
  const raf2 = window.requestAnimationFrame(() => {
    window.requestAnimationFrame(onFrame);
  });
  return () => {
    window.cancelAnimationFrame(raf1);
    window.cancelAnimationFrame(raf2);
  };
}
