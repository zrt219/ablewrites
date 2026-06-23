(() => {
  const THEME_KEY = "av-theme-preference";
  const PIECE_ACCESS_KEY = "able-piece-access";
  const PIECE_PASSWORD_HASH = "fefc87b37c6b7a87137ec974584b16b71f3635bbe739550e4be025525df17a92";
  const TRANSITION_MS = 240;
  const body = document.body;
  const themeButton = document.querySelector(".theme-toggle");
  const themeButtonText = document.querySelector(".theme-toggle-text");
  const themeImages = Array.from(document.querySelectorAll(".theme-image"));
  const protectedListenLinks = Array.from(document.querySelectorAll("[data-protected-listen]"));
  const constructionNotice = document.querySelector(".construction-notice");
  const constructionClose = document.querySelector(".construction-close");
  const emailForms = Array.from(document.querySelectorAll("[data-email-form]"));
  const imageCache = new Map();
  let activeTheme = normalizeTheme(body.dataset.theme);
  let targetTheme = activeTheme;
  let themeRequestId = 0;
  let themeCleanupTimer = 0;

  function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : "light";
  }

  function readSavedTheme() {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      return savedTheme === "light" || savedTheme === "dark" ? savedTheme : null;
    } catch (_error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_error) {
      // Storage can be unavailable in private or locked-down browsers.
    }
  }

  function requestedTheme() {
    const requested = new URLSearchParams(window.location.search).get("theme");
    if (requested === "light" || requested === "dark") {
      return requested;
    }

    return readSavedTheme() || "light";
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
    targetTheme = activeTheme;
    body.dataset.theme = activeTheme;
    swapThemeImages(activeTheme);
    updateThemeButton(activeTheme);
  }

  async function setTheme(theme, { persist = false } = {}) {
    const nextTheme = normalizeTheme(theme);
    const requestId = ++themeRequestId;
    targetTheme = nextTheme;

    if (themeCleanupTimer) {
      window.clearTimeout(themeCleanupTimer);
      themeCleanupTimer = 0;
    }

    if (nextTheme === activeTheme) {
      body.classList.remove("is-theme-switching");

      if (persist) {
        saveTheme(nextTheme);
      }

      return;
    }

    body.classList.add("is-theme-switching");

    try {
      await preloadThemeImages(nextTheme);

      if (requestId !== themeRequestId || targetTheme !== nextTheme) {
        return;
      }

      applyTheme(nextTheme);

      if (persist) {
        saveTheme(nextTheme);
      }
    } finally {
      if (requestId !== themeRequestId) {
        return;
      }

      themeCleanupTimer = window.setTimeout(() => {
        if (requestId !== themeRequestId) {
          return;
        }

        body.classList.remove("is-theme-switching");
        themeCleanupTimer = 0;
      }, TRANSITION_MS);
    }
  }

  applyTheme(requestedTheme());
  preloadThemeImages(activeTheme === "light" ? "dark" : "light");

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const nextTheme = targetTheme === "light" ? "dark" : "light";
      setTheme(nextTheme, { persist: true }).catch(() => {
        themeRequestId += 1;
        targetTheme = activeTheme;
        body.classList.remove("is-theme-switching");
        updateThemeButton(activeTheme);
      });
    });
  }

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

  if (constructionClose && constructionNotice) {
    constructionClose.addEventListener("click", () => {
      constructionNotice.classList.add("is-hidden");
    });
  }

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
