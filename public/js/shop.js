function showShop() {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('shop-view').style.display = 'block';
    renderShop();
}

async function renderShop() {
    const bitsValue = window.currentByte.pools.bits.value;
    const overflowValue = window.currentByte.bufferOverflow || 0;
    const totalBits = bitsValue + overflowValue;
    const bitsSpan = document.getElementById('shop-bits');
    if (bitsSpan)
        bitsSpan.innerHTML = `${bitsValue} ${overflowValue > 0 ? `<span style="color: #9c27b0;">(+${overflowValue} Overflow)</span>` : ''}`;

    try {
        const [shopsRes, invRes] = await Promise.all([
            fetch(`/api/shops?userId=${user.id}`),
            fetch(`/api/inventory/${user.id}`),
        ]);
        if (shopsRes.ok) shopsDataList = await shopsRes.json();
        if (invRes.ok) inventoryDataList = await invRes.json();
    } catch (e) {
        console.error('Failed to load shop or inventory data', e);
    }

    let html = '';
    if (shopsDataList && shopsDataList.length > 0) {
        html +=
            '<div class="shop-tabs" style="margin-bottom: 15px; display: flex; gap: 10px; overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none;">';
        shopsDataList.forEach((shop, index) => {
            const isSelected =
                window.selectedShopIndex === index ||
                (window.selectedShopIndex === undefined && index === 0);
            if (isSelected) window.selectedShopIndex = index;
            const bg = isSelected
                ? 'var(--tg-theme-button-color, #2481cc)'
                : '#333';
            html += `<button class="btn" style="background: ${bg}; padding: 8px 12px; margin: 0; white-space: nowrap;" onclick="selectShop(${index})">${shop.name}</button>`;
        });
        html += '</div>';

        const activeShop = shopsDataList[window.selectedShopIndex];
        html += `<p style="font-size: 12px; font-style: italic; color: var(--tg-theme-hint-color, #aaa); margin-bottom: 15px;">${activeShop.description}</p>`;

        html +=
            '<div class="section-title" style="margin: 0 0 10px 0;">BUY</div>';
        html += '<div class="upgrades-grid" style="margin-bottom: 20px;">';

        for (const item of activeShop.items) {
            const isSoldOut = item.remainingStock === 0;
            const canAfford = totalBits >= item.calculatedCost;
            const isDisabled = !canAfford || isSoldOut;
            const btnBg = isSoldOut
                ? 'var(--tg-theme-hint-color, #555)'
                : canAfford
                  ? 'var(--tg-theme-button-color, #4caf50)'
                  : 'var(--tg-theme-hint-color, #888)';
            const stockText =
                item.remainingStock !== undefined
                    ? ` (Stock: ${item.remainingStock})`
                    : '';
            const btnText = isSoldOut
                ? 'SOLD OUT'
                : `🛒 ${item.calculatedCost} β`;

            html += `
            <div class="upgrade-item">
                <div class="upgrade-header">
                    <span class="upgrade-name" title="${item.name}">${item.shortname || item.name}${stockText}</span>
                </div>
                <div class="shop-item-desc">${item.description}</div>
                <button class="upgrade-btn" onclick="purchaseItem('${activeShop.id}', '${item.id}')" style="background: ${btnBg};" ${isDisabled ? 'disabled' : ''}>
                    ${btnText}
                </button>
            </div>`;
        }
        html += '</div>';

        html +=
            '<div class="section-title" style="margin: 0 0 10px 0;">SELL</div>';
        html += '<div class="upgrades-grid">';
        let hasSellable = false;
        if (inventoryDataList && inventoryDataList.length > 0) {
            for (const item of inventoryDataList) {
                if (item.cost === undefined) continue;
                hasSellable = true;
                const sellPrice = Math.floor(
                    item.cost * activeShop.sellMultiplier,
                );

                html += `
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <span class="upgrade-name" title="${item.name}">${item.shortname || item.name} (x${item.amount})</span>
                    </div>
                    <div class="shop-item-desc">${item.description}</div>
                    <button class="upgrade-btn" onclick="sellItem('${activeShop.id}', '${item.id}')" style="background: #f44336;">
                        💰 ${sellPrice} β
                    </button>
                </div>`;
            }
        }
        if (!hasSellable) {
            html +=
                '<p style="grid-column: 1 / -1; font-size: 12px; color: var(--tg-theme-hint-color, #aaa);">No sellable items in inventory.</p>';
        }
        html += '</div>';
    } else {
        html = '<p>No shops are currently open.</p>';
    }

    const shopList = document.getElementById('shop-list');
    if (shopList) shopList.innerHTML = html;
}

window.selectShop = function (index) {
    window.selectedShopIndex = index;
    renderShop();
};

async function purchaseItem(shopId, itemId) {
    try {
        const response = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                shopId: shopId,
                itemId: itemId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Purchase failed');
        }

        const updatedData = await response.json();
        window.currentByte = updatedData.byte;

        renderStatsHtml(window.currentByte);
        renderShop();
    } catch (err) {
        console.error('Purchase failed:', err);
        alert('Purchase failed: ' + err.message);
    }
}

async function sellItem(shopId, itemId) {
    try {
        const response = await fetch('/api/shop/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                shopId: shopId,
                itemId: itemId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Sell failed');
        }

        const updatedData = await response.json();
        window.currentByte = updatedData.byte;

        renderStatsHtml(window.currentByte);
        renderShop();
    } catch (err) {
        console.error('Sell failed:', err);
        alert('Sell failed: ' + err.message);
    }
}
