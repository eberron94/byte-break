function showCrafting() {
    document.getElementById('main-view').style.display = 'none';

    let cv = document.getElementById('crafting-view');
    if (!cv) {
        cv = document.createElement('div');
        cv.id = 'crafting-view';
        document.getElementById('main-view').parentElement.appendChild(cv);
    }
    cv.style.display = 'block';

    renderCrafting();
}

async function renderCrafting() {
    const view = document.getElementById('crafting-view');
    view.innerHTML = `
        <div class="section-title">CRAFTING</div>
        <div id="crafting-list">Loading recipes...</div>
    `;
    const container = document.getElementById('crafting-list');

    try {
        const res = await fetch(`/api/crafting/${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch crafting data');
        const recipes = await res.json();

        if (recipes.length === 0) {
            container.innerHTML = '<p>No crafting recipes unlocked yet.</p>';
            return;
        }

        let html = '<div class="upgrades-grid">';
        recipes.forEach((recipe) => {
            const btnBg = recipe.canCraft
                ? 'var(--tg-theme-button-color, #4caf50)'
                : 'var(--tg-theme-hint-color, #555)';
            const opacity = recipe.canCraft ? '1' : '0.6';

            let inputsHtml = '';
            recipe.ingredients.forEach((ing) => {
                const color =
                    ing.playerHas >= ing.amount ? '#4caf50' : '#f44336';
                inputsHtml += `<span style="color: ${color};">${ing.playerHas}/${ing.amount}</span> ${ing.name}<br>`;
            });

            let outputsHtml = '';
            recipe.outcome.forEach((out) => {
                outputsHtml += `${out.amount}x ${out.name}<br>`;
            });

            if (recipe.extraOutcome) {
                recipe.extraOutcome.outcome.forEach((out) => {
                    outputsHtml += `<span style="color: #ff9800; font-size: 10px;">+ Chance for ${out.amount}x ${out.name}</span><br>`;
                });
            }

            html += `
            <div class="upgrade-item" style="opacity: ${opacity}; display: flex; flex-direction: column;">
                <div class="upgrade-header">
                    <span class="upgrade-name">${recipe.name}</span>
                    <button class="btn" style="padding: 2px 6px; font-size: 10px; margin: 0; background: var(--tg-theme-button-color, #2481cc);" onclick='showRecipeInfo(${JSON.stringify(recipe).replace(/'/g, '&#39;')})'>ℹ️</button>
                </div>
                <div class="shop-item-desc" style="flex-grow: 1;">${recipe.description}</div>
                <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; font-size: 11px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 5px;">
                    <div>
                        <strong style="color: #ccc;">Inputs:</strong><br>
                        ${inputsHtml}
                    </div>
                    <div style="text-align: right;">
                        <strong style="color: #ccc;">Outputs:</strong><br>
                        ${outputsHtml}
                    </div>
                </div>
                <button class="upgrade-btn" onclick="craftRecipe('${recipe.id}')" style="background: ${btnBg}; margin-top: 10px;" ${!recipe.canCraft ? 'disabled' : ''}>
                    ⚒️ Craft
                </button>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Crafting render error:', e);
        container.innerHTML = '<p>Error loading recipes.</p>';
    }
}

async function craftRecipe(recipeId) {
    try {
        const res = await fetch('/api/crafting/craft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, recipeId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Crafting failed');

        renderCrafting();
    } catch (e) {
        Telegram.WebApp.showAlert(e.message);
    }
}

window.showRecipeInfo = function (recipe) {
    let textAlert = `${recipe.name}\n${recipe.description}\n\nProduces:\n`;
    recipe.outcome.forEach((out) => {
        textAlert += `- ${out.amount}x ${out.name}\n`;
        if (out.description) textAlert += `  ${out.description}\n`;
        if (out.formattedEffects)
            textAlert += `  ✨ ${out.formattedEffects.replace(/<br>/g, '\n  ')}\n`;
        if (out.formattedModifiers)
            textAlert += `  🛡️ ${out.formattedModifiers.replace(/<br>/g, '\n  ')}\n`;
    });
    if (recipe.extraOutcome) {
        textAlert += `\nBonus Chance:\n`;
        recipe.extraOutcome.outcome.forEach((out) => {
            textAlert += `- ${out.amount}x ${out.name}\n`;
        });
    }
    Telegram.WebApp.showAlert(textAlert);
};
