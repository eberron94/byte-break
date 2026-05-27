const { generateClassBasedAvatar, getAvatarColors } = require('../util/avatar');
const ByteClassManager = require('../managers/ByteClassManager');

/**
 * @mixin WebAPIGetHandler
 *
 * This mixin contains all the route handler logic for GET requests. By
 * separating these handlers into their own file, we keep the main
 * WebApiController clean and focused on routing.
 */
const WebAPIGetHandler = {
    async getByte(req, res) {
        this.gameManager
            .recordPlayerActivity(req.params.id)
            .catch(console.error);
        const byte = await this.gameManager.getByte(req.params.id);
        if (byte) {
            const status = byte.getStatus();
            status.colors = getAvatarColors(
                status.name,
                status.byteClass,
                status.generation,
            );
            res.json(status);
        } else {
            res.status(404).json({ error: 'Byte not found' });
        }
    },

    async getBytes(req, res) {
        try {
            this.gameManager
                .recordPlayerActivity(req.params.id)
                .catch(console.error);
            const bytes = await this.gameManager.getBytes(req.params.id);
            const livingBytes = bytes
                .filter((b) => b.isAlive)
                .map((b) => {
                    const status = b.getStatus();
                    status.id = b.id; // Append ID for frontend selection
                    status.colors = getAvatarColors(
                        status.name,
                        status.byteClass,
                        status.generation,
                    );
                    const bClass = ByteClassManager.getClass(status.byteClass);
                    status.enhanceStat = bClass
                        ? bClass.enhanceStat
                        : 'aptitude';
                    return status;
                });
            res.json(livingBytes);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch bytes' });
        }
    },

    async getAvatar(req, res) {
        const { name, charClass, level, generation } = req.query;
        if (!name) {
            return res.status(400).send('Missing name parameter');
        }
        const svgString = generateClassBasedAvatar(
            name,
            charClass || 'demo',
            parseInt(level, 10) || 1,
            parseInt(generation, 10) || 0,
        );
        // Send as raw SVG, the frontend will handle rendering
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgString);
    },

    async getAchievementIcon(req, res) {
        const { name, rank, maxRank } = req.query;
        if (!name) {
            return res.status(400).send('Missing name parameter');
        }

        const { generateAchievementIcon } = require('../util/avatar');
        const svgString = generateAchievementIcon(
            name,
            parseInt(rank, 10) || 0,
            parseInt(maxRank, 10) || 1,
        );
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgString);
    },

    async getClass(req, res) {
        const byteClass = ByteClassManager.getClass(req.params.id);
        if (byteClass) {
            res.json(byteClass);
        } else {
            res.status(404).json({ error: 'Class not found' });
        }
    },
};

module.exports = WebAPIGetHandler;
