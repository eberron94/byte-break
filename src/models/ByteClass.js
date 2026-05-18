/**
 * Represents a character class, dictating stat growth and XP investment costs.
 */
class ByteClass {
    constructor(data) {
        this.id = data.id || data.name.toLowerCase().replace(/\s+/g, '_');
        this.name = data.name;
        this.description = data.description;
        this.enhanceStat = data.enhanceStat || 'aptitude';
        this.investmentRates = data.investmentRates || {};
        this.innatePointsPerLevel = data.innatePointsPerLevel || {};
    }
}

module.exports = ByteClass;
