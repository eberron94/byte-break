const { generateClassBasedAvatar, getAvatarColors, generateAchievementIcon } = require('./avatar');

function generateTradingCard(byte) {
    const status = byte.getStatus();
    const colors = getAvatarColors(
        byte.name,
        status.byteClass,
        status.generation,
    );
    let avatarSvg = generateClassBasedAvatar(
        byte.name,
        status.byteClass,
        status.level,
        status.generation,
    );

    // Override the explicit dimensions so it scales correctly inside our layout
    avatarSvg = avatarSvg
        .replace(/width="[^"]+"/, 'x="40" width="260"')
        .replace(/height="[^"]+"/, 'y="110" height="260"');

    // Needs
    const needs = [
        { label: 'Charge', value: status.charge, color: '#4caf50' },
        { label: 'Thermal', value: status.thermal, color: '#ff9800' },
        { label: 'Defrag', value: status.defrag, color: '#2196f3' },
        { label: 'Telemetry', value: status.telemetry, color: '#9c27b0' },
    ];

    let needsSvg = '';
    needs.forEach((need, index) => {
        const y = 560 + index * 45;
        const barWidth = 240;
        const fillWidth = (need.value / 100) * barWidth;
        needsSvg += `
            <text x="40" y="${y + 15}" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="bold">${need.label}</text>
            <text x="${40 + barWidth}" y="${y + 15}" fill="#cccccc" font-family="sans-serif" font-size="14" text-anchor="end">${need.value}/100</text>
            <rect x="40" y="${y + 22}" width="${barWidth}" height="10" rx="5" fill="#333333" />
            <rect x="40" y="${y + 22}" width="${fillWidth}" height="10" rx="5" fill="${need.color}" />
        `;
    });

    // Pools
    const pools = [
        {
            label: 'Integrity',
            val: status.pools.integrity.value,
            max: status.pools.integrity.maxValue,
            color: '#f44336',
        },
        {
            label: 'TeraFlops',
            val: status.pools.teraflops.value,
            max: status.pools.teraflops.maxValue,
            color: '#3f51b5',
        },
        {
            label: 'Bandwidth',
            val: status.pools.bandwidth.value,
            max: status.pools.bandwidth.maxValue,
            color: '#8bc34a',
        },
    ];

    let poolsSvg = '';
    pools.forEach((pool, index) => {
        const y = 560 + index * 60;
        const barWidth = 240;
        const fillWidth = Math.min(barWidth, (pool.val / pool.max) * barWidth);
        poolsSvg += `
            <text x="320" y="${y + 15}" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="bold">${pool.label}</text>
            <text x="${320 + barWidth}" y="${y + 15}" fill="#cccccc" font-family="sans-serif" font-size="14" text-anchor="end">${pool.val}/${pool.max}</text>
            <rect x="320" y="${y + 22}" width="${barWidth}" height="12" rx="6" fill="#333333" />
            <rect x="320" y="${y + 22}" width="${fillWidth}" height="12" rx="6" fill="${pool.color}" />
        `;
    });

    // Core Stats
    const statKeys = Object.keys(status.stats);
    let statsSvg = `<rect x="320" y="110" width="240" height="260" rx="15" fill="#2a2a40" stroke="#4d4d73" stroke-width="3"/>`;
    statKeys.forEach((key, index) => {
        const y = 110 + index * 52;
        if (index > 0) {
            statsSvg += `<line x1="320" y1="${y}" x2="560" y2="${y}" stroke="#4d4d73" stroke-width="2"/>`;
        }
        statsSvg += `
            <text x="340" y="${y + 32}" fill="${colors.primary}" font-family="sans-serif" font-size="14" font-weight="bold">${key.toUpperCase()}</text>
            <text x="540" y="${y + 34}" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="end">${status.stats[key]}</text>
        `;
    });

    const bitsValue = status.pools.bits.value;
    const overflowValue = status.bufferOverflow || 0;
    const totalBits = bitsValue + overflowValue;

    const bitsPct = Math.min(1, totalBits / status.pools.bits.maxValue);

    const isDormant = status.isDormant;

    const svg = `
    <svg width="600" height="800" viewBox="0 0 600 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#161625" />
                <stop offset="100%" stop-color="#1e1e30" />
            </linearGradient>
            <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="${colors.primary}" />
                <stop offset="100%" stop-color="hsl(${colors.finalHue}, 75%, 40%)" />
            </linearGradient>
            <filter id="grayscale">
                <feColorMatrix type="saturate" values="0"/>
            </filter>
        </defs>
        <rect width="600" height="800" rx="20" fill="url(#bgGrad)" stroke="${colors.primary}" stroke-width="6"/>
        <path d="M 3 23 Q 3 3 23 3 L 577 3 Q 597 3 597 23 L 597 90 L 3 90 Z" fill="url(#headerGrad)"/>
        <text x="40" y="55" fill="#ffffff" font-family="sans-serif" font-size="34" font-weight="bold" letter-spacing="1">${status.name}</text>
        <text x="40" y="80" fill="#d0e8ff" font-family="sans-serif" font-size="18" font-weight="normal" text-transform="uppercase">Class: ${status.byteClass}</text>
        <rect x="400" y="20" width="160" height="50" rx="10" fill="#121212" fill-opacity="0.5"/>
        <text x="480" y="53" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">GEN.LVL ${status.generation}.${status.level}</text>
        
        <rect x="40" y="110" width="260" height="260" rx="15" fill="#0c0c0c" stroke="#333" stroke-width="3"/>
        <!-- Automatically scales the full-width avatar to fit the box -->
        <g${isDormant ? ' filter="url(#grayscale)" opacity="0.5"' : ''}>
            ${avatarSvg}
        </g>

        ${statsSvg}
        
        <text x="40" y="420" fill="${colors.primary}" font-family="sans-serif" font-size="16" font-weight="bold">BIT BUFFER</text>
        <text x="560" y="420" fill="#cccccc" font-family="sans-serif" font-size="14" text-anchor="end">${bitsValue}/${status.pools.bits.maxValue}${overflowValue > 0 ? ` (+${overflowValue})` : ''}</text>
        <rect x="40" y="430" width="520" height="12" rx="6" fill="#333333" />
        <rect x="40" y="430" width="${bitsPct * 520}" height="12" rx="6" fill="#ffd700" />
        <text x="300" y="465" fill="#aaaaaa" font-family="sans-serif" font-size="15" font-style="italic" text-anchor="middle">Invest ${status.bitsToNextLevel} β in System Upgrades to level up</text>
        <line x1="40" y1="485" x2="560" y2="485" stroke="#333" stroke-width="2"/>
        
        <text x="40" y="525" fill="${colors.primary}" font-family="sans-serif" font-size="18" font-weight="bold">SYSTEM NEEDS</text>
        ${needsSvg}
        <text x="320" y="525" fill="${colors.primary}" font-family="sans-serif" font-size="18" font-weight="bold">CAPACITIES</text>
        ${poolsSvg}
    </svg>`;
    return svg;
}

function generateStasisCard(bytes, player) {
    const maxBytes = player.maxBytes || 2;
    const livingBytes = bytes.filter((b) => b.isAlive);
    const svgHeight = Math.max(300, 140 + livingBytes.length * 180);

    let svg = `
    <svg width="600" height="${svgHeight}" viewBox="0 0 600 ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#161625" />
                <stop offset="100%" stop-color="#1e1e30" />
            </linearGradient>
            <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#3f51b5" />
                <stop offset="100%" stop-color="#9c27b0" />
            </linearGradient>
            <filter id="grayscale">
                <feColorMatrix type="saturate" values="0"/>
            </filter>
        </defs>
        <rect width="600" height="${svgHeight}" rx="20" fill="url(#bgGrad)" stroke="#3f51b5" stroke-width="6"/>
        <path d="M 3 23 Q 3 3 23 3 L 577 3 Q 597 3 597 23 L 597 90 L 3 90 Z" fill="url(#headerGrad)"/>
        <text x="40" y="55" fill="#ffffff" font-family="sans-serif" font-size="34" font-weight="bold" letter-spacing="1">STASIS BAY</text>
        <text x="40" y="80" fill="#d0e8ff" font-family="sans-serif" font-size="18" font-weight="normal" text-transform="uppercase">Available Bytes: ${livingBytes.length}/${maxBytes}</text>
    `;

    livingBytes.forEach((byte, index) => {
        const status = byte.getStatus();
        const colors = getAvatarColors(
            byte.name,
            status.byteClass,
            status.generation,
        );
        let avatarSvg = generateClassBasedAvatar(
            byte.name,
            status.byteClass,
            status.level,
            status.generation,
        );

        const rowY = 120 + index * 180;

        avatarSvg = avatarSvg
            .replace(/width="[^"]+"/, `x="55" width="100"`)
            .replace(/height="[^"]+"/, `y="${rowY + 30}" height="100"`);

        svg += `
        <rect x="40" y="${rowY}" width="520" height="160" rx="15" fill="#2a2a40" stroke="${colors.primary}" stroke-width="3"/>
        <text x="175" y="${rowY + 50}" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="bold">${status.name}</text>
        <text x="175" y="${rowY + 75}" fill="${colors.primary}" font-family="sans-serif" font-size="16" font-weight="bold">GEN.LVL ${status.generation}.${status.level} ${status.byteClass.toUpperCase()}</text>
        `;

        svg += `
        <rect x="55" y="${rowY + 30}" width="100" height="100" rx="10" fill="#0c0c0c" stroke="#333" stroke-width="3"/>
        <g${status.isDormant ? ' filter="url(#grayscale)" opacity="0.5"' : ''}>
            ${avatarSvg}
        </g>`;

        const needs = [
            { label: 'Charge', value: status.charge, color: '#4caf50' },
            { label: 'Thermal', value: status.thermal, color: '#ff9800' },
            { label: 'Defrag', value: status.defrag, color: '#2196f3' },
            { label: 'Telemetry', value: status.telemetry, color: '#9c27b0' },
        ];

        needs.forEach((need, nIndex) => {
            const col = nIndex % 2;
            const row = Math.floor(nIndex / 2);
            const barX = 175 + col * 190;
            const barY = rowY + 115 + row * 25;
            const barWidth = 160;
            const fillWidth = (need.value / 100) * barWidth;
            svg += `
                <text x="${barX}" y="${barY - 6}" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold">${need.label}</text>
                <text x="${barX + barWidth}" y="${barY - 6}" fill="#cccccc" font-family="sans-serif" font-size="10" text-anchor="end">${need.value}/100</text>
                <rect x="${barX}" y="${barY}" width="${barWidth}" height="8" rx="4" fill="#333333" />
                <rect x="${barX}" y="${barY}" width="${fillWidth}" height="8" rx="4" fill="${need.color}" />
            `;
        });
    });

    svg += `</svg>`;
    return svg;
}

function generateAchievementCard(achievement) {
    const { name, description, reward, tier, totalTiers } = achievement;
    
    let iconSvg = generateAchievementIcon(name, tier, totalTiers);
    iconSvg = iconSvg.replace('<svg ', '<svg x="20" y="20" ');

    const tierStr = totalTiers > 1 ? ` (Tier ${tier}/${totalTiers})` : '';

    return `
    <svg width="500" height="140" viewBox="0 0 500 140" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#161625" />
                <stop offset="100%" stop-color="#1e1e30" />
            </linearGradient>
            <linearGradient id="cmyText" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#00FFFF" />
                <stop offset="50%" stop-color="#FF00FF" />
                <stop offset="100%" stop-color="#FFFF00" />
            </linearGradient>
        </defs>
        <rect width="500" height="140" rx="15" fill="url(#bgGrad)" stroke="#4d4d73" stroke-width="3"/>
        
        ${iconSvg}

        <text x="140" y="45" fill="url(#cmyText)" font-family="sans-serif" font-size="14" font-weight="bold" letter-spacing="1">ACHIEVEMENT UNLOCKED</text>
        <text x="140" y="75" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold">${name}${tierStr}</text>
        <text x="140" y="105" fill="#aaaaaa" font-family="sans-serif" font-size="13">${description}</text>
        
        <rect x="400" y="20" width="80" height="30" rx="15" fill="#2a2a40" stroke="#ffd700" stroke-width="2"/>
        <text x="440" y="40" fill="#ffd700" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">+${reward} α</text>
    </svg>`;
}

module.exports = {
    generateTradingCard,
    generateStasisCard,
    generateAchievementCard,
};
