(() => {
  const THEME_KEY = "av-theme-preference";
  const FLOATING_PLAYER_MINIMIZED_KEY = "able-floating-player-minimized";
  const FLOATING_PLAYER_PAGE_BLOCKLIST = /(?:^|\/)(listen|thanks)(?:\.html)?$/i;
  const FLOATING_PLAYER_TRACKS = [
    {
      title: "Waves",
      src: "assets/audio/waves.mp3",
      cover: "assets/covers/waves-cover.png",
    },
    {
      title: "Bells",
      src: "assets/audio/bells.mp3",
      cover: "assets/covers/bells-cover.png",
    },
  ];
  const root = document.documentElement;
  const themeButton = document.querySelector(".theme-toggle");
  const themeButtonText = document.querySelector(".theme-toggle-text");
  const themeImages = Array.from(document.querySelectorAll(".theme-image"));
  const themedLinks = Array.from(document.querySelectorAll("a[href]"));
  const themedRedirectInputs = Array.from(document.querySelectorAll('input[name="_next"]'));
  const emailForms = Array.from(document.querySelectorAll("[data-email-form]"));
  const imageCache = new Map();
  const themeStorage = availableThemeStorage();
  const urlThemeRequested = new URLSearchParams(window.location.search).has("theme");
  let activeTheme = normalizeTheme(root.dataset.theme || bodyElement()?.dataset.theme);
  let floatingPlayerController = null;

  function bodyElement() {
    return document.body;
  }

  function availableThemeStorage() {
    try {
      const storage = window.localStorage;
      const testKey = `${THEME_KEY}::test`;
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return storage;
    } catch (_error) {
      return null;
    }
  }

  function availableSessionStorage() {
    try {
      const storage = window.sessionStorage;
      const testKey = `${FLOATING_PLAYER_MINIMIZED_KEY}::test`;
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return storage;
    } catch (_error) {
      return null;
    }
  }

  function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : "light";
  }

  function readSavedTheme() {
    if (!themeStorage) {
      return null;
    }

    try {
      const savedTheme = themeStorage.getItem(THEME_KEY);
      return savedTheme === "light" || savedTheme === "dark" ? savedTheme : null;
    } catch (_error) {
      return null;
    }
  }

  function saveTheme(theme) {
    if (!themeStorage) {
      return false;
    }

    try {
      themeStorage.setItem(THEME_KEY, theme);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function requestedTheme() {
    const requested = new URLSearchParams(window.location.search).get("theme");
    if (requested === "light" || requested === "dark") {
      return requested;
    }

    return readSavedTheme() || "light";
  }

  function shouldMirrorThemeInUrl() {
    return !themeStorage || urlThemeRequested;
  }

  function themedUrl(urlLike, theme) {
    if (!urlLike) {
      return null;
    }

    try {
      const url = new URL(urlLike, window.location.href);

      if (url.origin !== window.location.origin) {
        return null;
      }

      url.searchParams.set("theme", theme);
      return url;
    } catch (_error) {
      return null;
    }
  }

  function syncCurrentThemeUrl(theme) {
    if (!shouldMirrorThemeInUrl()) {
      return;
    }

    const url = themedUrl(window.location.href, theme);

    if (!url) {
      return;
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }

  function syncThemeLinks(theme) {
    if (!shouldMirrorThemeInUrl()) {
      return;
    }

    themedLinks.forEach((link) => {
      const url = themedUrl(link.getAttribute("href"), theme);

      if (!url) {
        return;
      }

      link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
    });
  }

  function syncThemeRedirects(theme) {
    if (!shouldMirrorThemeInUrl()) {
      return;
    }

    themedRedirectInputs.forEach((input) => {
      const url = themedUrl(input.value, theme);

      if (!url) {
        return;
      }

      input.value = url.href;
    });
  }

  function syncThemeRouting(theme) {
    syncCurrentThemeUrl(theme);
    syncThemeLinks(theme);
    syncThemeRedirects(theme);
  }

  function imageSourceForTheme(image, theme) {
    return image.dataset[theme === "light" ? "lightSrc" : "darkSrc"] || image.getAttribute("src");
  }

  function preloadImage(src) {
    if (!src) {
      return Promise.resolve();
    }

    if (imageCache.has(src)) {
      return imageCache.get(src);
    }

    const promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = src;
    });

    imageCache.set(src, promise);
    return promise;
  }

  function preloadThemeImages(theme) {
    const sources = [...new Set(themeImages.map((image) => imageSourceForTheme(image, theme)).filter(Boolean))];
    return Promise.all(sources.map(preloadImage));
  }

  function updateThemeButton(theme) {
    if (!themeButton) {
      return;
    }

    const isLight = theme === "light";
    themeButton.setAttribute("aria-pressed", String(isLight));
    themeButton.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");

    if (themeButtonText) {
      themeButtonText.textContent = isLight ? "Dark" : "Light";
    }
  }

  function swapThemeImages(theme) {
    themeImages.forEach((image) => {
      const nextSrc = imageSourceForTheme(image, theme);

      if (nextSrc && image.getAttribute("src") !== nextSrc) {
        image.src = nextSrc;
      }
    });
  }

  function applyTheme(theme) {
    activeTheme = normalizeTheme(theme);
    root.dataset.theme = activeTheme;
    root.style.colorScheme = activeTheme;
    const body = bodyElement();

    if (body) {
      body.dataset.theme = activeTheme;
    }

    syncThemeRouting(activeTheme);
    swapThemeImages(activeTheme);
    updateThemeButton(activeTheme);
    floatingPlayerController?.refreshTheme(activeTheme);
  }

  function setTheme(theme, { persist = false } = {}) {
    const nextTheme = normalizeTheme(theme);
    applyTheme(nextTheme);

    if (persist) {
      saveTheme(nextTheme);
    }

    preloadThemeImages(nextTheme);
  }

  function iconSvg(name) {
    const icons = {
      play:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.8v10.4c0 .7.76 1.14 1.38.79l8.1-5.2a.94.94 0 0 0 0-1.58l-8.1-5.2A.92.92 0 0 0 8 6.8Z" fill="currentColor"/></svg>',
      pause:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h3.2v12H8V6Zm4.8 0H16v12h-3.2V6Z" fill="currentColor"/></svg>',
      previous:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h2v12H7V6Zm10.37.78a.93.93 0 0 1 0 1.58l-6.03 3.86 6.03 3.86a.93.93 0 0 1-1 .29L9.6 13.1a1.3 1.3 0 0 1 0-2.18l6.77-4.27a.93.93 0 0 1 1 .13Z" fill="currentColor"/></svg>',
      next:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6h2v12h-2V6ZM6.63 6.78a.93.93 0 0 1 1-.13l6.77 4.27a1.3 1.3 0 0 1 0 2.18l-6.77 4.27a.93.93 0 0 1-1-.29.93.93 0 0 1 .08-1.29l6.03-3.86-6.03-3.86a.93.93 0 0 1-.08-1.29Z" fill="currentColor"/></svg>',
      volume:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.6l4.2-3.7a.8.8 0 0 1 1.32.6v11.2a.8.8 0 0 1-1.32.6l-4.2-3.7H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm11.26-1.23a.9.9 0 0 1 1.27-.02A5.92 5.92 0 0 1 18.4 12a5.9 5.9 0 0 1-1.87 3.75.9.9 0 1 1-1.24-1.3 4.08 4.08 0 0 0 1.3-2.45 4.07 4.07 0 0 0-1.31-2.43.9.9 0 0 1-.02-1.3Zm2.98-2.8a.9.9 0 0 1 1.27.06A9.87 9.87 0 0 1 22 12a9.87 9.87 0 0 1-2.5 6.47.9.9 0 1 1-1.33-1.22A8.06 8.06 0 0 0 20.2 12a8.07 8.07 0 0 0-2.02-5.25.9.9 0 0 1 .06-1.28Z" fill="currentColor"/></svg>',
      muted:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.6l4.2-3.7a.8.8 0 0 1 1.32.6v11.2a.8.8 0 0 1-1.32.6l-4.2-3.7H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm10.3.9 4.88 4.88a.9.9 0 1 1-1.28 1.27L13.03 11.7a.9.9 0 1 1 1.27-1.28Zm3.6-1.46a.9.9 0 0 1 0 1.28l-4.88 4.87a.9.9 0 1 1-1.27-1.27l4.87-4.88a.9.9 0 0 1 1.28 0Z" fill="currentColor"/></svg>',
      minimize:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11.1a.9.9 0 0 1 .9-.9H20a.9.9 0 1 1 0 1.8H7.9a.9.9 0 0 1-.9-.9Z" fill="currentColor"/></svg>',
    };

    return icons[name] || "";
  }

  function buildFloatingPlayerMarkup(trackTitle, coverSrc) {
    return `
      <div class="floating-player-shell" data-player-shell>
        <div class="floating-player-cover" data-player-cover>
          <div class="floating-player-topbar">
            <button class="floating-player-icon-button" type="button" data-player-volume-toggle aria-label="Volume options" aria-expanded="false">
              <span class="floating-player-icon" data-player-volume-icon>${iconSvg("volume")}</span>
            </button>
            <button class="floating-player-icon-button" type="button" data-player-minimize aria-label="Minimize player">
              <span class="floating-player-icon">${iconSvg("minimize")}</span>
            </button>
          </div>
          <img class="floating-player-cover-image" data-player-cover-image src="${coverSrc}" alt="Cover artwork for ${trackTitle}" />
          <div class="floating-player-cover-fallback" data-player-cover-fallback hidden>
            <span>Able</span>
            <small>Music</small>
          </div>
          <span class="floating-player-state-pill" data-player-state-pill>Paused</span>
        </div>
        <div class="floating-player-volume-panel" data-player-volume-panel hidden>
          <label class="floating-player-volume-label">
            <span>Volume</span>
            <input type="range" min="0" max="100" step="1" value="60" data-player-volume aria-label="Volume" />
          </label>
          <button class="floating-player-inline-button" type="button" data-player-mute aria-pressed="false">Mute</button>
        </div>
        <div class="floating-player-body">
          <p class="floating-player-kicker">Local player</p>
          <p class="floating-player-title" data-player-title>${trackTitle}</p>
          <div class="floating-player-meta-row">
            <a class="floating-player-link" data-player-link href="listen.html">Open listen page</a>
          </div>
          <div class="floating-player-progress" aria-hidden="true">
            <span class="floating-player-progress-fill" data-player-progress></span>
          </div>
          <div class="floating-player-controls">
            <button class="floating-player-control" type="button" data-player-prev aria-label="Previous track">
              <span class="floating-player-icon">${iconSvg("previous")}</span>
            </button>
            <button class="floating-player-control floating-player-primary" type="button" data-player-toggle aria-label="Play ${trackTitle}">
              <span class="floating-player-icon" data-player-toggle-icon>${iconSvg("play")}</span>
              <span class="floating-player-primary-text" data-player-toggle-text>Play</span>
            </button>
            <button class="floating-player-control" type="button" data-player-next aria-label="Next track">
              <span class="floating-player-icon">${iconSvg("next")}</span>
            </button>
          </div>
          <p class="floating-player-status" data-player-status aria-live="polite">Ready to play ${trackTitle}.</p>
        </div>
      </div>
      <button class="floating-player-launcher" type="button" data-player-launcher aria-label="Open music player" hidden>
        <span class="floating-player-launcher-art">
          <img class="floating-player-launcher-image" data-player-launcher-image src="${coverSrc}" alt="" />
          <span class="floating-player-launcher-fallback" data-player-launcher-fallback hidden>A</span>
        </span>
        <span class="floating-player-launcher-copy">
          <span class="floating-player-launcher-label">Open player</span>
          <span class="floating-player-launcher-title" data-player-launcher-title>${trackTitle}</span>
        </span>
      </button>
    `;
  }

  function shouldMountFloatingPlayer() {
    const body = bodyElement();

    if (!body || body.dataset.musicPlayerMounted === "true") {
      return false;
    }

    return !FLOATING_PLAYER_PAGE_BLOCKLIST.test(window.location.pathname);
  }

  function initFloatingPlayer() {
    if (!shouldMountFloatingPlayer() || FLOATING_PLAYER_TRACKS.length === 0) {
      return null;
    }

    const body = bodyElement();
    const minimizedStorage = availableSessionStorage();
    const defaultMinimized = window.matchMedia ? window.matchMedia("(max-width: 560px)").matches : false;
    const savedMinimized = minimizedStorage?.getItem(FLOATING_PLAYER_MINIMIZED_KEY);
    const initialMinimized = defaultMinimized ? true : savedMinimized === "true";
    const audio = new Audio();
    const playerRoot = document.createElement("section");
    const resizeObserver = window.ResizeObserver ? new ResizeObserver(() => updateReservedSpace()) : null;
    let trackIndex = 0;
    let isMuted = false;
    let lastVolume = 60;

    audio.preload = "none";
    audio.volume = 0.6;

    playerRoot.className = "floating-player";
    playerRoot.dataset.floatingPlayerRoot = "true";
    playerRoot.setAttribute("role", "region");
    playerRoot.setAttribute("aria-label", "Music player");
    playerRoot.innerHTML = buildFloatingPlayerMarkup(FLOATING_PLAYER_TRACKS[0].title, FLOATING_PLAYER_TRACKS[0].cover);
    body.append(playerRoot);
    body.dataset.musicPlayerMounted = "true";
    body.classList.add("has-floating-player");

    const refs = {
      shell: playerRoot.querySelector("[data-player-shell]"),
      coverImage: playerRoot.querySelector("[data-player-cover-image]"),
      coverFallback: playerRoot.querySelector("[data-player-cover-fallback]"),
      launcherImage: playerRoot.querySelector("[data-player-launcher-image]"),
      launcherFallback: playerRoot.querySelector("[data-player-launcher-fallback]"),
      title: playerRoot.querySelector("[data-player-title]"),
      launcherTitle: playerRoot.querySelector("[data-player-launcher-title]"),
      link: playerRoot.querySelector("[data-player-link]"),
      progress: playerRoot.querySelector("[data-player-progress]"),
      status: playerRoot.querySelector("[data-player-status]"),
      statePill: playerRoot.querySelector("[data-player-state-pill]"),
      toggle: playerRoot.querySelector("[data-player-toggle]"),
      toggleText: playerRoot.querySelector("[data-player-toggle-text]"),
      toggleIcon: playerRoot.querySelector("[data-player-toggle-icon]"),
      previous: playerRoot.querySelector("[data-player-prev]"),
      next: playerRoot.querySelector("[data-player-next]"),
      volumeToggle: playerRoot.querySelector("[data-player-volume-toggle]"),
      volumeIcon: playerRoot.querySelector("[data-player-volume-icon]"),
      volumePanel: playerRoot.querySelector("[data-player-volume-panel]"),
      volumeSlider: playerRoot.querySelector("[data-player-volume]"),
      mute: playerRoot.querySelector("[data-player-mute]"),
      minimize: playerRoot.querySelector("[data-player-minimize]"),
      launcher: playerRoot.querySelector("[data-player-launcher]"),
    };

    refs.volumePanel.id = "able-player-volume-panel";
    refs.volumeToggle.setAttribute("aria-controls", refs.volumePanel.id);

    function currentTrack() {
      return FLOATING_PLAYER_TRACKS[trackIndex];
    }

    function persistMinimizedState(value) {
      if (!minimizedStorage) {
        return;
      }

      try {
        minimizedStorage.setItem(FLOATING_PLAYER_MINIMIZED_KEY, String(value));
      } catch (_error) {
        // Session storage can be unavailable in locked-down browsers.
      }
    }

    function currentListenPageHref() {
      const url = themedUrl("listen.html", activeTheme);
      return url ? `${url.pathname}${url.search}${url.hash}` : "listen.html";
    }

    function updateListenLink() {
      refs.link.href = currentListenPageHref();
    }

    function setStatus(message, isError = false) {
      refs.status.textContent = message || "";
      refs.status.classList.toggle("is-error", isError);
    }

    function updateProgress() {
      const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      refs.progress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    function updateVolumeUi() {
      refs.volumeSlider.value = String(Math.round(audio.volume * 100));
      refs.volumeIcon.innerHTML = iconSvg(isMuted || audio.volume === 0 ? "muted" : "volume");
      refs.mute.textContent = isMuted || audio.volume === 0 ? "Unmute" : "Mute";
      refs.mute.setAttribute("aria-pressed", String(isMuted || audio.volume === 0));
    }

    function applyTrackUi() {
      const track = currentTrack();
      refs.title.textContent = track.title;
      refs.launcherTitle.textContent = track.title;
      refs.coverImage.hidden = false;
      refs.coverFallback.hidden = true;
      refs.coverImage.src = track.cover;
      refs.coverImage.alt = `Cover artwork for ${track.title}`;
      refs.launcherImage.hidden = false;
      refs.launcherFallback.hidden = true;
      refs.launcherImage.src = track.cover;
      refs.launcherImage.alt = "";
      updateListenLink();
    }

    function updateControls() {
      const track = currentTrack();
      const multipleTracks = FLOATING_PLAYER_TRACKS.length > 1;

      refs.previous.disabled = !multipleTracks;
      refs.next.disabled = !multipleTracks;
      refs.volumeToggle.disabled = false;
      refs.volumeSlider.disabled = false;
      refs.mute.disabled = false;
      refs.toggle.disabled = false;

      if (audio.paused) {
        if (!refs.status.classList.contains("is-error")) {
          setStatus(audio.currentTime > 0 ? `Paused ${track.title}.` : `Ready to play ${track.title}.`);
        }
        refs.toggleIcon.innerHTML = iconSvg("play");
        refs.toggleText.textContent = "Play";
        refs.toggle.setAttribute("aria-label", `Play ${track.title}`);
        refs.statePill.textContent = "Paused";
      } else {
        if (!refs.status.classList.contains("is-error")) {
          setStatus(`Playing ${track.title}.`);
        }
        refs.toggleIcon.innerHTML = iconSvg("pause");
        refs.toggleText.textContent = "Pause";
        refs.toggle.setAttribute("aria-label", `Pause ${track.title}`);
        refs.statePill.textContent = "Playing";
      }
    }

    function closeVolumePanel() {
      refs.volumePanel.hidden = true;
      refs.volumeToggle.setAttribute("aria-expanded", "false");
    }

    function updateReservedSpace() {
      const isMinimized = playerRoot.classList.contains("is-minimized");
      const activeSurface = isMinimized ? refs.launcher : refs.shell;
      const surfaceHeight = activeSurface?.offsetHeight || 0;
      const breathingRoom = isMinimized ? 28 : 40;
      body.style.setProperty("--floating-player-space", `${surfaceHeight + breathingRoom}px`);
    }

    function setMinimized(value, { focusLauncher = false, focusPlay = false } = {}) {
      const minimized = Boolean(value);
      playerRoot.classList.toggle("is-minimized", minimized);
      refs.shell.hidden = minimized;
      refs.launcher.hidden = !minimized;
      body.classList.toggle("floating-player-expanded", !minimized);
      body.classList.toggle("floating-player-minimized", minimized);
      refs.minimize.setAttribute("aria-expanded", String(!minimized));
      refs.launcher.setAttribute("aria-expanded", String(!minimized));
      persistMinimizedState(minimized);
      updateReservedSpace();

      if (minimized) {
        closeVolumePanel();

        if (focusLauncher) {
          refs.launcher.focus();
        }
      } else if (focusPlay) {
        refs.toggle.focus();
      }
    }

    function loadTrack(index) {
      trackIndex = (index + FLOATING_PLAYER_TRACKS.length) % FLOATING_PLAYER_TRACKS.length;
      const track = currentTrack();
      applyTrackUi();
      updateProgress();

      if (audio.src !== new URL(track.src, window.location.href).href) {
        audio.src = track.src;
        audio.load();
      } else {
        audio.currentTime = 0;
      }

      updateControls();
    }

    async function playCurrentTrack() {
      const track = currentTrack();
      const absoluteTrackUrl = new URL(track.src, window.location.href).href;

      if (audio.src !== absoluteTrackUrl) {
        audio.src = track.src;
        audio.load();
      } else if (audio.error) {
        audio.load();
      }

      try {
        await audio.play();
      } catch (_error) {
        setStatus("Playback was blocked. Try pressing play again.", true);
      }
    }

    async function togglePlayback() {
      if (audio.paused) {
        await playCurrentTrack();
      } else {
        audio.pause();
      }
    }

    async function changeTrack(direction, { autoplay = !audio.paused } = {}) {
      if (FLOATING_PLAYER_TRACKS.length < 2) {
        return;
      }

      loadTrack(trackIndex + direction);

      if (autoplay) {
        await playCurrentTrack();
      }
    }

    function setPlayerVolume(value) {
      const bounded = Math.max(0, Math.min(100, Number(value) || 0));
      audio.volume = bounded / 100;
      isMuted = bounded === 0;

      if (bounded > 0) {
        lastVolume = bounded;
      }

      updateVolumeUi();
    }

    function toggleMute() {
      if (audio.volume === 0 || isMuted) {
        setPlayerVolume(lastVolume || 60);
      } else {
        lastVolume = Math.round(audio.volume * 100) || 60;
        setPlayerVolume(0);
      }
    }

    function handlePlayerKeydown(event) {
      if (event.key === "Escape") {
        if (!refs.volumePanel.hidden) {
          closeVolumePanel();
          refs.volumeToggle.focus();
          return;
        }

        if (!playerRoot.classList.contains("is-minimized")) {
          setMinimized(true, { focusLauncher: true });
        }
      }
    }

    function handleDocumentClick(event) {
      if (!playerRoot.contains(event.target)) {
        closeVolumePanel();
      }
    }

    refs.coverImage.addEventListener("error", () => {
      refs.coverImage.hidden = true;
      refs.coverFallback.hidden = false;
    });
    refs.launcherImage.addEventListener("error", () => {
      refs.launcherImage.hidden = true;
      refs.launcherFallback.hidden = false;
    });

    refs.minimize.addEventListener("click", () => setMinimized(true, { focusLauncher: true }));
    refs.launcher.addEventListener("click", () => setMinimized(false, { focusPlay: true }));
    refs.volumeToggle.addEventListener("click", () => {
      const opening = refs.volumePanel.hidden;
      refs.volumePanel.hidden = !opening;
      refs.volumeToggle.setAttribute("aria-expanded", String(opening));

      if (opening) {
        refs.volumeSlider.focus();
      }
    });
    refs.volumeSlider.addEventListener("input", () => setPlayerVolume(refs.volumeSlider.value));
    refs.mute.addEventListener("click", toggleMute);
    refs.toggle.addEventListener("click", () => {
      togglePlayback();
    });
    refs.previous.addEventListener("click", () => {
      changeTrack(-1);
    });
    refs.next.addEventListener("click", () => {
      changeTrack(1);
    });
    playerRoot.addEventListener("keydown", handlePlayerKeydown);
    document.addEventListener("click", handleDocumentClick);

    audio.addEventListener("play", () => {
      setStatus(`Playing ${currentTrack().title}.`);
      updateControls();
    });
    audio.addEventListener("pause", () => {
      if (audio.currentTime > 0 && audio.currentTime < (audio.duration || Infinity)) {
        setStatus(`Paused ${currentTrack().title}.`);
      }

      updateControls();
    });
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("loadedmetadata", updateReservedSpace);
    audio.addEventListener("ended", () => {
      updateProgress();

      if (FLOATING_PLAYER_TRACKS.length > 1) {
        changeTrack(1, { autoplay: true });
      } else {
        setStatus(`Finished ${currentTrack().title}.`);
        updateControls();
      }
    });
    audio.addEventListener("error", () => {
      setStatus("The local track could not be loaded.", true);
      updateControls();
    });

    resizeObserver?.observe(refs.shell);
    resizeObserver?.observe(refs.launcher);
    window.addEventListener("resize", updateReservedSpace);
    applyTrackUi();
    updateVolumeUi();
    updateControls();
    setMinimized(initialMinimized);

    return {
      refreshTheme() {
        updateListenLink();
      },
    };
  }

  function setFormStatus(form, message, isError = false) {
    const status = form.querySelector(".form-status");

    if (!status) {
      return;
    }

    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  applyTheme(requestedTheme());
  preloadThemeImages(activeTheme === "light" ? "dark" : "light");

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const nextTheme = activeTheme === "light" ? "dark" : "light";
      setTheme(nextTheme, { persist: true });
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY && (event.newValue === "light" || event.newValue === "dark")) {
      setTheme(event.newValue);
    }
  });

  floatingPlayerController = initFloatingPlayer();

  emailForms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const action = form.dataset.ajaxAction || form.action;

      setFormStatus(form, "Sending...");

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const response = await fetch(action, {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
          body: new FormData(form),
        });
        const responseText = await response.text();
        let payload;

        try {
          payload = JSON.parse(responseText);
        } catch (_error) {
          throw new Error("The email service returned an unexpected response.");
        }

        if (!response.ok || payload.success !== "true") {
          throw new Error(payload.message || "The email service could not send this message.");
        }

        form.reset();
        setFormStatus(form, form.dataset.successMessage || "Sent. Thank you.");
      } catch (_error) {
        setFormStatus(
          form,
          form.dataset.errorMessage || "Something went wrong. Please email ablecomposing@outlook.com.",
          true
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  });
})();
