class Pagination {
    /**
     * Generates an inline keyboard with pagination controls.
     *
     * @param {Array} items - Array of button objects `{ text, callback_data }`
     * @param {Object} options - Pagination options
     * @param {number} options.page - Current page index (0-based)
     * @param {number} options.pageSize - Items per page
     * @param {number} options.columns - Number of buttons per row
     * @param {string} options.actionPrefix - Prefix for the prev/next callback_data (e.g., 'shop_page')
     * @returns {Array} inline_keyboard array
     */
    static getKeyboard(items, options = {}) {
        const {
            page = 0,
            pageSize = 5,
            columns = 1,
            actionPrefix = 'page',
        } = options;

        const totalPages = Math.ceil(items.length / pageSize) || 1;
        const currentPage = Math.max(0, Math.min(page, totalPages - 1));

        const slicedItems = items.slice(
            currentPage * pageSize,
            (currentPage + 1) * pageSize,
        );
        const keyboard = [];

        // Group items into columns
        for (let i = 0; i < slicedItems.length; i += columns) {
            keyboard.push(slicedItems.slice(i, i + columns));
        }

        // Add navigation controls if there are multiple pages
        if (totalPages > 1) {
            const navRow = [];
            if (currentPage > 0) {
                navRow.push({
                    text: '⬅️ Prev',
                    callback_data: `${actionPrefix}_${currentPage - 1}`,
                });
            }
            navRow.push({
                text: `${currentPage + 1} / ${totalPages}`,
                callback_data: 'ignore_pagination',
            });
            if (currentPage < totalPages - 1) {
                navRow.push({
                    text: 'Next ➡️',
                    callback_data: `${actionPrefix}_${currentPage + 1}`,
                });
            }
            keyboard.push(navRow);
        }
        return keyboard;
    }
}
module.exports = Pagination;
