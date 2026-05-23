/**
 * netflix-bridge.js
 * Injected into page world to expose minimal playback controls via `window.paw.netflix`.
 * Content script communicates by dispatching CustomEvents.
 */
(function() {
    if (window.__pawNetflixBridgeLoaded) {
        return;
    }
    window.__pawNetflixBridgeLoaded = true;

    window.paw = window.paw || {};

    const state = {
        ready: false,
        attempts: 0,
        lastError: null,
        sessionIds: []
    };

    function getPlayerAPI() {
        const getAPI = window.netflix?.appContext?.state?.playerApp?.getAPI;
        if (!getAPI) return null;

        try {
            return getAPI().videoPlayer || null;
        } catch (error) {
            state.lastError = error?.message || String(error);
            return null;
        }
    }

    function currentPlayer() {
        try {
            const videoPlayer = getPlayerAPI();
            if (!videoPlayer) return null;

            const ids = videoPlayer.getAllPlayerSessionIds();
            state.sessionIds = ids;
            if (!ids.length) return null;

            return videoPlayer.getVideoPlayerBySessionId(ids[ids.length - 1]);
        } catch (error) {
            state.lastError = error?.message || String(error);
            return null;
        }
    }

    function safeMethod(player, methodName) {
        try {
            if (!player || typeof player[methodName] !== "function") {
                return null;
            }
            return player[methodName]();
        } catch (error) {
            state.lastError = error?.message || String(error);
            return null;
        }
    }

    function getStatus() {
        const hasPlayerAPI = Boolean(getPlayerAPI());
        const player = currentPlayer();
        const status = {
            ready: Boolean(player),
            hasNetflixGlobal: Boolean(window.netflix),
            hasPlayerAPI,
            hasPlayer: Boolean(player),
            attempts: state.attempts,
            sessionIds: state.sessionIds.slice(),
            lastError: state.lastError
        };

        if (player) {
            status.currentTime = safeMethod(player, "getCurrentTime");
            status.duration = safeMethod(player, "getDuration");
            status.paused = safeMethod(player, "isPaused");
        }

        return status;
    }

    function withPlayer(actionName, action) {
        const player = currentPlayer();
        if (!player) {
            console.warn(`[paw.netflix] ${actionName} skipped: Netflix player API is not ready`, getStatus());
            return false;
        }

        try {
            action(player);
            return true;
        } catch (error) {
            state.lastError = error?.message || String(error);
            console.warn(`[paw.netflix] ${actionName} failed`, error);
            return false;
        }
    }

    function parseDetail(detail) {
        if (typeof detail !== "string") {
            return detail || {};
        }

        try {
            return JSON.parse(detail);
        } catch (error) {
            return {};
        }
    }

    function emitResponse(detail) {
        document.dispatchEvent(new CustomEvent("paw-netflix-response", {
            detail: JSON.stringify(detail)
        }));
    }

    window.paw.netflix = {
        status: getStatus,
        seek: (seconds) => withPlayer("seek", (player) => player.seek(seconds)),
        seekRelative: (milliseconds) => withPlayer("seekRelative", (player) => {
            const currentTime = safeMethod(player, "getCurrentTime");
            if (typeof currentTime !== "number") {
                throw new Error("Netflix player does not expose getCurrentTime");
            }
            player.seek(Math.max(0, currentTime + milliseconds));
        }),
        play: () => withPlayer("play", (player) => player.play()),
        pause: () => withPlayer("pause", (player) => player.pause()),
        toggle: () => withPlayer("toggle", (player) => {
            if (safeMethod(player, "isPaused")) {
                player.play();
            } else {
                player.pause();
            }
        })
    };

    function waitForNetflix() {
        state.attempts += 1;

        if (getPlayerAPI()) {
            state.ready = true;
            state.lastError = null;
            currentPlayer();
            console.log("[paw.netflix] ready", getStatus());
            document.dispatchEvent(new CustomEvent("paw-netflix-ready", {
                detail: JSON.stringify(getStatus())
            }));
            return;
        }

        setTimeout(waitForNetflix, 500);
    }

    document.addEventListener("paw-netflix-seek", (event) => {
        window.paw.netflix.seek(event.detail);
    });

    document.addEventListener("paw-netflix-play", () => {
        window.paw.netflix.play();
    });

    document.addEventListener("paw-netflix-pause", () => {
        window.paw.netflix.pause();
    });

    document.addEventListener("paw-netflix-request", (event) => {
        const request = parseDetail(event.detail);
        const payload = request.payload || {};
        let ok = true;
        let error = null;

        if (request.type === "play") {
            ok = window.paw.netflix.play();
        } else if (request.type === "pause") {
            ok = window.paw.netflix.pause();
        } else if (request.type === "toggle") {
            ok = window.paw.netflix.toggle();
        } else if (request.type === "seek") {
            ok = window.paw.netflix.seek(payload.position);
        } else if (request.type === "seekRelative") {
            ok = window.paw.netflix.seekRelative(payload.milliseconds);
        } else if (request.type !== "status") {
            ok = false;
            error = `Unknown Netflix command: ${request.type}`;
        }

        emitResponse({
            id: request.id,
            type: request.type,
            ok,
            error,
            status: getStatus()
        });
    });

    waitForNetflix();
})();
