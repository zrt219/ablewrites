(() => {
  const PIECE_ACCESS_KEY = "able-piece-access";
  const PIECE_ACCESS_TTL_MS = 60 * 60 * 1000;
  const PIECE_PASSWORD_HASH = "fefc87b37c6b7a87137ec974584b16b71f3635bbe739550e4be025525df17a92";
  const PIECE_AUDIO_SRC = "assets/audio/quintet-in-c-major-finaledition.mp3";
  const audio = document.querySelector("[data-protected-audio]");
  const lockedMessage = document.querySelector("[data-locked-message]");

  function hasAccessToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get("access") === PIECE_PASSWORD_HASH;
  }

  function rememberPieceAccess() {
    try {
      localStorage.setItem(PIECE_ACCESS_KEY, String(Date.now()));
    } catch (_error) {
      // The URL token still opens the player when storage is unavailable.
    }
  }

  function clearAccessToken() {
    if (!hasAccessToken()) {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(null, "", cleanUrl);
  }

  function hasPieceAccess() {
    try {
      const grantedAt = Number(localStorage.getItem(PIECE_ACCESS_KEY));
      return Number.isFinite(grantedAt) && Date.now() - grantedAt < PIECE_ACCESS_TTL_MS;
    } catch (_error) {
    return false;
  }
  }

  if (!audio) {
    return;
  }

  if (hasAccessToken()) {
    rememberPieceAccess();
  }

  if (hasAccessToken() || hasPieceAccess()) {
    audio.src = PIECE_AUDIO_SRC;
    audio.hidden = false;
    clearAccessToken();

    if (lockedMessage) {
      lockedMessage.hidden = true;
    }

    return;
  }

  audio.removeAttribute("src");
  audio.hidden = true;

  if (lockedMessage) {
    lockedMessage.hidden = false;
  }
})();
