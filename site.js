(() => {
  const THEME_KEY = "av-theme-preference";
  const PIECE_ACCESS_KEY = "able-piece-access";
  const PIECE_PASSWORD_HASH = "fefc87b37c6b7a87137ec974584b16b71f3635bbe739550e4be025525df17a92";
  const root = document.documentElement;
  const themeButton = document.querySelector(".theme-toggle");
  const themeButtonText = document.querySelector(".theme-toggle-text");
  const themeImages = Array.from(document.querySelectorAll(".theme-image"));
  const themedLinks = Array.from(document.querySelectorAll("a[href]"));
  const themedRedirectInputs = Array.from(document.querySelectorAll('input[name="_next"]'));
  const protectedListenLinks = Array.from(document.querySelectorAll("[data-protected-listen]"));
  const emailForms = Array.from(document.querySelectorAll("[data-email-form]"));
  const imageCache = new Map();
  const themeStorage = availableThemeStorage();
  const urlThemeRequested = new URLSearchParams(window.location.search).has("theme");
  let activeTheme = normalizeTheme(root.dataset.theme || bodyElement()?.dataset.theme);

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
      // Storage can be unavailable in private or locked-down browsers.
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
  }

  function setTheme(theme, { persist = false } = {}) {
    const nextTheme = normalizeTheme(theme);
    applyTheme(nextTheme);

    if (persist) {
      saveTheme(nextTheme);
    }

    // Asset loading must never gate the interface state. The browser will swap
    // each image when it is ready, while the toggle remains responsive.
    preloadThemeImages(nextTheme);
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

  async function hashValue(value) {
    if (!window.crypto?.subtle || !window.TextEncoder) {
      throw new Error("Password verification is unavailable in this browser.");
    }

    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function grantPieceAccess() {
    try {
      localStorage.setItem(PIECE_ACCESS_KEY, String(Date.now()));
    } catch (_error) {
      // If storage is unavailable, the player page will remain locked.
    }
  }

  function piecePlayerUrl(link) {
    const url = new URL(link.href, window.location.href);
    url.searchParams.set("access", PIECE_PASSWORD_HASH);

    if (shouldMirrorThemeInUrl()) {
      url.searchParams.set("theme", activeTheme);
    }

    return url.href;
  }

  async function unlockPiece(link) {
    const password = window.prompt("Enter the password to listen.");

    if (password === null) {
      return;
    }

    const playerWindow = window.open("about:blank", "_blank");

    if (playerWindow) {
      playerWindow.document.title = "Opening player...";
      playerWindow.document.body.textContent = "Opening player...";
    }

    try {
      const passwordHash = await hashValue(password);

      if (passwordHash !== PIECE_PASSWORD_HASH) {
        if (playerWindow) {
          playerWindow.close();
        }

        window.alert("Incorrect password.");
        return;
      }

      grantPieceAccess();
      const playerUrl = piecePlayerUrl(link);

      if (playerWindow) {
        playerWindow.opener = null;
        playerWindow.location.href = playerUrl;
      } else {
        window.location.href = playerUrl;
      }
    } catch (error) {
      if (playerWindow) {
        playerWindow.close();
      }

      window.alert(error.message || "Unable to open the player.");
    }
  }

  protectedListenLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      unlockPiece(link);
    });
  });

  function setFormStatus(form, message, isError = false) {
    const status = form.querySelector(".form-status");

    if (!status) {
      return;
    }

    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

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
