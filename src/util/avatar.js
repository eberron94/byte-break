const crypto = require('crypto');

function getLuminance(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const r = f(0), g = f(8), b = f(4);
    // Perceived luminance formula (sRGB)
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function getAvatarColors(name, charClass = 'demo', generation = 0) {
    const nameHash = crypto
        .createHash('sha256')
        .update(`${name}_${generation}`)
        .digest('hex');
    const classHash = crypto
        .createHash('sha256')
        .update(charClass)
        .digest('hex');

    // 1. BASE COLOR FROM CLASS
    // Anchor the hue to the class string
    const baseHue = parseInt(classHash.substring(0, 3), 16) % 360;

    // 2. MINOR VARIATION FROM NAME
    // We take a small slice of the name hash to create a +/- 20 degree offset
    const offset = (parseInt(nameHash.substring(0, 2), 16) % 40) - 20;
    const finalHue = (baseHue + offset + 360) % 360; // Ensure it stays positive

    const primary = `hsl(${finalHue}, 75%, 60%)`;
    const secondary = `hsl(${(finalHue + 180) % 360}, 75%, 60%)`;
    const tertiary = `hsl(${(finalHue + 60) % 360}, 80%, 65%)`; // A vibrant accent color
    const bgColor = '#0c0c0c';

    // Guaranteed bright variant for text on dark backgrounds
    const primaryLight = `hsl(${finalHue}, 80%, 75%)`;
    // Dynamic button text color (white or dark) depending on perceived brightness
    const buttonText = getLuminance(finalHue, 75, 60) > 0.6 ? '#121212' : '#ffffff';

    return { primary, secondary, tertiary, bgColor, primaryLight, buttonText, nameHash, finalHue };
}

function generateClassBasedAvatar(
    name,
    charClass = 'demo',
    level = 1,
    generation = 0,
) {
    const { primary, secondary, tertiary, bgColor, nameHash } = getAvatarColors(
        name,
        charClass,
        generation,
    );

    const gridWidth = 22;
    const gridHeight = 22;
    const cellSize = 10;
    const triangleWidth = 18;
    const triangleHeight = 22;
    const padding = 8;
    let svgElements = '';

    const svgWidth =
        gridWidth * cellSize + (triangleWidth - cellSize) + padding * 2;
    const svgHeight =
        gridHeight * cellSize + (triangleHeight - cellSize) + padding * 2;

    let minX = svgWidth;
    let maxX = 0;
    let minY = svgHeight;
    let maxY = 0;
    let hasVisible = false;

    // --- Pre-pass to guarantee smooth level progression ---
    const cells = [];
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x <= 10; x++) {
            const hashIndex = (x * 17 + y * 23) % 60;
            const cellSeed =
                parseInt(nameHash.substring(hashIndex, hashIndex + 3), 16) +
                x * 31 +
                y * 47;

            // Lower density by explicitly skipping a percentage of valid cells
            const isVisible = cellSeed % 10 > 2;
            if (!isVisible) continue;

            const distanceX = Math.abs(x - 10.5);
            const distanceY = Math.abs(y - 10.5);
            const distanceFromCenter = Math.sqrt(
                distanceX * distanceX + distanceY * distanceY,
            );

            // Add deterministic noise to the distance so shapes at the same radius don't clump
            const noise = (cellSeed % 100) / 100;
            const score = distanceFromCenter + noise;

            cells.push({ x, y, score, cellSeed, distanceFromCenter });
        }
    }

    // Sort cells by score (closest to center first)
    cells.sort((a, b) => a.score - b.score);

    // Map sorted cells to unlock levels 1-100
    const unlockMap = new Map();
    cells.forEach((cell, index) => {
        let unlockLevel = Math.floor((index / cells.length) * 100) + 1;
        // Ensure the absolute core is always present at level 1
        if (cell.distanceFromCenter < 1) unlockLevel = 1;
        unlockMap.set(`${cell.x},${cell.y}`, {
            unlockLevel,
            cellSeed: cell.cellSeed,
            distanceFromCenter: cell.distanceFromCenter,
        });
    });

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const columnToRead = x > 10 ? 21 - x : x;
            const cellKey = `${columnToRead},${y}`;

            if (!unlockMap.has(cellKey)) continue;

            const cellData = unlockMap.get(cellKey);
            const unlockLevel = cellData.unlockLevel;

            if (level >= unlockLevel) {
                const cellSeed = cellData.cellSeed;
                const distanceFromCenter = cellData.distanceFromCenter;
                const levelsPastUnlock = level - unlockLevel;

                // Opacity logic (Fade in): Newer shapes on the outer edge are faint, older shapes in the center are solid
                const rampUpPeriod = 5;
                let opacity =
                    levelsPastUnlock < rampUpPeriod
                        ? 0.25 + levelsPastUnlock * (0.6 / rampUpPeriod)
                        : 0.85;

                // Static stroke based only on position so old shapes don't morph
                let strokeWidth = distanceFromCenter * 0.2;
                if (distanceFromCenter < 1 || strokeWidth < 0) strokeWidth = 0;

                // Static colors so a shape's color never shifts across levels
                const tertiaryThreshold = 85;
                const secondaryThreshold = 60;

                // Pseudo-random selection mapped to 0-99 for granularity
                const colorChance = (cellSeed * 7 + y * 3) % 100;

                let fillColor = primary;
                if (colorChance >= tertiaryThreshold) fillColor = tertiary;
                else if (colorChance >= secondaryThreshold)
                    fillColor = secondary;

                let type = (cellSeed + columnToRead + y) % 4;

                // Mirror the triangle orientations on the right side to ensure visual symmetry
                if (x > 10) {
                    if (type === 0) type = 1;
                    else if (type === 1) type = 0;
                    else if (type === 2) type = 3;
                    else if (type === 3) type = 2;
                }

                const x0 = x * cellSize + padding,
                    y0 = y * cellSize + padding;
                const x1 = x0 + triangleWidth,
                    y1 = y0 + triangleHeight;

                // Symmetrical deterministic rotation
                let rotation = ((cellSeed * 13 + y * 7) % 60) - 30;
                if (x > 10) rotation = -rotation;

                const cx = x0 + triangleWidth / 2;
                const cy = y0 + triangleHeight / 2;

                hasVisible = true;
                // Calculate rough bounding box with generous padding for rotation
                minX = Math.min(minX, cx - triangleWidth);
                maxX = Math.max(maxX, cx + triangleWidth);
                minY = Math.min(minY, cy - triangleHeight);
                maxY = Math.max(maxY, cy + triangleHeight);

                let points = '';
                if (type === 0) points = `${x0},${y0} ${x1},${y0} ${x0},${y1}`;
                else if (type === 1)
                    points = `${x0},${y0} ${x1},${y0} ${x1},${y1}`;
                else if (type === 2)
                    points = `${x0},${y1} ${x1},${y1} ${x0},${y0}`;
                else points = `${x0},${y1} ${x1},${y1} ${x1},${y0}`;

                svgElements += `
                <polygon points="${points}" 
                    fill="${fillColor}" 
                    fill-opacity="${opacity.toFixed(2)}"
                    stroke="${bgColor}"
                    stroke-width="${strokeWidth.toFixed(2)}"
                    stroke-linejoin="round"
                    transform="rotate(${rotation.toFixed(1)}, ${cx.toFixed(1)}, ${cy.toFixed(1)})"
                />`;
            }
        }
    }

    let viewBoxX = 0;
    let viewBoxY = 0;
    let viewBoxWidth = svgWidth;
    let viewBoxHeight = svgHeight;

    if (hasVisible) {
        const contentWidth = Math.min(svgWidth, maxX - minX);
        const contentHeight = Math.min(svgHeight, maxY - minY);

        const targetRatio = svgWidth / svgHeight;
        const contentRatio = contentWidth / contentHeight;

        if (contentRatio > targetRatio) {
            viewBoxWidth = contentWidth;
            viewBoxHeight = contentWidth / targetRatio;
        } else {
            viewBoxHeight = contentHeight;
            viewBoxWidth = contentHeight * targetRatio;
        }

        // Add 15% zoom-out padding, but don't exceed original dimensions
        viewBoxWidth = Math.min(svgWidth, viewBoxWidth * 1.15);
        viewBoxHeight = Math.min(svgHeight, viewBoxHeight * 1.15);

        const contentCenterX = Math.max(
            0,
            Math.min(svgWidth, (minX + maxX) / 2),
        );
        const contentCenterY = Math.max(
            0,
            Math.min(svgHeight, (minY + maxY) / 2),
        );

        viewBoxX = contentCenterX - viewBoxWidth / 2;
        viewBoxY = contentCenterY - viewBoxHeight / 2;
    }

    const scale = 5;

    return `<svg width="${svgWidth * scale}" height="${svgHeight * scale}" viewBox="${viewBoxX.toFixed(1)} ${viewBoxY.toFixed(1)} ${viewBoxWidth.toFixed(1)} ${viewBoxHeight.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
                <rect x="${viewBoxX.toFixed(1)}" y="${viewBoxY.toFixed(1)}" width="${viewBoxWidth.toFixed(1)}" height="${viewBoxHeight.toFixed(1)}" fill="${bgColor}" /> 
                ${svgElements}
            </svg>`;
}

function generateAchievementIcon(name, rank, maxRank) {
    const nameHash = crypto.createHash('sha256').update(name).digest('hex');

    // CMY Palette
    const cmyColors = ['#00FFFF', '#FF00FF', '#FFFF00'];
    const bgColor = '#1e1e30';

    const size = 100;
    const padding = 15;
    let svgElements = '';

    let style = 1;
    if (maxRank > 1 && maxRank <= 5) style = 2;
    else if (maxRank > 5) style = 3;

    let totalShapes = 0;
    if (style === 1) totalShapes = 8;
    else if (style === 2) totalShapes = maxRank * 3;
    else if (style === 3) totalShapes = Math.min(20, maxRank);

    let unlockedShapes = 0;
    if (style === 1) unlockedShapes = rank > 0 ? totalShapes : 0;
    else if (style === 2) unlockedShapes = rank * 3;
    else if (style === 3) {
        unlockedShapes = Math.floor((rank / maxRank) * totalShapes);
    }

    for (let i = 0; i < totalShapes; i++) {
        const hashIndex = (i * 7) % 60;
        const seed = parseInt(nameHash.substring(hashIndex, hashIndex + 4), 16);

        const w = 15 + (seed % 35);
        const h = 15 + ((seed >> 2) % 35);
        const x = padding + ((seed >> 4) % Math.max(1, size - 2 * padding - w));
        const y = padding + ((seed >> 6) % Math.max(1, size - 2 * padding - h));
        const rotation = ((seed >> 8) % 90) - 45;

        // Guarantee equal use of CMY colors, even when locked
        let color = cmyColors[i % 3];

        // Randomize the locked transparency to be very faint (inactive neon effect)
        let opacity = 0.05 + ((seed >> 12) % 3) * 0.05;

        if (i < unlockedShapes) {
            // If unlocked, brighten the transparency significantly
            opacity = 0.4 + ((seed >> 14) % 4) * 0.15;
        }

        const cx = x + w / 2;
        const cy = y + h / 2;

        if (style === 1) {
            svgElements += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="${opacity}" transform="rotate(${rotation}, ${cx}, ${cy})" />`;
        } else if (style === 2) {
            svgElements += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="${opacity}" transform="rotate(${rotation}, ${cx}, ${cy})" rx="8" />`;
        } else if (style === 3) {
            if (seed % 2 === 0) {
                svgElements += `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${color}" fill-opacity="${opacity}" transform="rotate(${rotation}, ${cx}, ${cy})" />`;
            } else {
                svgElements += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="${opacity}" transform="rotate(${rotation}, ${cx}, ${cy})" rx="4" />`;
            }
        }
    }

    const isEarned = rank > 0;
    const borderColor = isEarned ? `url(#cmyGradIcon_${nameHash})` : '#4d4d73';

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="cmyGradIcon_${nameHash}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00FFFF" />
                <stop offset="50%" stop-color="#FF00FF" />
                <stop offset="100%" stop-color="#FFFF00" />
            </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" rx="12" fill="${bgColor}" stroke="${borderColor}" stroke-width="4" />
        ${svgElements}
    </svg>`;
}

module.exports = {
    generateClassBasedAvatar,
    getAvatarColors,
    generateAchievementIcon,
};
//
