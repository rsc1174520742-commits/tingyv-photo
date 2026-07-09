const galleryConfig = [
  {
    key: "event",
    container: "#eventGallery",
    category: "\u573a\u7167\u8bb0\u5f55",
    shape: "event",
  },
  {
    key: "studio",
    container: "#studioGallery",
    category: "\u68da\u62cd\u4eba\u50cf",
    shape: "studio",
  },
  {
    key: "post",
    container: "#retouchGallery",
    category: "\u540e\u671f\u4f5c\u54c1",
    shape: "featured",
  },
];

const ASSET_VERSION = "protected-layout-20260708";
const galleryData = window.galleryData || { event: [], studio: [], post: [] };
const allItems = [];
let currentIndex = 0;
let touchStartX = 0;
let touchStartY = 0;
const preloadedImages = new Set();

const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxCaption = document.querySelector("#lightboxCaption");
const lightboxCounter = document.querySelector("#lightboxCounter");
const lightboxLoader = document.querySelector("#lightboxLoader");
const lightboxBackdrop = document.querySelector("#lightboxBackdrop");
const lightboxFilmstrip = document.querySelector("#lightboxFilmstrip");
const closeButton = document.querySelector(".lightbox-close");
const prevButton = document.querySelector(".lightbox-nav.prev");
const nextButton = document.querySelector(".lightbox-nav.next");
const heroBg = document.querySelector(".hero-bg");
const archiveCount = document.querySelector("#archiveCount");
const siteHeader = document.querySelector(".site-header");
const navLinks = [...document.querySelectorAll(".nav-links a")];
const soundToggle = document.querySelector("#soundToggle");
const ambientTracks = [
  {
    title: "Episode 33",
    src: "./assets/audio/episode-33.mp3",
  },
  {
    title: "I Really Want to Stay at Your House",
    src: "./assets/audio/stay-at-your-house.mp3",
  },
];
let ambientAudio = null;
let ambientTrackIndex = 0;
let shouldKeepAmbientPlaying = true;
let pendingAutoplayRecovery = false;
let lastFocusedTile = null;

function throttle(func, wait) {
  let timeout = null;
  let previous = 0;
  return function(...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

function versionedAsset(url) {
  const separator = url.includes("?") ? "&" : "?";
  const version = document.querySelector('meta[name="asset-version"]')?.content || ASSET_VERSION;
  return `${url}${separator}v=${version}`;
}

function buildGalleryItems(config) {
  return (galleryData[config.key] || []).map((item, index) => ({
    ...item,
    category: config.category,
    galleryKey: config.key,
    order: index + 1,
  }));
}

function renderGallery(config) {
  const container = document.querySelector(config.container);
  if (!container) return;

  const items = buildGalleryItems(config);
  const fragment = document.createDocumentFragment();
  const offset = allItems.length;
  allItems.push(...items);

  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `photo-tile ${item.tile || getTileClass(index, config.shape)}`;
    button.dataset.index = String(offset + index);
    button.style.transitionDelay = `${Math.min(index * 42, 360)}ms`;
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `\u67e5\u770b${item.category}${index + 1}`);

    const img = document.createElement("img");
    img.src = versionedAsset(item.thumb);
    img.alt = `${item.category} - ${item.title}`;
    img.loading = offset < 6 ? "eager" : "lazy";
    img.decoding = "async";

    const label = document.createElement("span");
    label.textContent = `${item.category} / ${String(index + 1).padStart(2, "0")}`;

    button.append(img, label);
    button.addEventListener("click", () => openLightbox(offset + index));
    button.addEventListener("mousemove", throttledTileTilt);
    button.addEventListener("mouseleave", resetTileTilt);
    fragment.append(button);
  });

  container.append(fragment);
}

function renderFilmstrip() {
  if (!lightboxFilmstrip) return;

  const fragment = document.createDocumentFragment();
  allItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filmstrip-thumb";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `跳转到${item.category}${index + 1}`);

    const img = document.createElement("img");
    img.src = versionedAsset(item.thumb);
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";

    button.append(img);
    button.addEventListener("click", () => {
      currentIndex = index;
      updateLightbox();
    });
    fragment.append(button);
  });

  lightboxFilmstrip.replaceChildren(fragment);
}

function getTileClass(index, shapeName) {
  if (shapeName === "studio") {
    const shape = index % 6;
    if (shape === 0 || shape === 5) return "photo-tile is-studio-wide";
    if (shape === 2) return "photo-tile is-studio-tall";
    return "photo-tile is-studio-mid";
  }

  const shape = index % 7;
  if (shape === 0 || shape === 5) return "photo-tile is-wide";
  if (shape === 3) return "photo-tile is-tall";
  return "photo-tile is-mid";
}

function handleTileTilt(event) {
  const tile = event.currentTarget;
  const rect = tile.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  tile.style.transform = `perspective(900px) rotateX(${y * -4}deg) rotateY(${x * 5}deg) translateY(-3px)`;
}

const throttledTileTilt = throttle(handleTileTilt, 16);

function resetTileTilt(event) {
  event.currentTarget.style.transform = "";
}

function preloadImage(url) {
  if (preloadedImages.has(url)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      preloadedImages.add(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
}

function preloadAdjacentImages(index) {
  const toPreload = [];
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const adjacentIndex = (index + i + allItems.length) % allItems.length;
    const item = allItems[adjacentIndex];
    if (item) {
      toPreload.push(preloadImage(versionedAsset(item.display)));
    }
  }
  Promise.all(toPreload).catch(() => {});
}

function openLightbox(index) {
  lastFocusedTile = document.activeElement;
  currentIndex = index;
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  updateLightbox();
  closeButton.focus();
  preloadAdjacentImages(index);
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
  lightboxImage.src = "";
  if (lightboxBackdrop) lightboxBackdrop.src = "";
  if (lastFocusedTile && typeof lastFocusedTile.focus === "function") {
    lastFocusedTile.focus();
  }
}

function updateLightbox() {
  const item = allItems[currentIndex];
  if (!item) return;

  lightboxLoader.hidden = false;
  lightbox.classList.add("is-changing");
  lightboxImage.style.opacity = "0";
  if (lightboxBackdrop) {
    lightboxBackdrop.src = versionedAsset(item.thumb);
  }
  updateFilmstripState();

  const img = new Image();
  img.onload = () => {
    const displayUrl = versionedAsset(item.display);
    lightboxImage.src = displayUrl;
    if (lightboxBackdrop) lightboxBackdrop.src = displayUrl;
    lightboxImage.alt = `${item.category} - ${item.title}`;
    lightboxCaption.textContent = `${item.category} / ${item.title}`;
    lightboxCounter.textContent = `${currentIndex + 1} / ${allItems.length}`;
    lightboxLoader.hidden = true;
    window.requestAnimationFrame(() => {
      lightbox.classList.remove("is-changing");
      lightboxImage.style.opacity = "1";
    });
    preloadAdjacentImages(currentIndex);
  };
  img.onerror = () => {
    lightboxLoader.hidden = true;
    lightbox.classList.remove("is-changing");
    lightboxImage.style.opacity = "1";
    lightboxCaption.textContent = `${item.category} / ${item.title} (加载失败)`;
  };
  img.src = versionedAsset(item.display);
}

function updateFilmstripState() {
  if (!lightboxFilmstrip) return;

  lightboxFilmstrip.querySelectorAll(".filmstrip-thumb").forEach((button) => {
    const isActive = Number(button.dataset.index) === currentIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "true" : "false");
    if (isActive) {
      button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  });
}

function showPrev() {
  currentIndex = (currentIndex - 1 + allItems.length) % allItems.length;
  updateLightbox();
}

function showNext() {
  currentIndex = (currentIndex + 1) % allItems.length;
  updateLightbox();
}

function handleTouchStart(event) {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}

function handleTouchEnd(event) {
  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;

  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
    if (deltaX > 0) {
      showPrev();
    } else {
      showNext();
    }
  }
}

function setupReveal() {
  const revealItems = document.querySelectorAll("[data-reveal], .photo-tile");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));
}

function setupParallax() {
  let rafId = 0;
  const heroContent = document.querySelector(".hero-content");
  const heroPanel = document.querySelector(".hero-panel");

  window.addEventListener(
    "scroll",
    () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const offset = Math.min(window.scrollY, window.innerHeight);
        const progress = offset / Math.max(window.innerHeight, 1);
        if (heroBg) {
          heroBg.style.transform = `scale(${1.05 + progress * 0.055}) translateY(${offset * 0.06}px)`;
        }
        if (heroContent) {
          heroContent.style.transform = `translateY(${offset * -0.035}px)`;
        }
        if (heroPanel) {
          heroPanel.style.transform = `translateY(${offset * -0.02}px)`;
        }
        if (siteHeader) {
          siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
        }
        rafId = 0;
      });
    },
    { passive: true },
  );
}

function setupActiveNavigation() {
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let rafId = 0;

  const updateActiveLink = () => {
    const marker = window.innerHeight * 0.42;
    let current = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= marker) {
        current = section;
      }
    });

    navLinks.forEach((link) => {
      const isActive = current && link.getAttribute("href") === `#${current.id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  window.addEventListener(
    "scroll",
    () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        updateActiveLink();
        rafId = 0;
      });
    },
    { passive: true },
  );

  window.addEventListener("resize", updateActiveLink);
  updateActiveLink();
}

function setupGalleryFocus() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-near", entry.isIntersecting);
      });
    },
    { rootMargin: "-18% 0px -18% 0px", threshold: 0.38 },
  );

  document.querySelectorAll(".photo-tile").forEach((tile) => observer.observe(tile));
}

function setupAtmosphereCanvas() {
  const canvas = document.querySelector("#atmosphereCanvas");
  const context = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  let width = 0;
  let height = 0;
  let pointerX = 0;
  let pointerY = 0;
  const particles = [];
  let particleCount = 56;
  let animationId = null;
  let isVisible = true;

  const performanceLevel = (() => {
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = navigator.deviceMemory || 4;
    if (hardwareConcurrency <= 2 || deviceMemory < 4) return 'low';
    if (hardwareConcurrency <= 4 || deviceMemory < 8) return 'medium';
    return 'high';
  })();

  if (performanceLevel === 'low') particleCount = 28;
  else if (performanceLevel === 'medium') particleCount = 42;

  function resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function seedParticles() {
    particles.length = 0;
    for (let i = 0; i < particleCount; i += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: Math.random() * -0.22 - 0.04,
        size: Math.random() * 2.4 + 0.6,
        alpha: Math.random() * 0.38 + 0.08,
      });
    }
  }

  function draw() {
    if (!isVisible) return;

    context.clearRect(0, 0, width, height);
    particles.forEach((particle) => {
      const dx = (pointerX - width / 2) * 0.0008;
      const dy = (pointerY - height / 2) * 0.0008;
      particle.x += particle.vx + dx;
      particle.y += particle.vy + dy;

      if (particle.y < -20) particle.y = height + 20;
      if (particle.x < -20) particle.x = width + 20;
      if (particle.x > width + 20) particle.x = -20;

      context.beginPath();
      context.fillStyle = `rgba(224, 90, 43, ${particle.alpha})`;
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    });

    animationId = requestAnimationFrame(draw);
  }

  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible && !animationId) {
        draw();
      } else if (!isVisible && animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },
    { threshold: 0 }
  );

  visibilityObserver.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (isVisible && !animationId) {
      draw();
    } else if (!isVisible && animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });

  window.addEventListener("resize", () => {
    resize();
    seedParticles();
  });

  window.addEventListener(
    "pointermove",
    throttle((event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }, 32),
    { passive: true },
  );

  resize();
  seedParticles();
  draw();
}

function setupCopyButtons() {
  document.querySelectorAll(".copy-contact").forEach((button) => {
    const originalText = button.textContent;
    button.addEventListener("click", async () => {
      const value = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = "\u5df2\u590d\u5236";
      } catch {
        button.textContent = value;
      }

      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1600);
    });
  });
}

function setupAssetGuards() {
  const protectedMedia = document.querySelectorAll(
    ".photo-tile img, .filmstrip-thumb img, #lightboxImage, #lightboxBackdrop",
  );

  protectedMedia.forEach((media) => {
    media.setAttribute("draggable", "false");
    media.addEventListener("dragstart", (event) => event.preventDefault());
    media.addEventListener("contextmenu", (event) => event.preventDefault());
  });

  document.querySelectorAll(".gallery, .lightbox").forEach((container) => {
    container.addEventListener("contextmenu", (event) => {
      if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    });
  });
}

function setupAmbientAudio() {
  if (!soundToggle) return;

  ambientAudio = new Audio(versionedAsset(ambientTracks[ambientTrackIndex].src));
  ambientAudio.loop = false;
  ambientAudio.preload = "metadata";
  ambientAudio.volume = 0.14;

  const setAudioState = (isOn, label = isOn ? "关闭背景音乐" : "开启背景音乐") => {
    soundToggle.dataset.state = isOn ? "on" : "off";
    soundToggle.setAttribute("aria-pressed", String(isOn));
    soundToggle.setAttribute("aria-label", label);
    soundToggle.querySelector(".sound-label").textContent = isOn ? "Playing" : "Music";
  };

  const updateAudioSource = () => {
    ambientAudio.src = versionedAsset(ambientTracks[ambientTrackIndex].src);
    ambientAudio.load();
  };

  const clearAutoplayRecovery = () => {
    if (!pendingAutoplayRecovery) return;
    pendingAutoplayRecovery = false;
    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      document.removeEventListener(eventName, resumeOnFirstInteraction, true);
    });
  };

  async function startAmbientPlayback() {
    try {
      await ambientAudio.play();
      setAudioState(true);
      clearAutoplayRecovery();
      return true;
    } catch {
      setAudioState(false, "浏览器阻止了自动播放，点击后继续");
      return false;
    }
  }

  async function resumeOnFirstInteraction(event) {
    if (!shouldKeepAmbientPlaying) return;
    if (event?.target?.closest?.("#soundToggle")) return;
    const started = await startAmbientPlayback();
    if (started) {
      clearAutoplayRecovery();
    }
  }

  const scheduleAutoplayRecovery = () => {
    if (pendingAutoplayRecovery || !shouldKeepAmbientPlaying) return;
    pendingAutoplayRecovery = true;
    ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      document.addEventListener(eventName, resumeOnFirstInteraction, {
        capture: true,
        once: true,
      });
    });
  };

  const playTrackAtIndex = async (nextIndex) => {
    ambientTrackIndex = (nextIndex + ambientTracks.length) % ambientTracks.length;
    updateAudioSource();
    return startAmbientPlayback();
  };

  ambientAudio.addEventListener("ended", async () => {
    if (!shouldKeepAmbientPlaying) return;
    await playTrackAtIndex(ambientTrackIndex + 1);
  });

  soundToggle.addEventListener("click", async () => {
    const shouldPlay = soundToggle.dataset.state !== "on";
    try {
      if (shouldPlay) {
        shouldKeepAmbientPlaying = true;
        await startAmbientPlayback();
        localStorage.setItem("tingyuAmbientAudio", "on");
      } else {
        shouldKeepAmbientPlaying = false;
        ambientAudio.pause();
        clearAutoplayRecovery();
        setAudioState(false);
        localStorage.setItem("tingyuAmbientAudio", "off");
      }
    } catch {
      setAudioState(false, "浏览器阻止了音乐播放，请再次点击");
    }
  });

  setAudioState(false);
  startAmbientPlayback().then((started) => {
    if (!started) {
      scheduleAutoplayRecovery();
    }
  });
}

function init() {
  try {
    galleryConfig.forEach(renderGallery);
    if (archiveCount) archiveCount.textContent = String(allItems.length);
    renderFilmstrip();

    closeButton.addEventListener("click", closeLightbox);
    prevButton.addEventListener("click", showPrev);
    nextButton.addEventListener("click", showNext);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    lightbox.addEventListener("touchstart", handleTouchStart, { passive: true });
    lightbox.addEventListener("touchend", handleTouchEnd, { passive: true });

    window.addEventListener("keydown", (event) => {
      if (lightbox.hidden) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    });

    setupReveal();
    setupParallax();
    setupActiveNavigation();
    setupGalleryFocus();
    setupAtmosphereCanvas();
    setupCopyButtons();
    setupAssetGuards();
    setupAmbientAudio();
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

init();
