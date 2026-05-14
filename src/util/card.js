const { generateClassBasedAvatar, getAvatarColors } = require('./avatar');

function generateTradingCard(byte) {
    const status = byte.getStatus();
    const colors = getAvatarColors(byte.name, status.byteClass);
    let avatarSvg = generateClassBasedAvatar(
        byte.name,
        status.byteClass,
        status.level,
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

    const bitsPct = Math.min(
        1,
        status.pools.bits.value / status.pools.bits.maxValue,
    );

    const isDormant =
        status.charge === 0 ||
        status.thermal === 0 ||
        status.defrag === 0 ||
        status.telemetry === 0;

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
        <rect x="460" y="20" width="100" height="50" rx="10" fill="#121212" fill-opacity="0.5"/>
        <text x="510" y="53" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="bold" text-anchor="middle">LVL ${status.level}</text>
        
        <rect x="40" y="110" width="260" height="260" rx="15" fill="#0c0c0c" stroke="#333" stroke-width="3"/>
        <!-- Automatically scales the full-width avatar to fit the box -->
        <g${isDormant ? ' filter="url(#grayscale)" opacity="0.5"' : ''}>
            ${avatarSvg}
        </g>

        ${statsSvg}
        
        <text x="40" y="420" fill="${colors.primary}" font-family="sans-serif" font-size="16" font-weight="bold">BIT BUFFER</text>
        <text x="560" y="420" fill="#cccccc" font-family="sans-serif" font-size="14" text-anchor="end">${status.pools.bits.value}/${status.pools.bits.maxValue}</text>
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

module.exports = generateTradingCard;
