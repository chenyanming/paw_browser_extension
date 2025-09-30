/**
 * disneyplus-bridge.js
 * Injected into page world to expose minimal playback state and controls via `window.paw.disneyplus`.
 * Periodically emits `paw-disneyplus-timeupdate` with playback status.
 */
(function() {
    function waitForNetflix(cb) {
        if (typeof hivePlayer !== 'undefined' &&
            hivePlayer) {
            cb();
        } else {
            setTimeout(() => waitForNetflix(cb), 500);
        }
    }

    waitForNetflix(() => {
        window.paw = window.paw || {};

        const currentPlayer = () => {
            const videoPlayer = hivePlayer;
            return videoPlayer;
        };

        window.paw.disneyplus = {
            seek: (seconds) => {
                const p = currentPlayer();
                if (p) p.currentTime = seconds;
            },
            play: () => currentPlayer()?.play(),
            pause: () => currentPlayer()?.pause(),
            // get paused
            getPaused: () => {
                const p = currentPlayer();
                return p ? p.paused : null;
            },
            // get current time (seconds)
            getCurrentTime: () => {
                const p = currentPlayer();
                return p ? p.currentTime : null;
            },

            // get total duration (seconds)
            getDuration: () => {
                const p = currentPlayer();
                return p ? p.duration : null;
            }
        };

        console.log('paw.disneyplus ready');

        // =============================
        // 事件监听: content script 触发控制
        // =============================
        document.addEventListener('paw-disneyplus-seek', (e) => {
            const seconds = e.detail;
            window.paw.disneyplus.seek(seconds);
        });

        document.addEventListener('paw-disneyplus-play', () => {
            window.paw.disneyplus.play();
        });

        document.addEventListener('paw-disneyplus-pause', () => {
            window.paw.disneyplus.pause();
        });

        setInterval(() => {
            const p = currentPlayer();
            if (p) {
                document.dispatchEvent(new CustomEvent('paw-disneyplus-timeupdate', {
                    detail: {
                        paused: p.paused,
                        currentTime: p.currentTime,
                        duration: p.duration
                    }
                }));
            }
        }, 1000); // fires every second — adjust interval as needed
    });
})();
