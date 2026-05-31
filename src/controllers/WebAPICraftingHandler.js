const CraftingManager = require('../managers/CraftingManager');
const ItemManager = require('../managers/ItemManager');
const GameContext = require('../models/GameContext');

/**
 * @mixin WebAPICraftingHandler
 */
const WebAPICraftingHandler = {
    async getCraftingRecipes(req, res) {
        try {
            const userId = req.params.id;
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const byte = await this.gameManager.getByte(userId);
            if (!player || !byte)
                return res.status(404).json({ error: 'Not found' });

            const context = new GameContext(byte, player);
            const unlocked = CraftingManager.getUnlockedRecipes(context);

            const recipesData = unlocked.map((recipe) => recipe.toWeb(context));

            res.json(recipesData);
        } catch (error) {
            console.error('Crafting API Error:', error);
            res.status(500).json({ error: 'Failed to fetch crafting recipes' });
        }
    },

    async craftRecipe(req, res) {
        const { userId, recipeId } = req.body;
        if (this.gameManager.hasTransaction(userId)) {
            return res
                .status(429)
                .json({ error: 'Transaction in progress. Please wait.' });
        }
        this.gameManager.addTransaction(userId);
        try {
            this.gameManager.recordPlayerActivity(userId).catch(console.error);
            const player = await this.gameManager.getPlayer(userId);
            const byte = await this.gameManager.getByte(userId);
            if (!player || !byte)
                return res.status(404).json({ error: 'Not found' });

            const recipe = CraftingManager.getRecipe(recipeId);
            if (!recipe)
                return res.status(404).json({ error: 'Recipe not found' });

            const context = new GameContext(byte, player);
            let consolidatedOutcomes;
            try {
                consolidatedOutcomes = recipe.craft(context);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            await this.gameManager.savePlayer(player);

            if (this.botController) {
                const outcomeNames = Object.keys(consolidatedOutcomes)
                    .map(
                        (id) =>
                            `${consolidatedOutcomes[id]}x ${ItemManager.getItem(id)?.name || id}`,
                    )
                    .join(', ');
                this.botController
                    .sendStatusUI(
                        userId,
                        byte,
                        player,
                        `Crafted ${recipe.name}! Received: ${outcomeNames}`,
                    )
                    .catch(console.error);
            }
            res.json({ success: true, inventory: player.inventory });
        } catch (error) {
            res.status(500).json({ error: error.message });
        } finally {
            this.gameManager.deleteTransaction(userId);
        }
    },
};

module.exports = WebAPICraftingHandler;
