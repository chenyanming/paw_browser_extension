/**
 * netflix-bridge.js
 * Injected into page world to expose minimal playback controls via `window.paw.netflix`.
 * Content script communicates by dispatching CustomEvents.
 */
(function() {
    function waitForNetflix(cb) {
        if (typeof netflix !== 'undefined' &&
            netflix.appContext?.state?.playerApp?.getAPI) {
            cb();
        } else {
            setTimeout(() => waitForNetflix(cb), 500);
        }
    }

    waitForNetflix(() => {
        window.paw = window.paw || {};

        const playerAPI = () => netflix.appContext.state.playerApp.getAPI().videoPlayer;

        const currentPlayer = () => {
            const videoPlayer = playerAPI();
            if (!videoPlayer) return null;
            const ids = videoPlayer.getAllPlayerSessionIds();
            if (!ids.length) return null;
            return videoPlayer.getVideoPlayerBySessionId(ids[ids.length - 1]);
        };

        window.paw.netflix = {
            seek: (seconds) => {
                const p = currentPlayer();
                if (p) p.seek(seconds);
            },
            play: () => currentPlayer()?.play(),
            pause: () => currentPlayer()?.pause()
        };

        console.log('paw.netflix ready');

        // =============================
        // 事件监听: content script 触发控制
        // =============================
        document.addEventListener('paw-netflix-seek', (e) => {
            const seconds = e.detail;
            window.paw.netflix.seek(seconds);
        });

        document.addEventListener('paw-netflix-play', () => {
            window.paw.netflix.play();
        });

        document.addEventListener('paw-netflix-pause', () => {
            window.paw.netflix.pause();
        });
    });
})();
