const CraftRecipe = require('../models/CraftRecipe');
const craftingData = require('../../data/crafting.json');

class CraftingManager {
    constructor() {
        this.recipes = new Map();
        this.load();
    }

    load() {
        if (!Array.isArray(craftingData)) {
            console.error(
                '[CraftingManager] Invalid JSON structure: Expected an array.',
            );
            return;
        }
        craftingData.forEach((data, index) => {
            if (!data.id || !data.name) {
                console.warn(
                    `[CraftingManager] Skipping invalid recipe at index ${index}: Missing required 'id' or 'name'`,
                );
                return;
            }
            this.recipes.set(data.id, new CraftRecipe(data));
        });
    }

    getRecipe(id) {
        return this.recipes.get(id);
    }

    getAllRecipes() {
        return Array.from(this.recipes.values());
    }

    getUnlockedRecipes(context) {
        return this.getAllRecipes().filter((recipe) => recipe.isUnlocked(context));
    }

    getCraftableRecipes(context) {
        return this.getAllRecipes().filter((recipe) => recipe.canCraft(context));
    }
}

module.exports = new CraftingManager();
