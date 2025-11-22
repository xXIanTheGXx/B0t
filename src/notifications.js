const fetch = global.fetch || require('node-fetch'); // Should be available in Node 18+

class DiscordNotifier {
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
        this.queue = [];
        this.processing = false;
        this.lastSent = 0;
        this.rateLimitDelay = 2500; // 2.5 seconds to be safe (5 req/2s is limit, but we send batches)
    }

    /**
     * Queue a notification
     * @param {string} title
     * @param {string} description
     * @param {number} color - Decimal color (e.g. 0xFF0000 for red)
     * @param {Array} fields - Array of {name, value, inline}
     */
    send(title, description, color = 0x00FF00, fields = []) {
        if (!this.webhookUrl) return;

        const embed = {
            title,
            description,
            color,
            fields,
            timestamp: new Date().toISOString(),
            footer: { text: 'B0t Scanner' }
        };

        this.queue.push(embed);
        this._processQueue();
    }

    async _processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const now = Date.now();
            const timeSinceLast = now - this.lastSent;

            if (timeSinceLast < this.rateLimitDelay) {
                await new Promise(r => setTimeout(r, this.rateLimitDelay - timeSinceLast));
            }

            // Discord allows up to 10 embeds per message
            const batch = this.queue.splice(0, 10);

            const payload = {
                username: "Scanner Bot",
                embeds: batch
            };

            try {
                const response = await fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) {
                    // Rate limited
                    const retryAfter = (await response.json()).retry_after || 1;
                    console.log(`Rate limited by Discord. Waiting ${retryAfter}s...`);
                    await new Promise(r => setTimeout(r, retryAfter * 1000));
                    // Put batch back at front?
                    this.queue.unshift(...batch);
                    continue;
                }

                this.lastSent = Date.now();
            } catch (err) {
                console.error('Failed to send Discord webhook:', err.message);
                // If network error, maybe retry later? For now, we drop to prevent memory leaks if offline.
            }
        }

        this.processing = false;
    }
}

module.exports = DiscordNotifier;
