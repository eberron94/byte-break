const fs = require('fs');
const path = require('path');
const { ByteBuilder } = require('../models/Byte');
const Player = require('../models/Player');

async function dumpUsableVariables() {
    try {
        const dummyByte = ByteBuilder.default('dummy', 'Dummy').build();
        const dummyPlayer = new Player({
            id: 'dummy',
            energy: 100,
            inventory: {},
        });

        let md = '# Usable Variables in Activity/Event Expressions\n\n';
        md +=
            'These variables are injected into the context of effects when evaluated as strings.\n\n';

        const collectVariables = (
            obj,
            prefix = '',
            depth = 0,
            results = [],
        ) => {
            if (depth > 3 || !obj || typeof obj !== 'object') return results;

            // Gather both instance properties and prototype getters
            const keys = new Set(Object.keys(obj));
            let proto = Object.getPrototypeOf(obj);
            while (proto && proto !== Object.prototype) {
                Object.getOwnPropertyNames(proto).forEach((name) => {
                    const descriptor = Object.getOwnPropertyDescriptor(
                        proto,
                        name,
                    );
                    if (descriptor && typeof descriptor.get === 'function')
                        keys.add(name);
                });
                proto = Object.getPrototypeOf(proto);
            }

            const sortedKeys = Array.from(keys).sort();

            for (const key of sortedKeys) {
                if (typeof obj[key] === 'function' || key.startsWith('_'))
                    continue;

                const val = obj[key];
                const fullPath = prefix ? `${prefix}.${key}` : key;
                const type = Array.isArray(val)
                    ? 'Array'
                    : val === null
                      ? 'null'
                      : typeof val;

                if (type === 'object') {
                    collectVariables(val, fullPath, depth + 1, results);
                } else if (type !== 'Array') {
                    results.push({ path: fullPath, type });
                }
            }
            return results;
        };

        const formatVariables = (results) => {
            // Sort by type (Numbers first), then alphabetically by path
            results.sort((a, b) => {
                if (a.type !== b.type) {
                    const typeWeight = { number: 1, boolean: 2, string: 3 };
                    const weightA = typeWeight[a.type] || 4;
                    const weightB = typeWeight[b.type] || 4;
                    return weightA - weightB;
                }
                return a.path.localeCompare(b.path);
            });

            let lines = '';
            let currentType = '';
            for (const res of results) {
                if (res.type !== currentType) {
                    currentType = res.type;
                    lines += `\n### ${currentType.charAt(0).toUpperCase() + currentType.slice(1)}s\n`;
                }
                lines += `- \`${res.path}\`\n`;
            }
            return lines;
        };

        md +=
            '## `byte` Object' +
            formatVariables(collectVariables(dummyByte, 'byte')) +
            '\n';
        md +=
            '\n## `player` Object' +
            formatVariables(collectVariables(dummyPlayer, 'player')) +
            '\n';

        const outPath = path.join(__dirname, '../../data/usable_variables.md');
        fs.writeFileSync(outPath, md, 'utf8');
    } catch (err) {
        console.error('Failed to dump usable variables:', err);
    }
}

module.exports = dumpUsableVariables;
