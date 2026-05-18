const Shop = require('../models/Shop');
const shopsData = require('../../data/shops.json');

class ShopManager {
    constructor() {
        this.shops = new Map();
        this.load();
    }

    load() {
        if (!Array.isArray(shopsData)) {
            console.error('[ShopManager] Invalid JSON structure: Expected an array.');
            return;
        }
        shopsData.forEach((data) => {
            if (!data.id || !data.name) return;
            this.shops.set(data.id, new Shop(data));
        });
    }

    getAllShops() {
        return Array.from(this.shops.values());
    }

    getAvailableShops(context) {
        return this.getAllShops().filter(shop => shop.canAppear(context));
    }
    
    getShop(id) {
        return this.shops.get(id);
    }
}
module.exports = new ShopManager();